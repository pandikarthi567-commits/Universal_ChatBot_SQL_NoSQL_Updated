const express = require("express");
const axios = require("axios");
const Project = require("../models/Project");
const Endpoint = require("../models/Endpoint");
const Intent = require("../models/Intent");
const ProjectAnalysis = require("../models/ProjectAnalysis");
const ProjectKnowledge = require("../models/ProjectKnowledge");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { getNextSequence } = require("../models/Counter");
const { requireAdmin, optionalAuth } = require("../middleware/auth");
const { encrypt, maskDatabaseUri } = require("../services/cryptoService");
const { analyzeProject, syncProjectProfileWithNLP } = require("../services/projectAnalyzer");
const {
  listProjectKnowledge,
  addKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  checkKnowledgeStaleness,
} = require("../services/knowledgeService");

const router = express.Router();

function sanitizeProject(projectDoc) {
  if (!projectDoc) return null;
  const obj = projectDoc.toObject ? projectDoc.toObject() : { ...projectDoc };
  if (obj.db_config && obj.db_config.encrypted_uri) {
    delete obj.db_config.encrypted_uri;
  }
  return obj;
}

// GET /api/projects - List all projects
router.get("/", requireAdmin, async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ created_at: -1 });
    res.json(projects.map(sanitizeProject));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/register - Register a project manually
