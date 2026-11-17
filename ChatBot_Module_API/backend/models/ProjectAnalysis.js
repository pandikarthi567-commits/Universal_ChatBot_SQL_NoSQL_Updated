const mongoose = require("mongoose");

const projectAnalysisSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    source_type: {
      type: String,
      enum: ["zip_upload", "openapi_spec", "docs_import", "base_url_probe", "manual"],
      default: "manual",
    },
    tech_stack: {
      language: { type: String, default: "unknown" },
      framework: { type: String, default: "unknown" },
      database_type: { type: String, default: "unknown" },
      auth_type: { type: String, default: "none" },
    },
    modules: [
      {
        name: { type: String, required: true },
        description: { type: String, default: "" },
        file_paths: { type: [String], default: [] },
      },
    ],
    business_entities: [
      {
        name: { type: String, required: true },
        description: { type: String, default: "" },
        fields: [
          {
            name: { type: String, required: true },
            type: { type: String, default: "string" },
            required: { type: Boolean, default: false },
          },
        ],
      },
    ],
    database_models: [
      {
        model_name: { type: String, required: true },
        fields: { type: mongoose.Schema.Types.Mixed, default: {} },
        relationships: { type: [String], default: [] },
      },
    ],
    routes_discovered: [
      {
        path: { type: String, required: true },
        method: { type: String, default: "GET" },
        handler: { type: String, default: "" },
        file_path: { type: String, default: "" },
        params: { type: Array, default: [] },
        is_mutating: { type: Boolean, default: false },
        auth_required: { type: Boolean, default: false },
        auth_roles: { type: [String], default: [] },
      },
    ],
    workflows: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        steps: { type: [String], default: [] },
      },
    ],
    candidate_intents: [
      {
        intent_name: { type: String, required: true },
        action_type: { type: String, default: "READ" },
        suggested_utterances: { type: [String], default: [] },
        keywords: { type: [String], default: [] },
        endpoint_path: { type: String, default: "" },
        http_method: { type: String, default: "GET" },
      },
    ],
    verified_items: [
      {
        category: { type: String, required: true },
        item: { type: String, required: true },
        evidence: { type: String, default: "" },
      },
    ],
    inferred_items: [
      {
        category: { type: String, required: true },
        item: { type: String, required: true },
        confidence: { type: Number, default: 0.8 },
        rationale: { type: String, default: "" },
      },
    ],
    stats: {
      total_files: { type: Number, default: 0 },
      lines_of_code: { type: Number, default: 0 },
      routes_count: { type: Number, default: 0 },
      models_count: { type: Number, default: 0 },
      intents_count: { type: Number, default: 0 },
    },
    version: { type: Number, default: 1 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "project_analyses" }
);

module.exports = mongoose.model("ProjectAnalysis", projectAnalysisSchema);
