const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    session_id: { type: String, required: true, index: true },
    project_id: { type: Number, required: true, index: true },
    project_name: { type: String, default: null, index: true },
    project_code: { type: String, default: null, index: true },
    user_id: { type: Number, default: null },
    role: { type: String, required: true, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true },
    question: { type: String, default: null },
    answer: { type: String, default: null },
    detected_intent: { type: String, default: null },
    confidence: { type: Number, default: null },
    endpoint_called: { type: String, default: null },
    endpoint_path: { type: String, default: null },
    status: { type: String, default: "SUCCESS" },
    raw_response: { type: mongoose.Schema.Types.Mixed, default: null },

    // Universal Platform Extensions
    response_type: {
      type: String,
      enum: [
        "DIRECT_ANSWER",
        "KNOWLEDGE_ANSWER",
        "LIVE_API",
        "API_REQUIRED",
        "ACTION_CONFIRMATION",
        "CLARIFICATION_REQUIRED",
        "AUTH_REQUIRED",
        "ACCESS_DENIED",
        "OUT_OF_SCOPE",
        "ERROR",
      ],
      default: "DIRECT_ANSWER",
    },
    source: { type: String, default: "grounded_engine" },
    correlation_id: { type: String, default: null, index: true },
    entities: { type: mongoose.Schema.Types.Mixed, default: {} },

    created_at: { type: Date, default: Date.now },
  },
  { collection: "chat_history" }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
