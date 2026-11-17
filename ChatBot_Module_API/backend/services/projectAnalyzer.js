const axios = require("axios");
const Project = require("../models/Project");
const ProjectAnalysis = require("../models/ProjectAnalysis");
const ProjectKnowledge = require("../models/ProjectKnowledge");
const Endpoint = require("../models/Endpoint");
const Intent = require("../models/Intent");
const { getNextSequence } = require("../models/Counter");

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001";

/**
 * Analyzes project code, specification, docs or base URL.
 * Populates ProjectAnalysis, ProjectKnowledge, Endpoints, and Intents.
 */
async function analyzeProject({
  projectId,
  sourceType = "openapi_spec",
  zipBase64 = null,
  specContent = null,
  specFormat = "json",
  docsText = null,
  docsFilename = "README.md",
  baseUrl = null,
  healthPath = null,
}) {
  const project = await Project.findOne({ id: Number(projectId) });
  if (!project) throw new Error(`Project with ID ${projectId} not found.`);

  project.analysis_status = "analyzing";
  await project.save();

  let analysisData = null;

  try {
    if (sourceType === "zip_upload" && zipBase64) {
      const resp = await axios.post(
        `${PYTHON_NLP_URL}/api/analyzer/analyze-zip`,
        { zip_base64: zipBase64, project_name: project.name },
        { timeout: 35000 }
      );
      analysisData = resp.data.analysis;
    } else if (sourceType === "openapi_spec" && specContent) {
      const resp = await axios.post(
        `${PYTHON_NLP_URL}/api/analyzer/analyze-spec`,
        { spec_content: specContent, format: specFormat },
        { timeout: 15000 }
      );
      analysisData = resp.data.analysis;
    } else if (sourceType === "docs_import" && docsText) {
      const resp = await axios.post(
        `${PYTHON_NLP_URL}/api/analyzer/analyze-docs`,
        { docs_text: docsText, filename: docsFilename },
        { timeout: 15000 }
      );
      analysisData = {
        tech_stack: { language: "Documentation", framework: "Markdown", database_type: "Docs", auth_type: "none" },
        modules: [],
        routes_discovered: [],
        database_models: [],
        doc_chunks: resp.data.chunks || [],
        candidate_intents: [],
        verified_items: [{ category: "Document", item: docsFilename, evidence: "User documentation upload" }],
        inferred_items: [],
        stats: { total_files: 1, lines_of_code: docsText.split("\n").length, routes_count: 0, models_count: 0, intents_count: 0 },
      };
    } else if (sourceType === "base_url_probe" && baseUrl) {
      const resp = await axios.post(
        `${PYTHON_NLP_URL}/api/analyzer/probe-url`,
        { base_url: baseUrl, health_path: healthPath },
        { timeout: 15000 }
      );
      const probe = resp.data.probe;
      if (probe.discovered_spec) {
        analysisData = probe.discovered_spec;
      } else {
        analysisData = {
          tech_stack: { language: "Web API", framework: "HTTP Service", database_type: "Remote API", auth_type: project.auth_type || "none" },
          modules: [{ name: "Health", description: "Health check module", file_paths: [] }],
          routes_discovered: [
            {
              path: healthPath || "/health",
              method: "GET",
              handler: "healthCheck",
              params: [],
              is_mutating: false,
              auth_required: false,
            },
          ],
          database_models: [],
          doc_chunks: [],
          candidate_intents: [
            {
              intent_name: `${project.project_code}_HealthCheck`,
              action_type: "READ",
              suggested_utterances: ["check health", "is service online", "api status"],
              keywords: ["health", "status", "online"],
              endpoint_path: healthPath || "/health",
              http_method: "GET",
            },
          ],
          verified_items: [{ category: "Endpoint", item: healthPath || "/health", evidence: `Probed ${baseUrl}` }],
          inferred_items: [],
          stats: { total_files: 1, lines_of_code: 0, routes_count: 1, models_count: 0, intents_count: 1 },
        };
      }
    } else {
      throw new Error(`Invalid source_type '${sourceType}' or missing payload.`);
    }

    // 1. Save or update ProjectAnalysis
    let analysisRecord = await ProjectAnalysis.findOne({ project_id: project.id });
    const analysisId = analysisRecord ? analysisRecord.id : await getNextSequence("project_analysis");

    const analysisPayload = {
      id: analysisId,
      project_id: project.id,
      source_type: sourceType,
      tech_stack: analysisData.tech_stack || {},
      modules: analysisData.modules || [],
      business_entities: analysisData.business_entities || [],
      database_models: analysisData.database_models || [],
      routes_discovered: analysisData.routes_discovered || [],
      workflows: analysisData.workflows || [],
      candidate_intents: analysisData.candidate_intents || [],
      verified_items: analysisData.verified_items || [],
      inferred_items: analysisData.inferred_items || [],
      stats: analysisData.stats || {},
      version: (project.knowledge_version || 1) + 1,
      updated_at: new Date(),
    };

    if (analysisRecord) {
      Object.assign(analysisRecord, analysisPayload);
      await analysisRecord.save();
    } else {
      analysisRecord = await ProjectAnalysis.create(analysisPayload);
    }

    // 2. Generate and store knowledge items in ProjectKnowledge
    // Clear old auto-generated knowledge for this project
    await ProjectKnowledge.deleteMany({ project_id: project.id, source: "auto_analysis" });

    const knowledgeEntries = [];
    // Overview chunk
    const overviewId = await getNextSequence("project_knowledge");
    knowledgeEntries.push({
      id: overviewId,
      project_id: project.id,
      category: "overview",
      title: `${project.name} Overview`,
      content: project.description || `Application ${project.name} built with ${analysisData.tech_stack?.framework || 'Modern Tech Stack'}.`,
      keywords: [project.name.toLowerCase(), project.project_code.toLowerCase(), "overview", "about"],
      source: "auto_analysis",
      version: analysisRecord.version,
    });

    // Modules chunks
    for (const mod of analysisData.modules || []) {
      const kId = await getNextSequence("project_knowledge");
      knowledgeEntries.push({
        id: kId,
        project_id: project.id,
        category: "module",
        title: `Module: ${mod.name}`,
        content: `Module ${mod.name}: ${mod.description || 'Provides core application capabilities.'}`,
        keywords: [mod.name.toLowerCase(), "module", "feature"],
        source: "auto_analysis",
        version: analysisRecord.version,
      });
    }

    // Doc chunks
    for (const chunk of analysisData.doc_chunks || []) {
      const kId = await getNextSequence("project_knowledge");
      knowledgeEntries.push({
        id: kId,
        project_id: project.id,
        category: "doc_chunk",
        title: chunk.title,
        content: chunk.content,
        keywords: chunk.title.toLowerCase().split(/\s+/).filter(Boolean),
        source: chunk.source || "documentation",
        version: analysisRecord.version,
      });
    }

    if (knowledgeEntries.length > 0) {
      await ProjectKnowledge.insertMany(knowledgeEntries);
    }

    // 3. Register Discovered Endpoints (with is_approved: false by default for admin review)
    const existingEndpoints = await Endpoint.find({ project_id: project.id });
    const existingPaths = new Set(existingEndpoints.map((e) => `${e.http_method}:${e.path}`));

    for (const r of analysisData.routes_discovered || []) {
      const key = `${r.method}:${r.path}`;
      if (!existingPaths.has(key)) {
        const epId = await getNextSequence("endpoint");
        await Endpoint.create({
          id: epId,
          project_id: project.id,
          name: r.summary || `${r.method} ${r.path}`,
          path: r.path,
          http_method: r.method,
          description: r.summary || `Discovered ${r.method} route`,
          summary: r.summary || null,
          expected_params: r.params || [],
          auth_required: r.auth_required !== undefined ? r.auth_required : true,
          auth_roles: r.auth_roles || [],
          is_approved: false, // Explicit approval required by admin
          is_mutating: r.is_mutating || ["POST", "PUT", "DELETE", "PATCH"].includes(r.method),
          operation_id: r.operation_id || null,
          request_schema: r.request_schema || null,
          response_schema: r.response_schema || null,
          is_active: true,
        });
        existingPaths.add(key);
      }
    }

    // 4. Register Candidate Intents
    const existingIntents = await Intent.find({ project_id: project.id });
    const existingIntentNames = new Set(existingIntents.map((it) => it.intent_name));

    for (const cand of analysisData.candidate_intents || []) {
      if (!existingIntentNames.has(cand.intent_name)) {
        const itId = await getNextSequence("intent");
        const matchedEp = await Endpoint.findOne({
          project_id: project.id,
          path: cand.endpoint_path,
          http_method: cand.http_method,
        });

        await Intent.create({
          id: itId,
          project_id: project.id,
          endpoint_id: matchedEp ? matchedEp.id : null,
          intent_name: cand.intent_name,
          description: `Discovered intent for ${cand.http_method} ${cand.endpoint_path}`,
          primary_phrase: cand.suggested_utterances[0] || cand.intent_name,
          sample_utterances: cand.suggested_utterances || [],
          keywords: cand.keywords || [],
          action_type: cand.action_type || (["POST", "PUT", "DELETE"].includes(cand.http_method) ? "WRITE" : "READ"),
          requires_confirmation: ["POST", "PUT", "DELETE"].includes(cand.http_method),
          confidence_threshold: 0.40,
          is_active: true,
        });
        existingIntentNames.add(cand.intent_name);
      }
    }

    // 5. Update Project record
    project.analysis_status = "completed";
    project.knowledge_version = analysisRecord.version;
    project.metadata = {
      ...(project.metadata || {}),
      tech_stack: analysisData.tech_stack,
      stats: analysisData.stats,
      last_analyzed_at: new Date(),
    };
    await project.save();

    // 6. Build and sync profile with Python NLP microservice
    await syncProjectProfileWithNLP(project);

    return {
      success: true,
      analysis: analysisRecord,
      knowledge_items_created: knowledgeEntries.length,
      endpoints_discovered: (analysisData.routes_discovered || []).length,
      intents_created: (analysisData.candidate_intents || []).length,
    };
  } catch (err) {
    project.analysis_status = "failed";
    await project.save();
    console.error(`Project analysis error for ${project.project_code}:`, err.message);
    throw err;
  }
}

