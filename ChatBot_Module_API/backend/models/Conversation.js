const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    session_id: { type: String, required: true, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    user_id: { type: Number, default: null },
    context: {
      last_intent: { type: String, default: null },
      last_entities: { type: mongoose.Schema.Types.Mixed, default: {} },
      active_entity_reference: {
        type: { type: String, default: null }, // e.g. "product", "medicine", "order", "candidate"
        name: { type: String, default: null }, // e.g. "Dolo 650", "iPhone 15"
        id: { type: String, default: null },
        attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
      pending_parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
      target_endpoint_id: { type: Number, default: null },
      target_intent_name: { type: String, default: null },
      recent_results: { type: Array, default: [] },
      clarification_prompt: { type: String, default: null },
    },
    message_count: { type: Number, default: 0 },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
      index: { expires: 0 }, // TTL index
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "conversations" }
);

module.exports = mongoose.model("Conversation", conversationSchema);
