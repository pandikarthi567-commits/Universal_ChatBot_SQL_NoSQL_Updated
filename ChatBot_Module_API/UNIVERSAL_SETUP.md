# Universal Chatbot – updated integration

This update retains the original React admin dashboard, Node/Express server, MongoDB platform metadata, FastAPI/NLTK service and static project analyzers. The new chat path uses read-only, project-scoped retrieval. It is a bounded implementation, not an unrestricted natural-language database agent.

## Setup (Windows PowerShell)
1. Install Node.js 22.13+ (22 LTS), Python 3.11, and start local MongoDB or supply Atlas URI.
2. `cd backend`; `Copy-Item .env.example .env`; edit all secrets and the admin password; run `npm install`; `npm run dev`. The backend lock was removed because new packages could not be downloaded in the build environment; npm install generates it.
3. In a new terminal from root: `py -3.11 -m venv .venv`; `\.venv\Scripts\python.exe` is not an absolute path: run `.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt`; `cd python`; `..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001`.
4. In another terminal: `cd frontend`; `npm install`; `npm run dev`; open http://localhost:5173. Sign in with configured admin credentials. Do not expose the NLP port publicly.
5. Register a project, enable optional database access, choose the database type, supply the connection and database name. Open the project's Integration Documentation tab and configure approved resources and website paths. Save. Test from API Checking or curl.

## Project data connectors
The chatbot's own configuration store remains MongoDB. Target project databases can be different.

| Type | Connection example |
|---|---|
| mongodb | mongodb://readonly:password@localhost:27017/app (set db_name) |
| postgresql | postgresql://readonly:password@localhost:5432/app |
| supabase | PostgreSQL pooler connection string, read-only role |
| mysql | mysql://readonly:password@localhost:3306/app |
| mssql | Server=localhost;Database=app;User Id=readonly;Password=...;Encrypt=true |
| sqlite | Absolute server-local database file path, read-only |

Use database accounts restricted to approved views/collections. All chatbot users within a project share configured resource access: use filtered views for tenant-specific data or extend row-level authorization before exposing private records. Never approve PII or secrets; field-name blocking is not a substitute for classification. Only MongoDB is implemented for NoSQL; Redis, Cassandra, Firestore and Oracle are not included.

Example resource for a database table or MongoDB collection:
```json
[{"name":"products","source":"database","table":"products","schema":"public","fields":["name","qty"],"filters":["qty"],"field_types":{"qty":"number"},"aliases":["items","பொருட்கள்"]}]
```
For SQL Server set schema to dbo. For MongoDB, MySQL and SQLite schema is ignored. Names must be simple identifiers. Database resources are manually approved; auto-discovery is not implemented in this version.

For database-free integration use an approved GET endpoint returning an array, with resource `{ "name":"products", "source":"api", "endpoint_id":1, "fields":["name","qty"] }`. Set endpoint ID to the actual approved project's endpoint. API list only; no inferred counts from paginated data. Websites must be same-origin static HTML; configure paths such as `/about`. Windows and mobile applications can expose read-only REST endpoints or use a connected database; no automatic desktop screen inspection. Existing project knowledge/indexed documentation is also searchable.

## Request
```
curl -X POST http://localhost:8000/api/chat/my-project -H "X-API-Key: <project key>" -H "Content-Type: application/json" -d '{"session_id":"test-1","question":"count products"}'
```
Use a JWT access token instead for user authentication. Do not put a shared API key in public JS or distribute it in a desktop application. Use an authenticated server-side proxy. Use TLS, network egress restrictions, private network access controls and strong secrets in production. The legacy `/api/chat/ask` remains for compatibility with an explicit project id/code or project-scoped auth; no default first-project routing. Mutating chat routes are disabled.

Supported queries: `count products`, `list products`, `list products qty = 2`, `ethana products`, `எத்தனை பொருட்கள்`; aliases are configurable. Follow-up resource references are scoped to project, user and conversation. NLTK processing provides intent metadata; bounded query planner validates resource, operation and filter. Results are direct deterministic answers or matching source extracts; no general LLM generation, arbitrary SQL, joins, date range, or full semantic multilingual question coverage. Unsupported or ambiguous questions require clarification. The system does not substitute a web result for unavailable live records.

## Verification
From root: `node tests/test_universal_core.js`. Tests verified query planning, field rejection, generated SQL syntax and real SQLite queries. All backend JavaScript syntax checked. External package install failed due to registry DNS restrictions; full-stack build and live MongoDB/MySQL/PostgreSQL/SQL Server/Supabase connections were not verified. Test them against your own read-only accounts before deployment. Existing legacy tests relate to retired routes and aren't proof of the new path.

Original .env secrets, Git history, installed dependencies and virtual environment are excluded. Rotate any credentials present in the original archive. Legacy README, PLAN, Swagger and older Postman collection may describe retired functionality; this guide is authoritative for the new chat route.
