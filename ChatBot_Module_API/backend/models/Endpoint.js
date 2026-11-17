const mongoose = require("mongoose");

const endpointSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    http_method: { type: String, default: "GET", uppercase: true },
    description: { type: String, default: null },
    summary: { type: String, default: null },
    expected_params: { type: Array, default: [] },
    auth_required: { type: Boolean, default: true },
    timeout_seconds: { type: Number, default: 15 },
    response_root_key: { type: String, default: null },
    is_active: { type: Boolean, default: true },

    // Universal Platform Extensions
    is_approved: { type: Boolean, default: true }, // Discovered endpoints need review/approval
    is_mutating: { type: Boolean, default: false }, // POST, PUT, DELETE, PATCH mutating state
    auth_roles: { type: [String], default: [] }, // Allowed roles, empty = any authenticated
    request_schema: { type: mongoose.Schema.Types.Mixed, default: null },
    response_schema: { type: mongoose.Schema.Types.Mixed, default: null },
    parameter_constraints: { type: mongoose.Schema.Types.Mixed, default: {} },
    operation_id: { type: String, default: null },
    tags: { type: [String], default: [] },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "endpoints" }
);

module.exports = mongoose.model("Endpoint", endpointSchema);
