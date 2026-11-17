const express = require("express");
const Intent = require("../models/Intent");
const { getNextSequence } = require("../models/Counter");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/intents
router.get("/", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const intents = await Intent.find({ project_id: projectId });
    res.json(intents);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/projects/:projectId/intents
router.post("/", requireAdmin, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { endpoint_id, intent_name, description, primary_phrase, sample_utterances, keywords, parameter_mappings, response_template } = req.body;

    const id = await getNextSequence("intent");
    const intent = new Intent({
      id,
      project_id: projectId,
      endpoint_id: Number(endpoint_id),
      intent_name: intent_name.trim(),
      description: description || null,
      primary_phrase: primary_phrase || null,
      sample_utterances: sample_utterances || [],
      keywords: keywords || [],
      parameter_mappings: parameter_mappings || [],
      response_template: response_template || null,
      is_active: true,
    });
    await intent.save();

    res.status(201).json(intent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// GET /api/projects/:projectId/intents/:intentId
router.get("/:intentId", requireAdmin, async (req, res) => {
  try {
    const intent = await Intent.findOne({
      id: Number(req.params.intentId),
      project_id: Number(req.params.projectId),
    });
    if (!intent) return res.status(404).json({ detail: "Intent not found" });
    res.json(intent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// PUT /api/projects/:projectId/intents/:intentId
router.put("/:intentId", requireAdmin, async (req, res) => {
  try {
    const intent = await Intent.findOneAndUpdate(
      { id: Number(req.params.intentId), project_id: Number(req.params.projectId) },
      { $set: { ...req.body, updated_at: new Date() } },
      { new: true }
    );
    if (!intent) return res.status(404).json({ detail: "Intent not found" });
    res.json(intent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/projects/:projectId/intents/:intentId
router.delete("/:intentId", requireAdmin, async (req, res) => {
  try {
    await Intent.findOneAndDelete({
      id: Number(req.params.intentId),
      project_id: Number(req.params.projectId),
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;

