require("dotenv").config();
for (const key of ["JWT_SECRET","JWT_REFRESH_SECRET","ENCRYPTION_KEY"]) { if (!process.env[key] || process.env[key].length < 32) throw new Error("Set a strong "+key+" (at least 32 characters)"); }
if(process.env.JWT_SECRET===process.env.JWT_REFRESH_SECRET) throw new Error("JWT secrets must differ");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const { swaggerUi, swaggerDocument, swaggerOptions, getDynamicSwaggerSpec } = require("./config/swagger");
const { router: authRouter, ensureSuperAdmin } = require("./routes/auth");
const { JWT_SECRET } = require("./middleware/auth");
const projectsRouter = require("./routes/projects");
const endpointsRouter = require("./routes/endpoints");
const intentsRouter = require("./routes/intents");
const chatRouter = require("./routes/chat");
const nlpRouter = require("./routes/nlp");
const Project = require("./models/Project");
const ChatMessage = require("./models/ChatMessage");
const Intent = require("./models/Intent");
const { getNextSequence } = require("./models/Counter");
const { processQuestionWithNLP } = require("./services/nlpService");
const universal = require("./universal/routes");

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to MongoDB Atlas
connectDB().then(() => {
  ensureSuperAdmin();
});

// Middleware
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(","),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-API-Key"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoints
app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    status: "ok",
    app: "Universal Chatbot Node.js Backend",
    database: "MongoDB Atlas",
    swagger_ui: `http://localhost:${PORT}/docs`,
    nlp_service: process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001",
  });
});

// Dynamic Swagger UI Documentation & OpenAPI Spec (with Live Project Endpoints)
app.get("/swagger.json", async (req, res) => {
  try {
    const spec = await getDynamicSwaggerSpec();
    res.json(spec);
  } catch (err) {
    res.json(swaggerDocument);
  }
});

// Single Project Swagger JSON Spec
app.get("/swagger/project/:code.json", async (req, res) => {
  try {
    const spec = await getDynamicSwaggerSpec(req.params.code);
    res.json(spec);
  } catch (err) {
    res.json(swaggerDocument);
  }
});

// Serve Swagger UI with "Select a definition" dropdown matching OAS 3.0 specification
app.use("/docs", swaggerUi.serve);
app.get("/docs", async (req, res, next) => {
  try {
    const projects = await Project.find({ is_active: true });
    const urls = [
      { url: "/swagger.json", name: "Platform API v2 (All Endpoints)" },
      ...projects.map((p) => ({
        url: `/swagger/project/${p.project_code.toLowerCase()}.json`,
        name: `${p.name} v1`,
      })),
    ];

    const dynamicSwaggerUiOptions = {
      ...swaggerOptions,
      swaggerOptions: {
        urls,
        persistAuthorization: true,
      },
    };

    return swaggerUi.setup(null, dynamicSwaggerUiOptions)(req, res, next);
  } catch {
    return swaggerUi.setup(swaggerDocument, swaggerOptions)(req, res, next);
  }
});
app.use("/swagger", (req, res) => res.redirect("/docs"));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/endpoints", endpointsRouter);
app.use("/api/projects/:projectId/intents", intentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api", universal.router);
app.use("/api/nlp", nlpRouter);

// Admin Profile Endpoints (Proxy to Python NLP Microservice)
const axios = require("axios");
const { authenticateToken, requireAdmin } = require("./middleware/auth");

app.get("/admin/profile/:project", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pythonUrl = process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001";
    const response = await axios.get(`${pythonUrl}/admin/profile/${req.params.project}`);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { detail: err.message });
  }
});

app.put("/admin/profile/:project", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pythonUrl = process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001";
    const response = await axios.put(`${pythonUrl}/admin/profile/${req.params.project}`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { detail: err.message });
  }
});

// Legacy unrestricted project proxy removed. Use /api/chat/:projectCode.
// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ detail: 'Invalid JSON format in request body' });
  }
  console.error('Server Error:', err);
  res.status(err.status || 500).json({ detail: "Internal Server Error" });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log("==============================================================");
  console.log(`  Universal Chatbot API - Node.js Backend`);
  console.log(`  Port        : http://localhost:${PORT}`);
  console.log(`  Swagger UI  : http://localhost:${PORT}/docs`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`  Database    : MongoDB Atlas`);
  console.log(`  Python NLP  : ${process.env.PYTHON_NLP_URL || "http://127.0.0.1:8001"}`);
  console.log("==============================================================");
});

