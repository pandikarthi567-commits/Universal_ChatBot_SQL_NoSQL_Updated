const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    project_code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    base_url: { type: String, required: true, trim: true },
    health_path: { type: String, default: null },
    auth_type: { type: String, default: "none" },
    auth_config: { type: mongoose.Schema.Types.Mixed, default: null },
    db_access_enabled: { type: Boolean, default: false },
    db_config: { type: mongoose.Schema.Types.Mixed, default: null },
    company_name: { type: String, default: null },
    created_by: { type: String, default: null },
    is_active: { type: Boolean, default: true },

    // Universal Chatbot Platform Extensions
    integration_mode: {
      type: String,
      enum: ["MODE_A_KNOWLEDGE", "MODE_B_DIRECT_API", "MODE_C_EXTERNAL"],
      default: "MODE_B_DIRECT_API",
    },
    analysis_status: {
      type: String,
      enum: ["uninitialized", "pending", "analyzing", "completed", "failed"],
      default: "uninitialized",
    },
    knowledge_version: { type: Number, default: 1 },
    allowed_domains: {
      type: [String],
      default: ["localhost", "127.0.0.1", "0.0.0.0"],
    },
    enable_mutating_actions: { type: Boolean, default: true },
    require_action_confirmation: { type: Boolean, default: true },
    llm_config: {
      provider: { type: String, enum: ["none", "ollama", "openai", "gemini"], default: "none" },
      model_name: { type: String, default: "llama3" },
      api_base_url: { type: String, default: "http://localhost:11434" },
      api_key_encrypted: { type: String, default: null },
      temperature: { type: Number, default: 0.3 },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "projects" }
);

module.exports = mongoose.model("Project", projectSchema);
