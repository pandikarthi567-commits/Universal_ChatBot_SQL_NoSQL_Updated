const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: "admin" },
    company_name: { type: String, default: null },
    company_details: { type: String, default: null },
    company_location: { type: String, default: null },
    phone_number: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "users" }
);

module.exports = mongoose.model("User", userSchema);

