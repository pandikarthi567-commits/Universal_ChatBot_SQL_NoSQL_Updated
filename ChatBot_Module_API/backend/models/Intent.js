const mongoose = require("mongoose");

const intentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    endpoint_id: { type: Number, default: null },
    intent_name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    primary_phrase: { type: String, default: null },
    sample_utterances: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    parameter_mappings: { type: Array, default: [] },
    response_template: { type: String, default: null },
    is_active: { type: Boolean, default: true },

    // Universal Platform Extensions
    confidence_threshold: { type: Number, default: 0.40 },
    operation_id: { type: String, default: null },
    requires_confirmation: { type: Boolean, default: false },
    action_type: { type: String, enum: ["READ", "WRITE", "EXTERNAL"], default: "READ" },
    suggested_clarifications: { type: [String], default: [] },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "intents" }
);

module.exports = mongoose.model("Intent", intentSchema);
