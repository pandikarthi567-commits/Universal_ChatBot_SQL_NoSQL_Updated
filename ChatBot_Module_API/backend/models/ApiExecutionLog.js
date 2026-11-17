const mongoose = require("mongoose");

const apiExecutionLogSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    session_id: { type: String, default: null, index: true },
    user_id: { type: Number, default: null },
    endpoint_url: { type: String, required: true },
    endpoint_path: { type: String, default: null },
    http_method: { type: String, required: true },
    status_code: { type: Number, default: 0 },
    latency_ms: { type: Number, default: 0 },
    success: { type: Boolean, default: false },
    request_params_masked: { type: mongoose.Schema.Types.Mixed, default: {} },
    response_summary: { type: String, default: null },
    error_detail: { type: String, default: null },
    created_at: { type: Date, default: Date.now, index: true },
  },
  { collection: "api_execution_logs" }
);

module.exports = mongoose.model("ApiExecutionLog", apiExecutionLogSchema);
