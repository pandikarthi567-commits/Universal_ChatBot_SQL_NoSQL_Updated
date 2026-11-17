const ProjectKnowledge = require("../models/ProjectKnowledge");
const Project = require("../models/Project");
const { getNextSequence } = require("../models/Counter");

/**
 * Searches the project's isolated knowledge base using weighted token and keyword matching.
 */
async function searchProjectKnowledge({ projectId, query, limit = 4, minScore = 0.25 }) {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").trim();
  const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 1);

  if (tokens.length === 0) return [];

  // Strictly isolate by project_id
  const items = await ProjectKnowledge.find({
    project_id: Number(projectId),
    is_active: true,
  });

  const scoredItems = [];

  for (const item of items) {
    let score = 0;
    const titleLower = (item.title || "").toLowerCase();
    const contentLower = (item.content || "").toLowerCase();
    const keywords = (item.keywords || []).map((k) => k.toLowerCase());

    // 1. Exact phrase match in title or content
    if (titleLower.includes(cleanQuery)) score += 0.8;
    else if (contentLower.includes(cleanQuery)) score += 0.5;

    // 2. Token overlap
    let matchedTokens = 0;
    for (const t of tokens) {
      if (titleLower.includes(t)) {
        score += 0.35;
        matchedTokens++;
      } else if (keywords.includes(t)) {
        score += 0.30;
        matchedTokens++;
      } else if (contentLower.includes(t)) {
        score += 0.15;
        matchedTokens++;
      }
    }

    // Category weighting
    if (item.category === "faq") score += 0.1;
    if (item.category === "overview" && (cleanQuery.includes("what is") || cleanQuery.includes("about"))) score += 0.2;

    const tokenRatio = tokens.length > 0 ? matchedTokens / tokens.length : 0;
    const normalizedScore = Math.min(1.0, score * 0.5 + tokenRatio * 0.5);

    if (normalizedScore >= minScore) {
      scoredItems.push({
        id: item.id,
        category: item.category,
        title: item.title,
        content: item.content,
        source: item.source,
        score: Math.round(normalizedScore * 100) / 100,
        version: item.version,
      });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, limit);
}

/**
 * List all knowledge items for a project
 */
async function listProjectKnowledge(projectId, category = null) {
  const filter = { project_id: Number(projectId), is_active: true };
  if (category) filter.category = category;
  return ProjectKnowledge.find(filter).sort({ category: 1, created_at: -1 });
}

/**
 * Add a new knowledge item
 */
async function addKnowledgeItem(projectId, { category = "custom", title, content, keywords = [], source = "manual" }) {
  const id = await getNextSequence("project_knowledge");
  const item = new ProjectKnowledge({
    id,
    project_id: Number(projectId),
    category,
    title: title.trim(),
    content: content.trim(),
    keywords: keywords || [],
    source,
    is_active: true,
  });
  return item.save();
}

/**
 * Update a knowledge item
 */
async function updateKnowledgeItem(projectId, knowledgeId, updateData) {
  return ProjectKnowledge.findOneAndUpdate(
    { id: Number(knowledgeId), project_id: Number(projectId) },
    { $set: { ...updateData, updated_at: new Date() } },
    { new: true }
  );
}

/**
 * Delete a knowledge item
 */
async function deleteKnowledgeItem(projectId, knowledgeId) {
  return ProjectKnowledge.findOneAndDelete({
    id: Number(knowledgeId),
    project_id: Number(projectId),
  });
}

/**
 * Check if project knowledge is stale relative to project updates
 */
async function checkKnowledgeStaleness(projectId) {
  const project = await Project.findOne({ id: Number(projectId) });
  if (!project) return { is_stale: false, reason: "Project not found" };

  const latestKnowledge = await ProjectKnowledge.findOne({ project_id: Number(projectId) }).sort({ updated_at: -1 });
  if (!latestKnowledge) {
    return { is_stale: true, reason: "No knowledge base generated yet." };
  }

  const lastAnalysis = project.metadata?.last_analyzed_at ? new Date(project.metadata.last_analyzed_at) : null;
  const projectUpdated = project.updated_at ? new Date(project.updated_at) : null;

  if (projectUpdated && lastAnalysis && projectUpdated > lastAnalysis) {
    return {
      is_stale: true,
      reason: "Project configurations were updated after the last knowledge analysis.",
      last_analyzed_at: lastAnalysis,
      project_updated_at: projectUpdated,
    };
  }

  return { is_stale: false, last_analyzed_at: lastAnalysis };
}

module.exports = {
  searchProjectKnowledge,
  listProjectKnowledge,
  addKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  checkKnowledgeStaleness,
};