router.post("/register", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      project_code,
      description,
      base_url,
      health_path,
      auth_type,
      auth_config,
      integration_mode,
      allowed_domains,
      enable_mutating_actions,
      require_action_confirmation,
      db_access_enabled,
      db_config,
      endpoints,
      intents,
    } = req.body;

    if (!name || !project_code) {
      return res.status(400).json({ detail: "name and project_code are required." });
    }

    const cleanCode = project_code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,62}$/.test(cleanCode) || ["ASK","ANALYZE","COMPLETE","CONFIRM","HISTORY","CLEAR","SESSION"].includes(cleanCode)) return res.status(400).json({detail:"Invalid or reserved project code"});
    const cleanSlug = cleanCode.toLowerCase();
    const resolvedBaseUrl = (base_url || "http://localhost:8000").trim().replace(/\/+$/, "");
    const defaultEndpointPath = health_path ? health_path.trim() : `/api/${cleanSlug}`;

    const existing = await Project.findOne({ project_code: cleanCode });
    if (existing) {
      return res.status(409).json({ detail: `Project code '${project_code}' already exists.` });
    }

    const generatedBearer = auth_config?.token || `bearer_${cleanSlug}_${require("crypto").randomBytes(32).toString("hex")}`;
    const generatedApiKey = auth_config?.api_key || `key_${cleanSlug}_${require("crypto").randomBytes(32).toString("hex")}`;
    const resolvedHeaderName = auth_config?.header_name || "X-API-Key";

    const resolvedAuthConfig = {
      token: generatedBearer,
      api_key: generatedApiKey,
      header_name: resolvedHeaderName,
    };
    const resolvedAuthType = (auth_type && auth_type !== "none") ? auth_type : "bearer_and_api_key";

    const hasDbAccess = Boolean(db_access_enabled);
    let resolvedDbConfig = null;
    if (hasDbAccess && db_config) {
      const rawUri = db_config.db_uri || db_config.uri || "";
      if (!rawUri || !["mongodb","postgresql","mysql","mssql","sqlite","supabase"].includes(db_config.db_type || "mongodb")) return res.status(400).json({detail:"Valid supported database type and connection required"});
      resolvedDbConfig = {
        db_type: db_config.db_type || "mongodb",
        encrypted_uri: rawUri ? encrypt(rawUri) : null,
        masked_uri: rawUri ? maskDatabaseUri(rawUri) : null,
        db_name: db_config.db_name || null,
        configured_at: new Date(),
      };
    }

    const projectId = await getNextSequence("project");
    const project = new Project({
      id: projectId,
      name: name.trim(),
      project_code: cleanCode,
      description: description ? description.trim() : `The ${name.trim()} application API service`,
      base_url: resolvedBaseUrl,
      health_path: defaultEndpointPath,
      auth_type: resolvedAuthType,
      auth_config: resolvedAuthConfig,
      integration_mode: integration_mode || "MODE_B_DIRECT_API",
      allowed_domains: allowed_domains || ["localhost", "127.0.0.1", "0.0.0.0"],
      enable_mutating_actions: false,
      require_action_confirmation: require_action_confirmation !== undefined ? require_action_confirmation : true,
      db_access_enabled: hasDbAccess,
      db_config: resolvedDbConfig,
      company_name: req.user?.company_name || "Universal Platform",
      created_by: req.user?.username || "admin",
      is_active: true,
    });
    await project.save();

    // Default approved primary endpoint
    const createdEndpoints = [];
    if (Array.isArray(endpoints) && endpoints.length > 0) {
      for (const ep of endpoints) {
        const epId = await getNextSequence("endpoint");
        const newEp = new Endpoint({
          id: epId,
          project_id: projectId,
          name: ep.name || `${project.name} API`,
          path: ep.path || defaultEndpointPath,
          http_method: (ep.http_method || "GET").toUpperCase(),
          description: ep.description || null,
          expected_params: ep.expected_params || [],
          auth_required: ep.auth_required !== undefined ? ep.auth_required : true,
          is_approved: ep.is_approved !== undefined ? ep.is_approved : true,
          is_mutating: ep.is_mutating || ["POST", "PUT", "DELETE"].includes((ep.http_method || "").toUpperCase()),
          is_active: true,
        });
        await newEp.save();
        createdEndpoints.push(newEp);
      }
    } else {
      const epId = await getNextSequence("endpoint");
      const singleEp = new Endpoint({
        id: epId,
        project_id: projectId,
        name: `${project.name} Data API`,
        path: defaultEndpointPath,
        http_method: "GET",
        description: `Primary API endpoint for ${project.name}`,
        expected_params: [
          { name: "accessKey", type: "string", required: false, description: "Project API Key" },
        ],
        auth_required: true,
        is_approved: true,
        is_mutating: false,
        timeout_seconds: 15,
        is_active: true,
      });
      await singleEp.save();
      createdEndpoints.push(singleEp);
    }

    // Default primary intent
    const createdIntents = [];
    if (Array.isArray(intents) && intents.length > 0) {
      for (const it of intents) {
        const itId = await getNextSequence("intent");
        const newIt = new Intent({
          id: itId,
          project_id: projectId,
          endpoint_id: it.endpoint_id || (createdEndpoints[0] ? createdEndpoints[0].id : null),
          intent_name: it.intent_name,
          sample_utterances: it.sample_utterances || [],
          keywords: it.keywords || [],
          parameter_mappings: it.parameter_mappings || [],
        });
        await newIt.save();
        createdIntents.push(newIt);
      }
    } else if (createdEndpoints.length > 0) {
      const cleanName = project.name.replace(/[^a-zA-Z0-9]/g, "");
      const lowerName = project.name.toLowerCase();
      const lowerCode = project.project_code.toLowerCase();

      const ep = createdEndpoints[0];
      const itId = await getNextSequence("intent");
      const unifiedIntent = new Intent({
        id: itId,
        project_id: projectId,
        endpoint_id: ep.id,
        intent_name: `${cleanName}DataCheck`,
        description: `Check data, status, and execute operations for ${project.name}`,
        primary_phrase: `check ${lowerName} data`,
        sample_utterances: [
          `show ${lowerName} data`,
          `check ${lowerName} status`,
          `show records for ${lowerName}`,
          `fetch ${lowerName} details`,
        ],
        keywords: [lowerName, lowerCode, "data", "status", "check", "query"],
        parameter_mappings: [],
        response_template: `{message}`,
        is_active: true,
      });
      await unifiedIntent.save();
      createdIntents.push(unifiedIntent);
    }

    // Initialize initial knowledge entry
    const kId = await getNextSequence("project_knowledge");
    await ProjectKnowledge.create({
      id: kId,
      project_id: projectId,
      category: "overview",
      title: `${project.name} Overview`,
      content: project.description,
      keywords: [project.name.toLowerCase(), project.project_code.toLowerCase(), "about"],
      source: "registration",
    });

    // Sync profile to Python NLP
    await syncProjectProfileWithNLP(project);

    await AuditLog.create({
      id: await getNextSequence("audit"),
      actor_type: "admin",
      actor_id: req.user?.user_id || 1,
      project_id: projectId,
      action: "project.create",
      status: "SUCCESS",
      details: { project_code: project.project_code },
    });

    res.status(201).json({
      ...sanitizeProject(project),
      endpoints: createdEndpoints,
      intents: createdIntents,
    });
  } catch (err) {
    console.error("Register project error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/analyze - Upload ZIP, OpenAPI spec, docs, or base URL
router.post("/analyze", requireAdmin, async (req, res) => {
  try {
    const {
      project_id,
      name,
      project_code,
      base_url,
      source_type, // "zip_upload" | "openapi_spec" | "docs_import" | "base_url_probe"
      zip_base64,
      spec_content,
      spec_format = "json",
      docs_text,
      docs_filename = "README.md",
      health_path,
      integration_mode,
    } = req.body;

    let targetProject = null;

    if (project_id) {
      targetProject = await Project.findOne({ id: Number(project_id) });
      if (!targetProject) return res.status(404).json({ detail: "Project not found" });
    } else {
      if (!name || !project_code) {
        return res.status(400).json({ detail: "name and project_code are required when registering a new project." });
      }

      const cleanCode = project_code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,62}$/.test(cleanCode) || ["ASK","ANALYZE","COMPLETE","CONFIRM","HISTORY","CLEAR","SESSION"].includes(cleanCode)) return res.status(400).json({detail:"Invalid or reserved project code"});
      const existing = await Project.findOne({ project_code: cleanCode });
      if (existing) {
        targetProject = existing;
      } else {
        const cleanSlug = cleanCode.toLowerCase();
        const pId = await getNextSequence("project");
        targetProject = new Project({
          id: pId,
          name: name.trim(),
          project_code: cleanCode,
          description: `Discovered and analyzed project: ${name.trim()}`,
          base_url: (base_url || "http://localhost:8000").trim().replace(/\/+$/, ""),
          health_path: health_path || `/api/${cleanSlug}`,
          auth_type: "bearer_and_api_key",
          auth_config: {
            token: `bearer_${cleanSlug}_${Date.now()}`,
            api_key: `key_${cleanSlug}_${Date.now()}`,
            header_name: "X-API-Key",
          },
          integration_mode: integration_mode || "MODE_B_DIRECT_API",
          created_by: req.user?.username || "admin",
          is_active: true,
        });
        await targetProject.save();
      }
    }

    const analysisResult = await analyzeProject({
      projectId: targetProject.id,
      sourceType: source_type || "openapi_spec",
      zipBase64: zip_base64,
      specContent: spec_content,
      specFormat: spec_format,
      docsText: docs_text,
      docsFilename: docs_filename,
      baseUrl: base_url || targetProject.base_url,
      healthPath: health_path || targetProject.health_path,
    });

    res.json({
      success: true,
      project: sanitizeProject(targetProject),
      ...analysisResult,
    });
  } catch (err) {
    console.error("Project analyze route error:", err);
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/projects/:id/analysis - Get project analysis report
router.get("/:id/analysis", requireAdmin, async (req, res) => {
  try {
    const analysis = await ProjectAnalysis.findOne({ project_id: Number(req.params.id) });
    if (!analysis) {
      return res.status(404).json({ detail: "No static analysis record found for this project." });
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:id/reanalyze - Re-trigger project analysis
router.post("/:id/reanalyze", requireAdmin, async (req, res) => {
  try {
    const project = await Project.findOne({ id: Number(req.params.id) });
    if (!project) return res.status(404).json({ detail: "Project not found" });

    const sourceType = req.body?.source_type || "base_url_probe";
    const result = await analyzeProject({
      projectId: project.id,
      sourceType,
      zipBase64: req.body?.zip_base64,
      specContent: req.body?.spec_content,
      specFormat: req.body?.spec_format || "json",
      docsText: req.body?.docs_text,
      baseUrl: project.base_url,
      healthPath: project.health_path,
    });

    res.json({ success: true, message: "Project re-analyzed successfully.", ...result });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/projects/:id/knowledge - List knowledge base chunks
router.get("/:id/knowledge", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const category = req.query.category || null;
    const items = await listProjectKnowledge(projectId, category);
    const staleness = await checkKnowledgeStaleness(projectId);

    res.json({
      project_id: projectId,
      total: items.length,
      staleness,
      items,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:id/knowledge - Add a custom knowledge item
router.post("/:id/knowledge", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { category, title, content, keywords } = req.body;

    if (!title || !content) {
      return res.status(400).json({ detail: "title and content are required." });
    }

    const created = await addKnowledgeItem(projectId, {
      category: category || "custom",
      title,
      content,
      keywords,
      source: "admin_manual",
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// PUT /api/projects/:id/knowledge/:knowledgeId - Update knowledge item
router.put("/:id/knowledge/:knowledgeId", requireAdmin, async (req, res) => {
  try {
    const updated = await updateKnowledgeItem(req.params.id, req.params.knowledgeId, req.body);
    if (!updated) return res.status(404).json({ detail: "Knowledge item not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/projects/:id/knowledge/:knowledgeId - Delete knowledge item
router.delete("/:id/knowledge/:knowledgeId", requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteKnowledgeItem(req.params.id, req.params.knowledgeId);
    if (!deleted) return res.status(404).json({ detail: "Knowledge item not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:id/endpoints/:endpointId/approve - Approve or disapprove discovered endpoint
router.post("/:id/endpoints/:endpointId/approve", requireAdmin, async (req, res) => {
  try {
    const { is_approved = true } = req.body;
    const ep = await Endpoint.findOneAndUpdate(
      { id: Number(req.params.endpointId), project_id: Number(req.params.id) },
      { $set: { is_approved: Boolean(is_approved), updated_at: new Date() } },
      { new: true }
    );
    if (!ep) return res.status(404).json({ detail: "Endpoint not found" });
    res.json({ success: true, endpoint: ep });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/projects/:id - Project detail
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const project = await Project.findOne({ id: Number(req.params.id) });
    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const endpoints = await Endpoint.find({ project_id: project.id });
    const intents = await Intent.find({ project_id: project.id });
    const analysis = await ProjectAnalysis.findOne({ project_id: project.id });

    res.json({
      ...sanitizeProject(project),
      endpoints,
      intents,
      analysis,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      base_url,
      health_path,
      auth_type,
      auth_config,
      integration_mode,
      allowed_domains,
      enable_mutating_actions,
      require_action_confirmation,
      llm_config,
      db_access_enabled,
      db_config,
    } = req.body;

    const updateSet = {
      name: name ? name.trim() : undefined,
      description: description !== undefined ? description : undefined,
      base_url: base_url ? base_url.trim().replace(/\/+$/, "") : undefined,
      health_path: health_path !== undefined ? health_path : undefined,
      auth_type: auth_type || undefined,
      auth_config: auth_config !== undefined ? auth_config : undefined,
      integration_mode: integration_mode || undefined,
      allowed_domains: allowed_domains || undefined,
      enable_mutating_actions: enable_mutating_actions !== undefined ? enable_mutating_actions : undefined,
      require_action_confirmation: require_action_confirmation !== undefined ? require_action_confirmation : undefined,
      llm_config: llm_config !== undefined ? llm_config : undefined,
      updated_at: new Date(),
    };

    if (db_access_enabled !== undefined) {
      updateSet.db_access_enabled = Boolean(db_access_enabled);
      if (db_access_enabled && db_config) {
        const rawUri = db_config.db_uri || db_config.uri;
        if (!rawUri || !["mongodb","postgresql","mysql","mssql","sqlite","supabase"].includes(db_config.db_type || "mongodb")) return res.status(400).json({detail:"Valid supported database type and connection required"});
        updateSet.db_config = {
          db_type: db_config.db_type || "mongodb",
          encrypted_uri: rawUri ? encrypt(rawUri) : undefined,
          masked_uri: rawUri ? maskDatabaseUri(rawUri) : undefined,
          db_name: db_config.db_name || undefined,
          updated_at: new Date(),
        };
      } else if (!db_access_enabled) {
        updateSet.db_config = null;
      }
    }

    const project = await Project.findOneAndUpdate(
      { id: Number(req.params.id) },
      { $set: updateSet },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    res.json(sanitizeProject(project));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// PATCH /api/projects/:id/status
router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    const project = await Project.findOneAndUpdate(
      { id: Number(req.params.id) },
      { $set: { is_active: !!is_active, updated_at: new Date() } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const project = await Project.findOneAndDelete({ id: projectId });
    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    await Endpoint.deleteMany({ project_id: projectId });
    await Intent.deleteMany({ project_id: projectId });
    await ProjectAnalysis.deleteMany({ project_id: projectId });
    await ProjectKnowledge.deleteMany({ project_id: projectId });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:id/test-connection
router.post("/:id/test-connection", requireAdmin, async (req, res) => {
  try {
    const project = await Project.findOne({ id: Number(req.params.id) });
    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const testUrl = `${project.base_url}${project.health_path || "/health"}`;
    const startTime = Date.now();

    const headers = {
      Accept: "application/json",
      "User-Agent": "Universal-Chatbot-Platform/2.0",
    };
    if (project.auth_type === "bearer" || project.auth_type === "bearer_and_api_key" || project.auth_config?.token) {
      const token = project.auth_config?.token || project.auth_config?.bearer_token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    if (project.auth_type === "api_key" || project.auth_type === "bearer_and_api_key" || project.auth_config?.api_key) {
      const apiKey = project.auth_config?.api_key || project.auth_config?.apiKey;
      const headerName = project.auth_config?.header_name || "X-API-Key";
      if (apiKey) headers[headerName] = apiKey;
    }

    try {
      const response = await axios.get(testUrl, {
        headers,
        timeout: 6000,
        validateStatus: () => true,
      });
      const latencyMs = Date.now() - startTime;
      res.json({
        reachable: response.status >= 200 && response.status < 400,
        status_code: response.status,
        latency_ms: latencyMs,
        tested_url: testUrl,
        auth_type: project.auth_type,
        auth_sent: project.auth_type !== "none",
        message:
          response.status >= 200 && response.status < 400
            ? "Service healthy and reachable."
            : `Status code ${response.status}`,
      });
    } catch (testErr) {
      res.json({
        reachable: false,
        status_code: null,
        latency_ms: null,
        tested_url: testUrl,
        message: testErr.message,
      });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:id/credentials
router.post("/:id/credentials", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { username, password, description } = req.body;

    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return res.status(404).json({ detail: "Project not found" });
    }

    const user = new User({
      id: await getNextSequence("user"),
      username: username.trim(),
      email: `${username.trim()}@client.project`,
      password_hash: await require("bcryptjs").hash(password, 10),
      role: "client",
      company_name: project.name,
      company_details: description,
      is_active: true,
    });
    await user.save();

    res.status(201).json({
      id: user.id,
      project_id: projectId,
      username: user.username,
      description,
      is_active: true,
      created_at: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
