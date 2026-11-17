const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    actor_type: { type: String, default: "admin" },
    actor_id: { type: Number, default: null },
    project_id: { type: Number, default: null },
    endpoint_id: { type: Number, default: null },
    action: { type: String, required: true },
    status: { type: String, default: "SUCCESS" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip_address: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "audit_logs" }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);

