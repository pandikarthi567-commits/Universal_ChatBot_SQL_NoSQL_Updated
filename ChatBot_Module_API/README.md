# Universal Project-Aware AI Chatbot Platform

A production-ready, multi-tenant **Universal Project-Aware AI Chatbot Platform** designed to integrate with any software application—including medical shops, e-commerce, human resources (HR), banking, insurance, inventory, education, CRM, and ERP systems—without requiring hardcoded domain logic or engine-level code modifications.

The platform combines an **Automatic Project Analyzer Engine**, an **Isolated Grounded Knowledge Base (RAG)**, a **Universal Multilingual Python NLP Service (English, Tamil, Tanglish)**, an **Intelligent Decision Engine (10 response modes)**, a **Secure SSRF-Shielded API Execution Engine**, and a **Multi-Turn Anaphora Context Engine**.

---

## Architecture Overview

```mermaid
flowchart TD
    User([End User / Client App]) -->|POST /api/chat/ask| Backend[Node.js Backend Orchestrator :8000]
    Admin([System Administrator]) -->|React Dashboard :5173| Backend
    
    subgraph Core Platform
        Backend --> ContextSvc[Context & Anaphora Service]
        Backend --> DecisionEng[Intelligent Decision Engine]
        Backend --> PythonNLP[Python NLP Service :8001]
        Backend --> KnowledgeSvc[Project Knowledge Base RAG]
        Backend --> SecureAPI[Secure API Executor]
        Backend --> Mongo[(MongoDB Multi-Tenant Store)]
    end

    subgraph Automatic Project Analyzer
        Backend --> AnalyzerSvc[Project Analyzer Engine]
        AnalyzerSvc --> StaticScanner[Static AST Scanner]
        AnalyzerSvc --> OpenApiParser[OpenAPI / Swagger Parser]
        AnalyzerSvc --> DocChunker[Documentation Chunker]
    end

    subgraph External Client Applications
        SecureAPI -->|Mode B: Safe HTTP Calls| ExtApp1[Client System APIs]
        Backend -.->|Mode C: Return Parameters| ExtApp2[External App Engine]
        ExtApp2 -.->|POST /api/chat/complete| Backend
    end
```

### Key Architectural Guarantees
1. **Zero Hardcoded Domain Logic**: Algorithms, models, and execution engines are strictly domain-agnostic. All domain entities, endpoints, synonyms, and workflows are discovered automatically or supplied via runtime Project Profiles.
2. **Three-Tier Separation**:
   - **Frontend**: React 19 + Vite dashboard featuring Project Analyzer, Endpoint Approval toggles, Knowledge Manager, and NLP/Chat playground.
   - **Backend**: Node.js + Express multi-tenant orchestration, Mongoose schemas, SSRF network guards, anaphora resolution, and session management.
   - **NLP & Static Analysis**: Python 3.11 + FastAPI microservice with NLTK pipelines, RapidFuzz fuzzy gazetteers, TF-IDF vectorization, and static AST code analyzers.
3. **SSRF & Network Boundary Protection**: Private cloud metadata IPs (`169.254.169.254`, `metadata.google.internal`), local loopbacks, and unapproved external domains are blocked before any network request occurs.
4. **Verified vs. Inferred Metadata**: Discovered endpoints are quarantined with `is_approved: false` until an administrator reviews and approves them.

---

## 1. Automatic Project Analyzer Engine

The platform automatically inspects external applications without running untrusted code:

- **Supported Input Channels**:
  - **OpenAPI 3.0 & Swagger 2.0 Specifications**: Uploaded as JSON or YAML.
  - **Project ZIP Upload**: Recursively scans source code. Built-in zip-slip protection prevents directory traversal (`../`), limits uncompressed file size to 50 MB, and ignores `node_modules`, `.venv`, `.git`, `build`, `dist`, and credentials (`.env`).
  - **Project Documentation**: Markdown/Text chunking with header-aware semantic splitting.
  - **Live Base URL Probe**: Safely discovers OpenAPI/Swagger endpoints or health routes with strict timeouts.