/**
 * Builds a dynamic ProjectProfile from MongoDB data and registers it in Python NLP service.
 */
async function syncProjectProfileWithNLP(project) {
  try {
    const intents = await Intent.find({ project_id: project.id, is_active: true });
    const endpoints = await Endpoint.find({ project_id: project.id, is_active: true });

    const intentSpecs = intents.map((it) => ({
      name: it.intent_name,
      description: it.description || "",
      examples: it.sample_utterances || [],
      entities_expected: (it.parameter_mappings || []).map((m) => m.entity_name || m.name).filter(Boolean),
    }));

    // Add standard Greeting intent if not present
    if (!intentSpecs.some((it) => it.name.toLowerCase() === "greeting")) {
      intentSpecs.unshift({
        name: "Greeting",
        description: "Small talk greeting",
        examples: [
          "hi",
          "hello",
          "hey",
          "good morning",
          "good afternoon",
          "good evening",
          "vanakkam",
          "hello there",
        ],
        entities_expected: [],
      });
    }

    const profileData = {
      project_code: project.project_code.toUpperCase(),
      modules: (project.metadata?.modules || []).map((m) => m.name || m),
      language_hints: ["en", "ta-Latn", "ta"],
      thresholds: {
        intent: 0.40,
        entity_fuzzy: 0.85,
      },
      normalization_lexicon: {
        price: "price",
        vilai: "price",
        rate: "price",
        cost: "price",
        irukka: "available",
        available: "available",
        stock: "stock",
        mudinjathu: "expired",
        theerthathu: "expired",
      },
      intents: intentSpecs,
      entity_types: [
        {
          name: "ItemName",
          kind: "gazetteer",
          priority: 1,
          values: [],
        },
        {
          name: "Quantity",
          kind: "pattern",
          regex: "\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|[0-9]{1,4})\\b",
          priority: 2,
        },
        {
          name: "EntityId",
          kind: "pattern",
          regex: "\\b[A-Z]{2,4}[-_]?[0-9]{3,10}\\b",
          priority: 3,
        },
      ],
    };

    await axios.put(`${PYTHON_NLP_URL}/admin/profile/${project.project_code.toUpperCase()}`, profileData, {
      timeout: 10000,
    });
  } catch (err) {
    console.warn(`Could not sync profile to Python NLP: ${err.message}`);
  }
}

module.exports = {
  analyzeProject,
  syncProjectProfileWithNLP,
};
