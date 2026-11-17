const mongoose = require("mongoose");

const projectKnowledgeSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    category: {
      type: String,
      enum: ["overview", "module", "workflow", "faq", "api_doc", "entity", "doc_chunk", "custom"],
      default: "doc_chunk",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    keywords: { type: [String], default: [] },
    source: { type: String, default: "auto_analysis" },
    version: { type: Number, default: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "project_knowledge" }
);

// Compound text index for search
projectKnowledgeSchema.index({ project_id: 1, title: "text", content: "text", keywords: "text" });

module.exports = mongoose.model("ProjectKnowledge", projectKnowledgeSchema);