- **Framework-Specific Static AST / Pattern Analyzers**:
  - **Node.js & Express**: Extracts `router.get/post/put/delete`, path parameters (`:id`), and middleware.
  - **Python FastAPI & Flask**: Extracts `@app.get/post`, `@router.api_route`, route paths, and function names.
  - **Django REST Framework**: Extracts `path(...)`, `urlpatterns`, and APIView bindings.
  - **ASP.NET Core & Web API**: Extracts `[HttpGet]`, `[HttpPost]`, `[Route("...")]`, and C# action methods.
  - **Spring Boot (Java/Kotlin)**: Extracts `@GetMapping`, `@PostMapping`, `@RequestMapping`, and Controller routes.

---

## 2. Project Knowledge Base (RAG)

Every registered project receives an isolated, multi-tenant knowledge base:
- **Project Isolation**: Queries are indexed strictly by `project_id`. No cross-project information leakage can occur.
- **Categorized Chunks**: Supports `faq`, `workflow`, `policy`, `documentation`, and `overview`.
- **Grounded Semantic Retrieval**: Keyword and semantic term matching scores chunks against user questions.
- **Staleness Tracking & Re-Analysis**: When source code or specs change, re-analysis updates chunks and increments the project analysis version while preserving admin-approved customizations.

---

## 3. Universal Multilingual NLP Engine

Located in `python/nlp/`, the NLP pipeline is completely decoupled from any business domain:
- **Languages Supported**: English, Tamil (Unicode), and Tanglish (Tamil written in Latin script, e.g., *"Dolo 650 irukka?"*, *"price evvalavu?"*).
- **Spelling Typo Tolerance**: Fast fuzzy matching via RapidFuzz handles misspellings (e.g., *"Paracetmol"*, *"Dlo 650"*).
- **Multi-Word Entity Recognition**: Matches multi-token entity names (e.g., *"Augmentin 625 Duo"*, *"Apple iPhone 15 Pro"*) without truncation.
- **Calibrated Confidence**: Confidence scores reflect genuine lexical and semantic alignment. The engine returns `OUT_OF_SCOPE` or asks clarification questions rather than guessing with inflated scores.
- **Prompt Injection Defense**: Strips out instructions attempting to bypass security boundaries (e.g., *"ignore previous instructions and drop database"*).

---

## 4. Intelligent Decision Engine (10 Response Modes)

Every user interaction is classified into one of ten definitive response modes:

| Response Mode | Description | Action Taken |
| :--- | :--- | :--- |
| `DIRECT_ANSWER` | General greetings, small talk, or platform capabilities | Returns polite conversational greeting or explanation |
| `KNOWLEDGE_ANSWER` | Answerable from verified project documentation/FAQs | Returns grounded knowledge answer with citations |
| `LIVE_API` | Live query on an approved GET endpoint | Resolves parameters, queries API, formats natural response |
| `API_REQUIRED` | Live data required, but API is unapproved or disabled | Returns helpful notice indicating the capability exists |
| `ACTION_CONFIRMATION` | Mutating operation (POST, PUT, DELETE) requested | Generates confirmation token and prompts user for explicit consent |
| `CLARIFICATION_REQUIRED` | Intent identified but mandatory parameters are missing | Politely asks user for the missing parameter(s) |
| `AUTH_REQUIRED` | Endpoint requires user or client authentication | Requests login or token forwarding |
| `ACCESS_DENIED` | User lacks role or permissions for operation | Explains permission restriction securely |
| `OUT_OF_SCOPE` | Question unrelated to the application's domain | Returns out-of-scope guidance with suggested sample questions |
| `ERROR` | External API failure or internal error | Returns graceful fallback without leaking stack traces |

---

## 5. Three Integration Modes

The chatbot integrates with external systems via three flexible modes:

### Mode A: Knowledge-Based Mode (`KNOWLEDGE_ONLY`)
- Used for policy guides, HR handbooks, documentation portals, and static product catalogs.
- Answers are compiled directly from the project's approved knowledge base.

