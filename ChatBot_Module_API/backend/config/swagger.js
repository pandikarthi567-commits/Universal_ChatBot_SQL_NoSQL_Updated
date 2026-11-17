const swaggerUi = require("swagger-ui-express");

const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Universal Chatbot API Platform v2",
    version: "2.0.0",
    description:
      "Enterprise NLP Chatbot & Outbound Integration Platform. Supports dual Bearer Token (JWT) and API Key authentication per project, MongoDB Atlas persistence, and Python NLP processing.",
    contact: {
      name: "API Support",
      email: "pandikarthi567@gmail.com",
    },
  },
  servers: [
    {
      url: "http://localhost:8000",
      description: "Local Node.js Backend Server (Port 8000)",
    },
  ],
  components: {
    securitySchemes: {
      Bearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "pandikarthi567@gmail.com" },
          password: { type: "string", example: "Karthik@2005" },
        },
      },
      SignupRequest: {
        type: "object",
        required: ["company_name", "email", "password"],
        properties: {
          company_name: { type: "string", example: "Protect Corp" },
          company_location: { type: "string", example: "Chennai" },
          phone_number: { type: "string", example: "+91 9876543210" },
          company_details: { type: "string", example: "Software and Insurance Services" },
          email: { type: "string", example: "karthik@protect.com" },
          password: { type: "string", example: "SecurePass@123" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refresh_token"],
        properties: {
          refresh_token: { type: "string", description: "Refresh token issued during login/signup" },
        },
      },
      TokenResponse: {
        type: "object",
        properties: {
          access_token: { type: "string" },
          refresh_token: { type: "string" },
          token_type: { type: "string", example: "bearer" },
          role: { type: "string", example: "admin" },
          expires_in_seconds: { type: "integer", example: 120 },
          expires_in_minutes: { type: "integer", example: 2 },
          email: { type: "string" },
          company_name: { type: "string" },
        },
      },
      ProjectRegisterRequest: {
        type: "object",
        required: ["name", "project_code", "base_url"],
        properties: {
          name: { type: "string", example: "Protect" },
          project_code: { type: "string", example: "PROTECT" },
          description: { type: "string", example: "The Protect is Insurance Management Software in Windows" },
          base_url: { type: "string", example: "http://localhost:8000" },
          health_path: { type: "string", example: "/api/protect" },
          auth_type: {
            type: "string",
            enum: ["none", "bearer", "api_key", "bearer_and_api_key"],
            example: "bearer_and_api_key",
          },
          auth_config: {
            type: "object",
            properties: {
              token: { type: "string", example: "bearer_protect_demo_12345" },
              api_key: { type: "string", example: "key_protect_98765" },
              header_name: { type: "string", example: "X-API-Key" },
            },
          },
          is_active: { type: "boolean", example: true },
        },
      },
      ChatAskRequest: {
        type: "object",
        required: ["session_id", "question"],
        properties: {
          session_id: { type: "string", example: "SESSION-PROTECT" },
          question: { type: "string", example: "What is the status of Protect?" },
          project_id: { type: "integer", example: 101 },
          http_method: { type: "string", enum: ["GET", "POST"], example: "GET" },
          form_data: {
            type: "object",
            description: "Form payload for POST calls",
          },
        },
      },
      ResumeCleanRequest: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            example: "John Doe\nEmail: john.doe@example.com Phone: +1-234-567-8900\nSoftware Engineer with 4 years of experience in Python, React, and Node.js. LinkedIn: https://linkedin.com/in/johndoe",
          },
        },
      },
      ResumeExtractRequest: {
        type: "object",
        required: ["resume_text"],
        properties: {
          resume_text: {
            type: "string",
            example: "Karthik\nEmail: karthik@example.com Phone: 9876543210\nFull Stack Developer with 3 years of experience in Python, React, Node.js, and MongoDB. B.Tech Computer Science 2023.",
          },
        },
      },
      ResumeAnalyzeRequest: {
        type: "object",
        required: ["resume_text"],
        properties: {
          resume_text: {
            type: "string",
            example: "Karthik\nEmail: karthik@example.com Phone: 9876543210\nFull Stack Developer with 3 years of experience in Python, React, Node.js, and MongoDB.",
          },
          job_description: {
            type: "string",
            example: "Looking for a Full Stack Developer with 2+ years of experience in Python, React, Docker, and AWS.",
          },
          required_skills: {
            type: "array",
            items: { type: "string" },
            example: ["Python", "React", "Docker", "AWS"],
          },
          min_experience_years: {
            type: "number",
            example: 2,
          },
          role_title: {
            type: "string",
            example: "Full Stack Developer",
          },
        },
      },
    },
  },
  security: [
    { Bearer: [] },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "System Health Check",
        description: "Returns platform operational status, MongoDB Atlas connectivity, and Python NLP status.",
        responses: {
          200: { description: "System operational" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Sign In User / Admin",
        description: "Authenticate with username/email and password. Returns access token (120s) and refresh token.",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: { description: "Successful login", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Register Company & User",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SignupRequest" } } },
        },
        responses: {
          201: { description: "Account created", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh Access Token (120s Cycle)",
        description: "Pass refresh_token to generate a fresh 120-second access token seamlessly.",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } },
        },
        responses: {
          200: { description: "Token refreshed successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          401: { description: "Invalid or expired refresh token" },
        },
      },
    },
    "/api/projects/analyze": {
      post: {
        tags: ["Project Analyzer & Auto-Discovery"],
        summary: "Analyze Project Source Code, OpenAPI Spec, or Docs",
        description: "Static code analysis for Node.js, FastAPI, Flask, Django, ASP.NET Core, Spring Boot, or OpenAPI specification. Extracts modules, routes, models, candidate intents, and workflows.",
        security: [{ Bearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Pharmacy Management" },
                  project_code: { type: "string", example: "PHARMACY" },
                  base_url: { type: "string", example: "http://localhost:5000" },
                  source_type: { type: "string", enum: ["zip_upload", "openapi_spec", "docs_import", "base_url_probe"], example: "openapi_spec" },
                  spec_content: { type: "string", example: "{\"openapi\": \"3.0.0\", \"info\": {\"title\": \"Pharmacy API\"}, \"paths\": {}}" },
                  zip_base64: { type: "string", description: "Base64-encoded project ZIP archive" },
                  docs_text: { type: "string", description: "Markdown documentation text" },
                  integration_mode: { type: "string", enum: ["MODE_A_KNOWLEDGE", "MODE_B_DIRECT_API", "MODE_C_EXTERNAL"], default: "MODE_B_DIRECT_API" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Analysis completed successfully with discovered routes, models, and candidate intents" },
        },
      },
    },
    "/api/projects/{id}/analysis": {
      get: {
        tags: ["Project Analyzer & Auto-Discovery"],
        summary: "Get Project Static Analysis Report",
        security: [{ Bearer: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Project analysis report" },
        },
      },
    },
    "/api/projects/{id}/reanalyze": {
      post: {
        tags: ["Project Analyzer & Auto-Discovery"],
        summary: "Reanalyze Project",
        security: [{ Bearer: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Project re-analyzed" },
        },
      },
    },
    "/api/projects/{id}/knowledge": {
      get: {
        tags: ["Project Knowledge Base"],
        summary: "Get Project Grounded Knowledge Base",
        security: [],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "List of grounded knowledge chunks" },
        },
      },
      post: {
        tags: ["Project Knowledge Base"],
        summary: "Add Grounded Knowledge Item",
        security: [{ Bearer: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "content"],
                properties: {
                  category: { type: "string", example: "faq" },
                  title: { type: "string", example: "Return Policy" },
                  content: { type: "string", example: "Items can be returned within 30 days of purchase with valid receipt." },
                  keywords: { type: "array", items: { type: "string" }, example: ["return", "refund", "policy"] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Knowledge item added" },
        },
      },
    },
    "/api/projects/{id}/endpoints/{endpointId}/approve": {
      post: {
        tags: ["Project Endpoints & Approval"],
        summary: "Approve or Disapprove Discovered Endpoint",
        description: "Enables administrators to approve discovered endpoints before enabling live chatbot execution.",
        security: [{ Bearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "endpointId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { is_approved: { type: "boolean", default: true } },
              },
            },
          },
        },
        responses: {
          200: { description: "Endpoint approval status updated" },
        },
      },
    },
    "/api/chat/ask": {
      post: {
        tags: ["Chat & NLP Execution"],
        summary: "Ask Chatbot / Send Action Command",
        description:
          "Accepts natural language query or form action. Runs Python NLTK intent matching, executes outbound API call with Bearer Token and/or API Key, and returns normalized response.",
        security: [{ Bearer: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ChatAskRequest" } } },
        },
        responses: {
          200: { description: "Successful chatbot reply with intent, confidence, entities, and data" },
        },
      },
    },
    "/api/chat/history": {
      get: {
        tags: ["Chat & NLP Execution"],
        summary: "Get Chat History",
        security: [{ Bearer: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 25 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: { description: "Chat history records" },
        },
      },
    },
    "/api/chat/complete": {
      post: {
        tags: ["Chat & NLP Execution"],
        summary: "Mode C - External Execution Completion",
        description: "External systems call this endpoint with the result of business logic execution bound to correlation_id.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["correlation_id", "result_data"],
                properties: {
                  correlation_id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
                  result_data: { type: "object", example: { status: "ORDER_PLACED", order_id: 9876 } },
                  session_id: { type: "string", example: "SESSION-MED1" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Final natural language response generated from external data" },
        },
      },
    },
    "/api/chat/confirm": {
      post: {
        tags: ["Chat & NLP Execution"],
        summary: "Confirm or Cancel Pending Mutating Action",
        description: "Executes or cancels a mutating action that was held for confirmation.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["correlation_id"],
                properties: {
                  correlation_id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
                  confirmed: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Execution result of confirmed action" },
        },
      },
    },
    "/api/chat/session": {
      delete: {
        tags: ["Chat & NLP Execution"],
        summary: "Clear Conversation Session Context",
        parameters: [
          { name: "session_id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Session context reset" },
        },
      },
    },
    "/api/nlp/resume/clean": {
      post: {
        tags: ["Job Portal & Resume Screening NLP"],
        summary: "Clean Resume / Job Text",
        description: "Cleans unstructured resume or job description text. Strips URLs, emails, phone numbers, formatting artifacts, and special noise characters.",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResumeCleanRequest" } } },
        },
        responses: {
          200: { description: "Cleaned text returned successfully" },
        },
      },
    },
    "/api/nlp/resume/extract": {
      post: {
        tags: ["Job Portal & Resume Screening NLP"],
        summary: "Extract Structured Resume Entities",
        description: "Extracts contact info (email, phone, LinkedIn, GitHub), technical skills, soft skills, education qualifications, experience years, and candidate name.",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResumeExtractRequest" } } },
        },
        responses: {
          200: { description: "Structured candidate details extracted successfully" },
        },
      },
    },
    "/api/nlp/resume/analyze": {
      post: {
        tags: ["Job Portal & Resume Screening NLP"],
        summary: "Resume Screening & Job Description Matcher",
        description: "Automated candidate ranking and screening against job requirements. Evaluates Skill Match %, experience match, TF-IDF cosine semantic similarity, and outputs recommendation decision (SHORTLISTED, UNDER_REVIEW, REJECTED).",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ResumeAnalyzeRequest" } } },
        },
        responses: {
          200: { description: "Screening decision, match score, matched & missing skills returned successfully" },
        },
      },
    },
  },
};

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #17191C; border-bottom: 2px solid #FF4832; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui { background-color: #0F1115; color: #FFFFFF; font-family: system-ui, sans-serif; }
    .swagger-ui .info .title { color: #FFFFFF; }
    .swagger-ui .scheme-container { background: #17191C; border-bottom: 1px solid #2A2E35; }
    .swagger-ui .btn.authorize { color: #FFFFFF; border-color: #10B981; background: #10B981; border-radius: 8px; font-weight: 600; }
    .swagger-ui .btn.authorize svg { fill: #FFFFFF; }
    .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73, 204, 144, 0.08); }
    .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97, 175, 254, 0.08); }
    .swagger-ui .opblock .opblock-summary-operation-id, .swagger-ui .opblock .opblock-summary-path, .swagger-ui .opblock .opblock-summary-path__deprecated { color: #FFFFFF; }
    .swagger-ui .opblock-tag { color: #FFFFFF; border-bottom: 1px solid #2A2E35; }
    body { background-color: #0F1115 !important; }
  `,
  customSiteTitle: "Universal Chatbot API - Swagger UI",
};

/**
 * Dynamically queries MongoDB Atlas for registered Projects & Endpoints
 * and attaches them to the OpenAPI spec so all created applications
 * are immediately visible and testable in Swagger UI!
 */
async function getDynamicSwaggerSpec(filterProjectCode = null) {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      return swaggerDocument;
    }

    const Project = require("../models/Project");

    // Case 1: Individual Project Definition selected (matches Image 5 OAS 3.0 specification)
    if (filterProjectCode) {
      const proj = await Project.findOne({
        project_code: filterProjectCode.trim().toUpperCase(),
        is_active: true,
      });

      if (proj) {
        const cleanSlug = (proj.project_code || "app").toLowerCase();
        const projTag = proj.name.trim();
        const basePath = proj.health_path || `/api/${cleanSlug}`;
        const headerName = proj.auth_config?.header_name || "X-API-Key";

        return {
          openapi: "3.0.3",
          info: {
            title: `${projTag} API v1 OAS 3.0`,
            version: "1.0.0",
            description: `Single unified API service for ${proj.name} (${proj.project_code}). Outbound Base URL: ${proj.base_url}`,
          },
          servers: [
            {
              url: "http://localhost:8000",
              description: "Local Node.js Backend Server (Port 8000)",
            },
          ],
          components: {
            securitySchemes: {
              Bearer: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Enter your Bearer / JWT token",
              },
            },
          },
          security: [
            { Bearer: [] },
          ],
          paths: {
            [basePath]: {
              get: {
                tags: [projTag],
                summary: `${projTag} - Data Query & Check`,
                description: `Live single endpoint for ${proj.name}. Authorize with your Bearer Token or enter the 'accessKey' query parameter below. Automatically runs NLP analysis and saves interaction to MongoDB chat_history.`,
                security: [{ Bearer: [] }],
                parameters: [
                  {
                    name: "accessKey",
                    in: "query",
                    required: false,
                    schema: { type: "string", example: proj.auth_config?.api_key || "" },
                    description: "Project API Key",
                  },
                  {
                    name: "session_id",
                    in: "query",
                    required: false,
                    schema: { type: "string", example: `SESSION-${proj.project_code}` },
                    description: "Chat session identifier (retrieves response generated from POST call)",
                  },
                ],
                responses: {
                  200: {
                    description: `${proj.name} API active and authorized successfully (Chatbot NLP format)`,
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          example: {
                            success: true,
                            status: "success",
                            project_name: proj.name,
                            project_code: proj.project_code,
                            endpoint_url: `http://localhost:8000${basePath}`,
                            endpoint_path: basePath,
                            database_access: false,
                            mode: "nlp_analysis_only",
                            question: `What is the status of ${proj.name}?`,
                            answer: `🤖 [${proj.name} API]: Service is running, reachable, and authenticated successfully via api_key.`,
                            intent: `${proj.project_code}_DATA_QUERY`,
                            confidence: 0.95,
                            entities: {},
                            data: {
                              application: proj.name,
                              project_code: proj.project_code,
                              status: "ACTIVE",
                            },
                            clean_data: {
                              original_text: `What is the status of ${proj.name}?`,
                              cleaned_text: `what is the status of ${cleanSlug}`,
                            },
                            extracted_data: {
                              entities: {},
                              keywords: ["status", cleanSlug],
                            },
                            analyzed_data: {
                              intent: `${proj.project_code}_DATA_QUERY`,
                              confidence: 0.95,
                              answer: `🤖 [${proj.name} API]: Service is running, reachable, and authenticated successfully via api_key.`,
                              status: "success",
                            },
                            chatbot_language: {
                              cleaned_text: `what is the status of ${cleanSlug}`,
                              extracted_entities: {},
                              keywords: ["status", cleanSlug],
                              intent: `${proj.project_code}_DATA_QUERY`,
                              confidence: 0.95,
                            },
                            session_id: `SESSION-${proj.project_code}`,
                            auth_verified: true,
                            auth_method: "api_key",
                            timestamp: "2026-11-16T11:00:00.000Z",
                          },
                        },
                      },
                    },
                  },
                  401: { description: "Unauthorized: Missing or invalid Project API Key or Bearer Token" },
                },
              },
              post: {
                tags: [projTag],
                summary: `${projTag} - Submit & Execute Action`,
                description: `Submit records, policies, or transactions to ${proj.name}. Automatically runs NLP processing and saves interaction to MongoDB chat_history.`,
                security: [{ Bearer: [] }],
                parameters: [
                  {
                    name: "accessKey",
                    in: "query",
                    required: false,
                    schema: { type: "string", example: proj.auth_config?.api_key || "" },
                    description: "Project API Key",
                  },
                  {
                    name: "question",
                    in: "query",
                    required: false,
                    schema: { type: "string", example: "i need the cart details" },
                    description: "Command or action description for NLP processing",
                  },
                  {
                    name: "session_id",
                    in: "query",
                    required: false,
                    schema: { type: "string", example: `SESSION-${proj.project_code}` },
                    description: "Chat session identifier (persists into chat_history)",
                  },
                ],
                requestBody: {
                  required: false,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        example: {
                          question: "i need the cart details",
                          session_id: `SESSION-${proj.project_code}`,
                          form_data: {},
                        },
                      },
                    },
                  },
                },
                responses: {
                  200: {
                    description: "Transaction/Record processed successfully (Chatbot NLP format)",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          example: {
                            success: true,
                            status: "success",
                            project_name: proj.name,
                            project_code: proj.project_code,
                            endpoint_url: `http://localhost:8000${basePath}`,
                            endpoint_path: basePath,
                            database_access: false,
                            mode: "nlp_analysis_only",
                            question: `Submit new record for ${proj.name}`,
                            answer: `✅ [${proj.name}]: Record submitted and processed successfully!`,
                            intent: `${proj.project_code}_SUBMIT_RECORD`,
                            confidence: 0.95,
                            entities: {},
                            data: {
                              application: proj.name,
                              project_code: proj.project_code,
                              status: "SUCCESS",
                              action: "record_processed",
                            },
                            clean_data: {
                              original_text: `Submit new record for ${proj.name}`,
                              cleaned_text: `submit new record for ${cleanSlug}`,
                            },
                            extracted_data: {
                              entities: {},
                              keywords: ["submit", "record", cleanSlug],
                            },
                            analyzed_data: {
                              intent: `${proj.project_code}_SUBMIT_RECORD`,
                              confidence: 0.95,
                              answer: `✅ [${proj.name}]: Record submitted and processed successfully!`,
                              status: "success",
                            },
                            chatbot_language: {
                              cleaned_text: `submit new record for ${cleanSlug}`,
                              extracted_entities: {},
                              keywords: ["submit", "record", cleanSlug],
                              intent: `${proj.project_code}_SUBMIT_RECORD`,
                              confidence: 0.95,
                            },
                            session_id: `SESSION-${proj.project_code}`,
                            auth_verified: true,
                            auth_method: "api_key",
                            timestamp: "2026-11-16T11:00:00.000Z",
                          },
                        },
                      },
                    },
                  },
                  401: { description: "Unauthorized: Missing or invalid Project API Key or Bearer Token" },
                },
              },
            },
          },
        };
      }
    }

    // Case 2: Platform API v2 (All Endpoints view)
    const spec = JSON.parse(JSON.stringify(swaggerDocument));
    const projects = await Project.find({ is_active: true });

    for (const proj of projects) {
      const cleanSlug = (proj.project_code || "app").toLowerCase();
      const projTag = proj.name.trim();
      const basePath = proj.health_path || `/api/${cleanSlug}`;
      const headerName = proj.auth_config?.header_name || "X-API-Key";

      if (!spec.paths[basePath]) spec.paths[basePath] = {};

      // 1. Single GET Endpoint (matches Image 4)
      spec.paths[basePath]["get"] = {
        tags: [projTag],
        summary: `${projTag} - Data Query & Check`,
        description: `Single API call for ${proj.name}. Authorize with your Bearer Token or enter the 'accessKey' query parameter below. Automatically runs NLP analysis and saves interaction to MongoDB chat_history.`,
        security: [{ Bearer: [] }],
        parameters: [
          {
            name: "accessKey",
            in: "query",
            required: false,
            schema: { type: "string", example: proj.auth_config?.api_key || "" },
            description: "Project API Key",
          },
          {
            name: "session_id",
            in: "query",
            required: false,
            schema: { type: "string", example: `SESSION-${proj.project_code}` },
            description: "Chat session identifier (retrieves response generated from POST call)",
          },
        ],
        responses: {
          200: {
            description: `${proj.name} API verified and operational (Chatbot NLP format)`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  example: {
                    success: true,
                    status: "success",
                    project_name: proj.name,
                    project_code: proj.project_code,
                    endpoint_url: `http://localhost:8000${basePath}`,
                    endpoint_path: basePath,
                    database_access: false,
                    mode: "nlp_analysis_only",
                    question: `What is the status of ${proj.name}?`,
                    answer: `🤖 [${proj.name} API]: Service is running, reachable, and authenticated successfully via api_key.`,
                    intent: `${proj.project_code}_DATA_QUERY`,
                    confidence: 0.95,
                    entities: {},
                    data: {
                      application: proj.name,
                      project_code: proj.project_code,
                      status: "ACTIVE",
                    },
                    clean_data: {
                      original_text: `What is the status of ${proj.name}?`,
                      cleaned_text: `what is the status of ${cleanSlug}`,
                    },
                    extracted_data: {
                      entities: {},
                      keywords: ["status", cleanSlug],
                    },
                    analyzed_data: {
                      intent: `${proj.project_code}_DATA_QUERY`,
                      confidence: 0.95,
                      answer: `🤖 [${proj.name} API]: Service is running, reachable, and authenticated successfully via api_key.`,
                      status: "success",
                    },
                    chatbot_language: {
                      cleaned_text: `what is the status of ${cleanSlug}`,
                      extracted_entities: {},
                      keywords: ["status", cleanSlug],
                      intent: `${proj.project_code}_DATA_QUERY`,
                      confidence: 0.95,
                    },
                    session_id: `SESSION-${proj.project_code}`,
                    auth_verified: true,
                    auth_method: "api_key",
                    timestamp: "2026-11-16T11:00:00.000Z",
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized: Missing or invalid Project API Key or Bearer Token" },
        },
      };

      // 2. Single POST Endpoint
      spec.paths[basePath]["post"] = {
        tags: [projTag],
        summary: `${projTag} - Submit & Execute Action`,
        description: `Submit records, policies, or transactions to ${proj.name}. Automatically runs NLP processing and saves interaction to MongoDB chat_history.`,
        security: [{ Bearer: [] }],
        parameters: [
          {
            name: "accessKey",
            in: "query",
            required: false,
            schema: { type: "string", example: proj.auth_config?.api_key || "" },
            description: "Project API Key",
          },
          {
            name: "question",
            in: "query",
            required: false,
            schema: { type: "string", example: "i need the cart details" },
            description: "Command or action description for NLP processing",
          },
          {
            name: "session_id",
            in: "query",
            required: false,
            schema: { type: "string", example: `SESSION-${proj.project_code}` },
            description: "Chat session identifier (persists into chat_history)",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                example: {
                  question: "i need the cart details",
                  session_id: `SESSION-${proj.project_code}`,
                  form_data: {},
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: `Data processed successfully on ${proj.name} (Chatbot NLP format)`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  example: {
                    success: true,
                    status: "success",
                    project_name: proj.name,
                    project_code: proj.project_code,
                    endpoint_url: `http://localhost:8000${basePath}`,
                    endpoint_path: basePath,
                    database_access: false,
                    mode: "nlp_analysis_only",
                    question: `Submit new record for ${proj.name}`,
                    answer: `✅ [${proj.name}]: Record submitted and processed successfully!`,
                    intent: `${proj.project_code}_SUBMIT_RECORD`,
                    confidence: 0.95,
                    entities: {},
                    data: {
                      application: proj.name,
                      project_code: proj.project_code,
                      status: "SUCCESS",
                      action: "record_processed",
                    },
                    clean_data: {
                      original_text: `Submit new record for ${proj.name}`,
                      cleaned_text: `submit new record for ${cleanSlug}`,
                    },
                    extracted_data: {
                      entities: {},
                      keywords: ["submit", "record", cleanSlug],
                    },
                    analyzed_data: {
                      intent: `${proj.project_code}_SUBMIT_RECORD`,
                      confidence: 0.95,
                      answer: `✅ [${proj.name}]: Record submitted and processed successfully!`,
                      status: "success",
                    },
                    chatbot_language: {
                      cleaned_text: `submit new record for ${cleanSlug}`,
                      extracted_entities: {},
                      keywords: ["submit", "record", cleanSlug],
                      intent: `${proj.project_code}_SUBMIT_RECORD`,
                      confidence: 0.95,
                    },
                    session_id: `SESSION-${proj.project_code}`,
                    auth_verified: true,
                    auth_method: "api_key",
                    timestamp: "2026-11-16T11:00:00.000Z",
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized: Missing or invalid Project API Key or Bearer Token" },
        },
      };
    }

    return spec;
  } catch (err) {
    console.warn("Could not dynamically load projects for Swagger:", err.message);
    return swaggerDocument;
  }
}

module.exports = {
  swaggerUi,
  swaggerDocument,
  swaggerOptions,
  getDynamicSwaggerSpec,
};
