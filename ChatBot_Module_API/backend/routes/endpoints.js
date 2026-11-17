const express = require("express");
const Endpoint = require("../models/Endpoint");
const Intent = require("../models/Intent");
const { getNextSequence } = require("../models/Counter");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/endpoints
router.get("/", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const endpoints = await Endpoint.find({ project_id: projectId });
    res.json(endpoints);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:projectId/endpoints
router.post("/", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { name, path, http_method, description, summary, expected_params, auth_required, timeout_seconds, response_root_key } = req.body;

    const id = await getNextSequence("endpoint");
    const endpoint = new Endpoint({
      id,
      project_id: projectId,
      name: name.trim(),
      path: path.trim(),
      http_method: (http_method || "GET").toUpperCase(),
      description: description || null,
      summary: summary || null,
      expected_params: expected_params || [],
      auth_required: auth_required !== undefined ? auth_required : true,
      timeout_seconds: timeout_seconds || 15,
      response_root_key: response_root_key || null,
      is_active: true,
    });
    await endpoint.save();

    res.status(201).json(endpoint);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/projects/:projectId/endpoints/:endpointId
router.get("/:endpointId", requireAdmin, async (req, res) => {
  try {
    const endpoint = await Endpoint.findOne({
      id: Number(req.params.endpointId),
      project_id: Number(req.params.projectId),
    });
    if (!endpoint) return res.status(404).json({ detail: "Endpoint not found" });
    res.json(endpoint);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// PUT /api/projects/:projectId/endpoints/:endpointId
router.put("/:endpointId", requireAdmin, async (req, res) => {
  try {
    const endpoint = await Endpoint.findOneAndUpdate(
      { id: Number(req.params.endpointId), project_id: Number(req.params.projectId) },
      { $set: { ...req.body, updated_at: new Date() } },
      { new: true }
    );
    if (!endpoint) return res.status(404).json({ detail: "Endpoint not found" });
    res.json(endpoint);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/projects/:projectId/endpoints/:endpointId
router.delete("/:endpointId", requireAdmin, async (req, res) => {
  try {
    const endpointId = Number(req.params.endpointId);
    await Endpoint.findOneAndDelete({ id: endpointId, project_id: Number(req.params.projectId) });
    await Intent.deleteMany({ endpoint_id: endpointId });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;