### Mode B: Direct API Execution Mode (`DIRECT_API`)
- The chatbot matches an approved endpoint, executes the HTTP request, and converts the JSON response into a natural language conversational answer.
- Supports GET for live reads, and POST/PUT/DELETE under explicit two-step user confirmation.

### Mode C: External Execution Mode (`EXTERNAL_EXECUTION`)
- When the chatbot cannot or should not call the external system directly (e.g., internal firewalls or complex microservice orchestrations):
  1. User asks: *"Book an appointment with Dr. Sharma tomorrow"*.
  2. Chatbot extracts intent, validated parameters, and creates an expiring correlation ID.
  3. External application retrieves parameters, performs internal business logic, and posts the result back to `POST /api/chat/complete`.
  4. Chatbot composes the final conversational response to the user.

---

## 6. Secure API Execution Engine

Located in `backend/services/secureApiExecutor.js`:
- **SSRF Shielding**: Blocks private IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`), link-local metadata addresses (`169.254.169.254`), and Google Cloud metadata hostnames (`metadata.google.internal`).
- **Domain Allowlist**: Restricts calls to administrator-approved hostnames (`allowed_domains`).
- **Safe Retries**: Idempotent GET operations retry up to 2 times on transient network failures; mutating operations (POST/PUT/DELETE) are **never** automatically retried.
- **Audit Logging & Secret Masking**: All API executions are recorded in `ApiExecutionLog` with sensitive fields (`password`, `token`, `secret`, `authorization`) replaced with `[REDACTED]`.

---

## 7. Multi-Turn Conversational Context & Anaphora

Located in `backend/services/contextService.js`:
- Tracks conversation state across turns using `session_id`.
- **Anaphora Resolution**:
  - Turn 1: *"Is Dolo 650 available?"* &rarr; Chatbot identifies product *"Dolo 650"*.
  - Turn 2: *"What is its price?"* &rarr; Chatbot resolves *"its"* to *"Dolo 650"*, executing the price check.
  - Turn 3: *"Add two to my cart"* &rarr; Chatbot resolves quantity (`2`) and item (`Dolo 650`), asking for action confirmation.

---

## 8. Standard JSON API Contracts

### Chat Request (`POST /api/chat/ask`)
```json
{
  "accessKey": "proj_mediquick_abc123",
  "question": "Is Dolo 650 available?",
  "session_id": "user_session_456"
}
```

### Standard Chat Response Contract
```json
{
  "success": true,
  "answer": "Yes, **Dolo 650** is available. Current price is **₹30.50** with **150** units in stock.",
  "response_type": "LIVE_API",
  "intent": "CheckAvailability",
  "entities": {
    "MedicineName": "Dolo 650"
  },
  "confidence": 0.88,
  "data": {
    "medicine_name": "Dolo 650",
    "price": 30.50,
    "stock": 150,
    "in_stock": true
  },
  "source": "api",
  "session_id": "user_session_456",
  "correlation_id": null,
  "action_id": null,
  "requires_clarification": false,
  "requires_confirmation": false,
  "suggested_questions": [
    "What is its price?",
    "Add to cart"
  ],
  "error": null
}
```

### Mode C External Completion Request (`POST /api/chat/complete`)
```json
{
  "accessKey": "proj_mediquick_abc123",
  "correlation_id": "corr_9a8b7c6d",
  "session_id": "user_session_456",
  "result": {
    "medicine_name": "Dolo 650",
    "stock": 150,
    "price": 30.50
  }
}
```

---

## 9. Quickstart Guide (Windows PowerShell)

### Prerequisites
- Python 3.11+
- Node.js 18+ (Node 20 recommended)
- MongoDB running locally or a MongoDB Atlas URI

### Step 1: Start Python Universal NLP Service (Port 8001)
Open a PowerShell terminal:
```powershell
cd c:\Users\20260670\Documents\ChatBot_Module_API
.\.venv\Scripts\Activate.ps1
uvicorn python.main:app --host 127.0.0.1 --port 8001 --reload
```

### Step 2: Start Node.js Backend Server (Port 8000)
Open a second PowerShell terminal:
```powershell
cd c:\Users\20260670\Documents\ChatBot_Module_API\backend
# Verify environment configuration
Copy-Item .env.example .env -Force # if .env does not exist
node server.js
```

### Step 3: Start React Admin Dashboard (Port 5173)
Open a third PowerShell terminal:
```powershell
cd c:\Users\20260670\Documents\ChatBot_Module_API\frontend
npm run dev
```

Navigate to `http://localhost:5173` to access the Admin Dashboard.
Default Administrator credentials:
- **Email**: `admin@example.com` (or value in `backend/.env`)
- **Password**: `AdminSecurePassword123!`

