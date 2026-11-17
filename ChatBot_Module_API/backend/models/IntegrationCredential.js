const mongoose = require("mongoose");

const integrationCredentialSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    project_id: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true },
    credential_type: {
      type: String,
      enum: ["bearer", "api_key", "basic", "custom_header"],
      default: "api_key",
    },
    encrypted_secret: { type: String, required: true },
    masked_preview: { type: String, default: "••••••••" },
    header_name: { type: String, default: "X-API-Key" },
    environment: { type: String, default: "production" },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "integration_credentials" }
);

module.exports = mongoose.model("IntegrationCredential", integrationCredentialSchema);
