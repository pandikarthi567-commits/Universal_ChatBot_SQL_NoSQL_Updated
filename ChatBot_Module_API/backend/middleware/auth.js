const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  const apiKey = req.headers["x-api-key"] || req.headers["api-key"];

  // 1. If JWT is provided, try verifying it
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.token_type !== "refresh") {
        req.user = decoded;
        return next();
      }
    } catch (jwtErr) {
      // Token is not a valid JWT (it might be a project-level bearer token or api key)
    }

    // Check if token matches a project's bearer token or API key
    try {
      const Project = require("../models/Project");
      const proj = await Project.findOne({
        $or: [
          { "auth_config.bearer_token": token },
          { "auth_config.token": token },
          { "auth_config.bearerToken": token },
          { "auth_config.api_key": token },
          { "auth_config.apiKey": token },
        ],
        is_active: true,
      });
      if (proj) {
        req.user = {
          user_id: -Number(proj.id),
          username: `bearer_${proj.project_code.toLowerCase()}`,
          role: "user",
          project_id: proj.id,
        };
        return next();
      }
    } catch {}
  }

  // 2. If API Key is provided, check project API key
  if (apiKey) {
    try {
      const Project = require("../models/Project");
      const proj = await Project.findOne({
        $or: [
          { "auth_config.api_key": apiKey },
          { "auth_config.apiKey": apiKey },
          { "auth_config.bearer_token": apiKey },
          { "auth_config.token": apiKey },
        ],
        is_active: true,
      });
      if (proj) {
        req.user = {
          user_id: -Number(proj.id),
          username: `apikey_${proj.project_code.toLowerCase()}`,
          role: "user",
          project_id: proj.id,
        };
        return next();
      }
    } catch {}
  }

  return res.status(401).json({ detail: "Not authenticated. Provide 'Authorization: Bearer <token>' or 'X-API-Key: <key>'." });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      return res.status(403).json({ detail: "Administrator privileges required" });
    }
  });
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