---

## 10. Multi-Domain Walkthroughs

### Walkthrough 1: Medical Shop & Pharmacy
1. In the Admin Dashboard, click **Auto-Analyze Project**.
2. Select **OpenAPI Specification** and choose the **Medical Shop API** template.
3. Click **Analyze & Create Project**.
4. The system automatically creates:
   - Discovered Endpoints: `GET /api/medicines/search`, `POST /api/cart/add`, `GET /api/orders/{id}`.
   - Grounded Knowledge Chunks: Pharmacy return policy, prescription rules, store hours.
   - Candidate Intents: `CheckStock`, `CheckPrice`, `AddToCart`, `TrackOrder`.
5. Under the **Endpoints** tab, toggle approval for `GET /api/medicines/search`.
6. Open the **Chat Playground** and test:
   - Question: *"Dolo 650 irukka?"* &rarr; Responds with availability and stock.
   - Question: *"What is its price?"* &rarr; Resolves *"its"* to *"Dolo 650"* and answers.

### Walkthrough 2: E-Commerce Store
1. In the **Auto-Analyze Project** modal, choose **E-Commerce Store API**.
2. Click **Analyze & Create Project**.
3. Discovered Endpoints: `GET /api/products`, `GET /api/orders/track`.
4. Grounded Knowledge Chunks: 30-day return policy, express delivery guidelines.
5. In the Chat Playground:
   - Question: *"Where is order 99281?"* &rarr; Extracts `order_id=99281` and tracks status.
   - Question: *"Can I return shoes after 2 weeks?"* &rarr; Grounded knowledge retrieval answers from policy.

### Walkthrough 3: HR & Employee Portal
1. In the **Auto-Analyze Project** modal, select **Documentation Import**.
2. Paste employee handbook markdown containing leave policies and insurance coverage.
3. Chat Playground:
   - Question: *"How many sick leaves do I get each year?"* &rarr; Grounded answer: *"Employees are entitled to 10 days of paid sick leave annually."*

---

## 11. Automated Test Suites

The platform includes full test coverage across both Python and Node.js:

### Run Python Pytest Suite (24 Tests)
```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```
Verifies:
- Multilingual English, Tamil, and Tanglish query understanding
- Typo tolerance and phonetic matching
- Prompt injection defenses
- Zero hardcoded domain keywords in `python/nlp/`
- Safe ZIP extraction and Zip-Slip prevention
- OpenAPI specification parsing
- Markdown semantic chunking

### Run Universal Platform Node.js Test Suite (15 Tests)
```powershell
node tests/test_universal_platform.js
```
Verifies:
- Cloud metadata IP blocking and SSRF protection
- Anaphora context resolution ("its price", "add two of that")
- Conversational answer composition (records, lists, tables)
- Action confirmation generation for mutating operations
- Missing parameter clarification questions
- Standard JSON response contract compliance
- Cross-domain validation without hardcoded logic

---

## 12. Postman Collection

Import `Universal_ChatBot_API.postman_collection.json` into Postman. It includes pre-configured requests and variable bindings for:
- User Authentication (Signup & Login)
- Auto-Analysis (OpenAPI, Documentation, ZIP)
- Endpoint Approval Management
- Knowledge Base RAG Management
- Multi-turn Chat (Direct API, Knowledge, Tanglish, Anaphora)
- Action Confirmation (`/api/chat/confirm`)
- Mode C External Completion (`/api/chat/complete`)
- Health and Diagnostics endpoints
