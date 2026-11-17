const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  const apiKey = req.headers["x-api-key"] || req.headers["api-key"];

  if (token) {
    return jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || decoded.token_type === "refresh") {
        return res.status(401).json({ detail: "Invalid or expired token" });
      }
      req.user = decoded;
      return next();
    });
  }

  if (apiKey) {
    try {
      const Project = require("../models/Project");
      const proj = await Project.findOne({
        $or: [
          { "auth_config.api_key": apiKey },
          { "auth_config.apiKey": apiKey },
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
    } catch {
      // Fall through to 401
    }
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

