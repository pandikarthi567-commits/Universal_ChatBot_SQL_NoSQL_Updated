const mongoose = require("mongoose");

const pendingActionSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    correlation_id: { type: String, required: true, unique: true, index: true },
    session_id: { type: String, required: true, index: true },
    project_id: { type: Number, required: true, index: true },
    user_id: { type: Number, default: null },
    action_type: {
      type: String,
      enum: ["MUTATING_EXECUTION", "EXTERNAL_COMPLETION"],
      default: "MUTATING_EXECUTION",
    },
    operation: { type: String, required: true }, // e.g. "ADD_TO_CART", "SUBMIT_ORDER"
    endpoint_id: { type: Number, default: null },
    endpoint_url: { type: String, default: null },
    http_method: { type: String, default: "POST" },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary_message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    execution_result: { type: mongoose.Schema.Types.Mixed, default: null },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes TTL
      index: { expires: 0 },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "pending_actions" }
);

module.exports = mongoose.model("PendingAction", pendingActionSchema);
