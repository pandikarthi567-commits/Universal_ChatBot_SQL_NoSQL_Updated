"""
Universal Static Code Analyzer Engine
Analyzes project source code, OpenAPI specs, and documentation statically without code execution.
Supports framework adapters for Node.js/Express, FastAPI/Flask, Django, ASP.NET Core, and Spring Boot.
"""
from io import BytesIO
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any
import zipfile
import yaml


# Security limits
MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILES_COUNT = 1000
MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024  # 5 MB

EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    ".github",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    "bin",
    "obj",
    "target",
    "dist",
    "build",
    ".idea",
    ".vscode",
    ".next",
    ".nuxt",
}

EXCLUDED_EXTENSIONS = {
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".pyc",
    ".pyo",
    ".o",
    ".obj",
    ".jar",
    ".war",
    ".zip",
    ".tar",
    ".gz",
    ".iso",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".mp4",
    ".mp3",
    ".wav",
    ".pdf",
}

SECRET_PATTERNS = [
    r"^\.env.*",
    r".*\.pem$",
    r".*\.key$",
    r".*id_rsa.*",
    r".*credentials\.json$",
    r".*secret.*",
]


def is_safe_relative_path(target_dir: Path, file_path: str) -> bool:
    """Zip slip protection: ensure extracted file remains strictly inside target_dir."""
    try:
        resolved = (target_dir / file_path).resolve()
        return resolved.is_relative_to(target_dir.resolve())
    except Exception:
        return False


def is_secret_file(filename: str) -> bool:
    fn_lower = os.path.basename(filename).lower()
    return any(re.match(pattern, fn_lower) for pattern in SECRET_PATTERNS)


def extract_zip_safely(zip_bytes: bytes, target_dir: Path) -> list[Path]:
    """Extracts zip archive with strict security checks."""
    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise ValueError(f"Zip archive exceeds maximum size limit of {MAX_ZIP_SIZE_BYTES // (1024*1024)}MB.")

    extracted_files: list[Path] = []
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        infolist = zf.infolist()
        if len(infolist) > MAX_FILES_COUNT:
            raise ValueError(f"Zip archive contains too many files ({len(infolist)} > {MAX_FILES_COUNT}).")

        for member in infolist:
            if member.is_dir():
                continue

            # Check directory parts for exclusions
            parts = Path(member.filename).parts
            if any(part in EXCLUDED_DIRS for part in parts):
                continue

            # Check extension
            ext = os.path.splitext(member.filename)[1].lower()
            if ext in EXCLUDED_EXTENSIONS:
                continue

            # Check secrets
            if is_secret_file(member.filename):
                continue

            if not is_safe_relative_path(target_dir, member.filename):
                raise ValueError(f"Zip slip security violation detected in file: {member.filename}")

            if member.file_size > MAX_SINGLE_FILE_BYTES:
                continue

            dest_path = target_dir / member.filename
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as source, open(dest_path, "wb") as target:
                target.write(source.read())
            extracted_files.append(dest_path)

    return extracted_files


# ----------------------------------------------------------------------
# Framework Adapters
# ----------------------------------------------------------------------
class BaseAnalyzerAdapter:
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        raise NotImplementedError

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        raise NotImplementedError


class NodeExpressAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.name == "package.json":
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if "express" in content.lower():
                        return True
                except Exception:
                    pass
            if f.suffix in (".js", ".ts", ".mjs"):
                try:
                    text = f.read_text(encoding="utf-8", errors="ignore")
                    if "express" in text and ("app.listen" in text or "Router()" in text):
                        return True
                except Exception:
                    pass
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        routes = []
        models = []
        modules = set()
        auth_type = "none"
        auth_roles = set()

        route_pattern = re.compile(
            r"(?:app|router)\.(get|post|put|delete|patch)\(\s*['\"`]([^'\"`]+)['\"`]\s*,\s*(?:([a-zA-Z0-9_,\s]+)\s*,\s*)?(?:async\s*)?(?:\(([^)]*)\)|function|\w+)",
            re.IGNORECASE,
        )
        mongoose_schema_pattern = re.compile(r"new\s+mongoose\.Schema\s*\(\s*\{([^;]+)\}\s*,?", re.DOTALL)
        role_pattern = re.compile(r"['\"](admin|user|manager|doctor|patient|pharmacist|customer|staff|client)['\"]", re.IGNORECASE)

        for f in files:
            if f.suffix not in (".js", ".ts", ".mjs"):
                continue

            rel_path = str(f.relative_to(root_dir)).replace("\\", "/")
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if "jwt" in content.lower() or "bearer" in content.lower():
                auth_type = "bearer"
            elif "api-key" in content.lower() or "apikey" in content.lower():
                if auth_type == "bearer":
                    auth_type = "bearer_and_api_key"
                else:
                    auth_type = "api_key"

            for role_match in role_pattern.finditer(content):
                auth_roles.add(role_match.group(1).lower())

            # Routes
            for match in route_pattern.finditer(content):
                method = match.group(1).upper()
                path = match.group(2)
                middleware_str = match.group(3) or ""
                param_names = [p.replace(":", "") for p in re.findall(r":([a-zA-Z0-9_]+)", path)]

                is_mutating = method in ("POST", "PUT", "DELETE", "PATCH")
                has_auth = "auth" in middleware_str.lower() or "protect" in middleware_str.lower() or "token" in middleware_str.lower()

                # Infer module name from path
                path_parts = [p for p in path.split("/") if p and not p.startswith(":")]
                mod_name = path_parts[1] if len(path_parts) > 1 and path_parts[0] == "api" else (path_parts[0] if path_parts else "general")
                modules.add(mod_name)

                routes.append({
                    "path": path,
                    "method": method,
                    "handler": f.stem,
                    "file_path": rel_path,
                    "params": [{"name": p, "in": "path", "required": True, "type": "string"} for p in param_names],
                    "is_mutating": is_mutating,
                    "auth_required": has_auth or (auth_type != "none"),
                    "auth_roles": list(auth_roles) if has_auth else [],
                })

            # Models
            if "mongoose" in content or "Schema" in content:
                model_match = re.search(r"mongoose\.model\(\s*['\"]([^'\"]+)['\"]", content)
                model_name = model_match.group(1) if model_match else f.stem
                if "Schema" in content:
                    models.append({
                        "model_name": model_name,
                        "fields": {"file": rel_path},
                        "relationships": [],
                    })

        return {
            "tech_stack": {
                "language": "JavaScript/TypeScript",
                "framework": "Node.js (Express)",
                "database_type": "MongoDB (Mongoose)" if models else "Unknown",
                "auth_type": auth_type,
            },
            "modules": [{"name": m, "description": f"{m.capitalize()} management module", "file_paths": []} for m in sorted(modules)],
            "routes_discovered": routes,
            "database_models": models,
            "roles": list(auth_roles),
        }


class FastApiFlaskAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.suffix == ".py":
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if "from fastapi import" in content or "import fastapi" in content or "from flask import" in content:
                        return True
                except Exception:
                    pass
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        routes = []
        models = []
        modules = set()
        auth_type = "none"
        auth_roles = set()
        is_fastapi = False

        fastapi_route_pattern = re.compile(
            r"@(app|router)\.(get|post|put|delete|patch)\(\s*['\"]([^'\"]+)['\"]",
            re.IGNORECASE,
        )
        flask_route_pattern = re.compile(
            r"@app\.route\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*methods=\[([^\]]+)\])?",
            re.IGNORECASE,
        )
        pydantic_pattern = re.compile(r"class\s+([a-zA-Z0-9_]+)\s*\(\s*BaseModel\s*\):")

        for f in files:
            if f.suffix != ".py":
                continue

            rel_path = str(f.relative_to(root_dir)).replace("\\", "/")
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if "fastapi" in content.lower():
                is_fastapi = True

            if "jwt" in content.lower() or "bearer" in content.lower() or "oauth2" in content.lower():
                auth_type = "bearer"
            elif "api_key" in content.lower() or "apikey" in content.lower():
                auth_type = "api_key"

            # FastAPI routes
            for match in fastapi_route_pattern.finditer(content):
                method = match.group(2).upper()
                path = match.group(3)
                param_names = re.findall(r"\{([a-zA-Z0-9_]+)\}", path)
                is_mutating = method in ("POST", "PUT", "DELETE", "PATCH")

                path_parts = [p for p in path.split("/") if p and not p.startswith("{")]
                mod_name = path_parts[1] if len(path_parts) > 1 and path_parts[0] == "api" else (path_parts[0] if path_parts else "general")
                modules.add(mod_name)

                routes.append({
                    "path": path,
                    "method": method,
                    "handler": f.stem,
                    "file_path": rel_path,
                    "params": [{"name": p, "in": "path", "required": True, "type": "string"} for p in param_names],
                    "is_mutating": is_mutating,
                    "auth_required": auth_type != "none",
                    "auth_roles": [],
                })

            # Flask routes
            for match in flask_route_pattern.finditer(content):
                path = match.group(1)
                methods_raw = match.group(2) or "'GET'"
                methods = [m.replace("'", "").replace('"', '').strip() for m in methods_raw.split(",")]
                param_names = re.findall(r"<(?:\w+:)?([a-zA-Z0-9_]+)>", path)

                for m in methods:
                    m_upper = m.upper()
                    routes.append({
                        "path": path,
                        "method": m_upper,
                        "handler": f.stem,
                        "file_path": rel_path,
                        "params": [{"name": p, "in": "path", "required": True, "type": "string"} for p in param_names],
                        "is_mutating": m_upper in ("POST", "PUT", "DELETE", "PATCH"),
                        "auth_required": auth_type != "none",
                        "auth_roles": [],
                    })

            # Pydantic models
            for pyd_match in pydantic_pattern.finditer(content):
                models.append({
                    "model_name": pyd_match.group(1),
                    "fields": {"file": rel_path},
                    "relationships": [],
                })

        return {
            "tech_stack": {
                "language": "Python",
                "framework": "FastAPI" if is_fastapi else "Flask",
                "database_type": "SQLAlchemy / Pydantic" if models else "Unknown",
                "auth_type": auth_type,
            },
            "modules": [{"name": m, "description": f"{m.capitalize()} module", "file_paths": []} for m in sorted(modules)],
            "routes_discovered": routes,
            "database_models": models,
            "roles": list(auth_roles),
        }


class DjangoAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.name == "manage.py":
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if "django" in content.lower():
                        return True
                except Exception:
                    pass
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        routes = []
        models = []
        modules = set()

        url_pattern = re.compile(r"path\(\s*['\"]([^'\"]+)['\"]\s*,\s*([a-zA-Z0-9_\.]+)", re.IGNORECASE)
        model_pattern = re.compile(r"class\s+([a-zA-Z0-9_]+)\s*\(\s*(?:models\.Model|Model)\s*\):")

        for f in files:
            if f.suffix != ".py":
                continue
            rel_path = str(f.relative_to(root_dir)).replace("\\", "/")
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if f.name == "urls.py":
                for match in url_pattern.finditer(content):
                    path = "/" + match.group(1).lstrip("/")
                    handler = match.group(2)
                    routes.append({
                        "path": path,
                        "method": "GET",
                        "handler": handler,
                        "file_path": rel_path,
                        "params": [],
                        "is_mutating": False,
                        "auth_required": False,
                        "auth_roles": [],
                    })
                    modules.add(f.parent.name)

            if f.name == "models.py":
                for m_match in model_pattern.finditer(content):
                    models.append({
                        "model_name": m_match.group(1),
                        "fields": {"file": rel_path},
                        "relationships": [],
                    })

        return {
            "tech_stack": {
                "language": "Python",
                "framework": "Django",
                "database_type": "Django ORM",
                "auth_type": "session_or_token",
            },
            "modules": [{"name": m, "description": f"Django {m} app", "file_paths": []} for m in sorted(modules)],
            "routes_discovered": routes,
            "database_models": models,
            "roles": ["admin", "staff", "user"],
        }


class DotNetAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.suffix == ".csproj" or (f.suffix == ".cs" and "[ApiController]" in f.read_text(encoding="utf-8", errors="ignore")):
                return True
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        routes = []
        models = []
        modules = set()

        controller_route_pattern = re.compile(r'\[Route\(\s*"([^"]+)"\s*\)\]')
        method_pattern = re.compile(r'\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)(?:\(\s*"([^"]*)"\s*\))?\]', re.IGNORECASE)

        for f in files:
            if f.suffix != ".cs":
                continue
            rel_path = str(f.relative_to(root_dir)).replace("\\", "/")
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            base_route = ""
            base_match = controller_route_pattern.search(content)
            if base_match:
                base_route = base_match.group(1).replace("[controller]", f.stem.replace("Controller", "").lower())
                if not base_route.startswith("/"):
                    base_route = "/" + base_route

            for match in method_pattern.finditer(content):
                verb = match.group(1).replace("Http", "").upper()
                sub_path = match.group(2) or ""
                final_path = (base_route + ("/" + sub_path if sub_path else "")).replace("//", "/")
                is_mutating = verb in ("POST", "PUT", "DELETE", "PATCH")

                routes.append({
                    "path": final_path or "/api",
                    "method": verb,
                    "handler": f.stem,
                    "file_path": rel_path,
                    "params": [],
                    "is_mutating": is_mutating,
                    "auth_required": "[Authorize]" in content,
                    "auth_roles": [],
                })
                modules.add(f.stem.replace("Controller", "").lower())

        return {
            "tech_stack": {
                "language": "C# (.NET)",
                "framework": "ASP.NET Core Web API",
                "database_type": "Entity Framework Core",
                "auth_type": "bearer",
            },
            "modules": [{"name": m, "description": f"{m.capitalize()} controller module", "file_paths": []} for m in sorted(modules)],
            "routes_discovered": routes,
            "database_models": models,
            "roles": [],
        }


class SpringBootAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.name in ("pom.xml", "build.gradle") and "spring-boot" in f.read_text(encoding="utf-8", errors="ignore"):
                return True
            if f.suffix == ".java" and "@RestController" in f.read_text(encoding="utf-8", errors="ignore"):
                return True
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        routes = []
        models = []
        modules = set()

        class_mapping_pattern = re.compile(r'@RequestMapping\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']')
        method_pattern = re.compile(r'@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*(?:value\s*=\s*)?["\']?([^"\']*)["\']?\)', re.IGNORECASE)

        for f in files:
            if f.suffix != ".java":
                continue
            rel_path = str(f.relative_to(root_dir)).replace("\\", "/")
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            base_path = ""
            class_match = class_mapping_pattern.search(content)
            if class_match:
                base_path = class_match.group(1)
                if not base_path.startswith("/"):
                    base_path = "/" + base_path

            for match in method_pattern.finditer(content):
                verb = match.group(1).replace("Mapping", "").upper()
                sub_path = match.group(2) or ""
                final_path = (base_path + ("/" + sub_path if sub_path else "")).replace("//", "/")
                is_mutating = verb in ("POST", "PUT", "DELETE", "PATCH")

                routes.append({
                    "path": final_path or "/api",
                    "method": verb,
                    "handler": f.stem,
                    "file_path": rel_path,
                    "params": [],
                    "is_mutating": is_mutating,
                    "auth_required": "@PreAuthorize" in content or "@Secured" in content,
                    "auth_roles": [],
                })
                modules.add(f.stem.replace("Controller", "").lower())

        return {
            "tech_stack": {
                "language": "Java",
                "framework": "Spring Boot",
                "database_type": "Spring Data JPA / Hibernate",
                "auth_type": "bearer",
            },
            "modules": [{"name": m, "description": f"Spring {m} controller module", "file_paths": []} for m in sorted(modules)],
            "routes_discovered": routes,
            "database_models": models,
            "roles": [],
        }


# ----------------------------------------------------------------------
# OpenAPI / Swagger Specification Parser
# ----------------------------------------------------------------------
def parse_openapi_spec(spec_dict: dict[str, Any]) -> dict[str, Any]:
    """Framework-independent OpenAPI 2.0 / 3.0 / 3.1 specification parser."""
    title = spec_dict.get("info", {}).get("title", "Imported API Project")
    description = spec_dict.get("info", {}).get("description", "Imported via OpenAPI/Swagger specification.")
    version = spec_dict.get("info", {}).get("version", "1.0.0")

    routes = []
    modules = set()
    candidate_intents = []
    entities = {}

    paths = spec_dict.get("paths", {})
    security_schemes = spec_dict.get("components", {}).get("securitySchemes", {}) or spec_dict.get("securityDefinitions", {})
    auth_type = "none"
    if security_schemes:
        has_bearer = any("bearer" in str(s).lower() or "jwt" in str(s).lower() for s in security_schemes.values())
        has_key = any("apikey" in str(s).lower() or "api_key" in str(s).lower() for s in security_schemes.values())
        if has_bearer and has_key:
            auth_type = "bearer_and_api_key"
        elif has_bearer:
            auth_type = "bearer"
        elif has_key:
            auth_type = "api_key"

    for path, methods_obj in paths.items():
        if not isinstance(methods_obj, dict):
            continue

        for method, op_obj in methods_obj.items():
            if method.lower() not in ("get", "post", "put", "delete", "patch"):
                continue

            method_upper = method.upper()
            summary = op_obj.get("summary") or op_obj.get("description") or f"{method_upper} {path}"
            op_id = op_obj.get("operationId") or f"{method_upper}_{path.replace('/', '_').replace('{', '').replace('}', '')}"
            tags = op_obj.get("tags", [])
            tag_name = tags[0] if tags else "General"
            modules.add(tag_name)

            params = []
            for p in op_obj.get("parameters", []):
                params.append({
                    "name": p.get("name"),
                    "in": p.get("in", "query"),
                    "required": p.get("required", False),
                    "type": p.get("schema", {}).get("type", p.get("type", "string")),
                    "description": p.get("description", ""),
                })

            is_mutating = method_upper in ("POST", "PUT", "DELETE", "PATCH")

            routes.append({
                "path": path,
                "method": method_upper,
                "summary": summary,
                "operation_id": op_id,
                "handler": op_id,
                "params": params,
                "is_mutating": is_mutating,
                "auth_required": bool(op_obj.get("security") or auth_type != "none"),
                "auth_roles": [],
                "tags": tags,
                "request_schema": op_obj.get("requestBody", {}),
                "response_schema": op_obj.get("responses", {}),
            })

            # Synthesize candidate intent
            intent_name = f"{tag_name.replace(' ', '')}_{method_upper}_{path.split('/')[-1].replace('{', '').replace('}', '') or 'Root'}"
            clean_summary = re.sub(r"[^a-zA-Z0-9\s]", "", summary).strip().lower()
            candidate_intents.append({
                "intent_name": intent_name,
                "action_type": "WRITE" if is_mutating else "READ",
                "suggested_utterances": [
                    summary,
                    f"{method_upper.lower()} {tag_name.lower()}",
                    clean_summary,
                ],
                "keywords": [tag_name.lower(), method_upper.lower()],
                "endpoint_path": path,
                "http_method": method_upper,
            })

    # Extract entities from schemas
    schemas = spec_dict.get("components", {}).get("schemas", {}) or spec_dict.get("definitions", {})
    for schema_name, schema_body in schemas.items():
        props = schema_body.get("properties", {})
        req_fields = set(schema_body.get("required", []))
        entities[schema_name] = [
            {"name": p_name, "type": p_val.get("type", "string"), "required": p_name in req_fields}
            for p_name, p_val in props.items()
        ]

    return {
        "title": title,
        "description": description,
        "version": version,
        "tech_stack": {
            "language": "OpenAPI / REST",
            "framework": f"OpenAPI {spec_dict.get('openapi', spec_dict.get('swagger', '3.0.0'))}",
            "database_type": "REST Services",
            "auth_type": auth_type,
        },
        "modules": [{"name": m, "description": f"{m} module endpoints", "file_paths": []} for m in sorted(modules)],
        "routes_discovered": routes,
        "business_entities": [{"name": k, "description": f"{k} schema entity", "fields": v} for k, v in entities.items()],
        "candidate_intents": candidate_intents,
        "verified_items": [{"category": "Route", "item": f"{r['method']} {r['path']}", "evidence": "OpenAPI spec"} for r in routes],
        "inferred_items": [{"category": "Intent", "item": it["intent_name"], "confidence": 0.85, "rationale": "Derived from OpenAPI paths & summaries"} for it in candidate_intents],
    }


# ----------------------------------------------------------------------
# Documentation Parser & Chunker
# ----------------------------------------------------------------------
def parse_markdown_docs(doc_text: str, filename: str = "README.md") -> list[dict[str, Any]]:
    """Chunks documentation by Markdown headers for grounded RAG knowledge base."""
    lines = doc_text.splitlines()
    chunks = []
    current_title = Path(filename).stem
    current_lines = []

    for line in lines:
        if re.match(r"^#{1,3}\s+(.+)", line):
            if current_lines:
                chunks.append({
                    "title": current_title,
                    "content": "\n".join(current_lines).strip(),
                    "source": filename,
                })
                current_lines = []
            header_match = re.match(r"^#{1,3}\s+(.+)", line)
            current_title = header_match.group(1).strip()
        else:
            current_lines.append(line)

    if current_lines:
        chunks.append({
            "title": current_title,
            "content": "\n".join(current_lines).strip(),
            "source": filename,
        })

    return [c for c in chunks if len(c["content"]) > 10]


# ----------------------------------------------------------------------
# Master Project Analyzer
# ----------------------------------------------------------------------
def analyze_project_directory(root_dir: Path) -> dict[str, Any]:
    """Statically analyzes directory containing extracted project files."""
    files: list[Path] = []
    total_loc = 0

    for path in root_dir.rglob("*"):
        if path.is_file():
            parts = path.parts
            if any(p in EXCLUDED_DIRS for p in parts):
                continue
            if path.suffix.lower() in EXCLUDED_EXTENSIONS:
                continue
            files.append(path)
            try:
                total_loc += sum(1 for _ in open(path, "r", encoding="utf-8", errors="ignore"))
            except Exception:
                pass

    adapters = [
        OpenApiAdapter(),
        NodeExpressAdapter(),
        FastApiFlaskAdapter(),
        DjangoAdapter(),
        DotNetAdapter(),
        SpringBootAdapter(),
    ]

    selected_adapter = None
    for a in adapters:
        if a.detect(files, root_dir):
            selected_adapter = a
            break

    if selected_adapter:
        res = selected_adapter.analyze(files, root_dir)
    else:
        res = {
            "tech_stack": {
                "language": "General Codebase",
                "framework": "Custom / Unknown",
                "database_type": "Unknown",
                "auth_type": "none",
            },
            "modules": [],
            "routes_discovered": [],
            "database_models": [],
            "roles": [],
        }

    # Extract Docs chunks
    doc_chunks = []
    for f in files:
        if f.suffix.lower() in (".md", ".txt", ".rst") and f.name.lower() in ("readme.md", "api.md", "docs.md"):
            try:
                content = f.read_text(encoding="utf-8", errors="ignore")
                doc_chunks.extend(parse_markdown_docs(content, f.name))
            except Exception:
                pass

    # Synthesize Candidate Intents from Discovered Routes
    candidate_intents = []
    for r in res.get("routes_discovered", []):
        p = r["path"]
        m = r["method"]
        parts = [x for x in p.split("/") if x and not x.startswith(":") and not x.startswith("{")]
        clean_name = "".join(x.capitalize() for x in parts) or "Root"
        intent_name = f"{m.capitalize()}{clean_name}"
        candidate_intents.append({
            "intent_name": intent_name,
            "action_type": "WRITE" if r.get("is_mutating") else "READ",
            "suggested_utterances": [
                f"{m.lower()} {p}",
                f"{'create' if r.get('is_mutating') else 'show'} {' '.join(parts)}",
                f"check {' '.join(parts)}",
            ],
            "keywords": parts + [m.lower()],
            "endpoint_path": p,
            "http_method": m,
        })

    verified_items = [
        {"category": "Route", "item": f"{r['method']} {r['path']}", "evidence": f"Found in {r.get('file_path', 'source')}"}
        for r in res.get("routes_discovered", [])
    ]
    inferred_items = [
        {"category": "Intent", "item": it["intent_name"], "confidence": 0.8, "rationale": "Inferred from route verb & path structure"}
        for it in candidate_intents
    ]

    return {
        "tech_stack": res.get("tech_stack", {}),
        "modules": res.get("modules", []),
        "routes_discovered": res.get("routes_discovered", []),
        "database_models": res.get("database_models", []),
        "doc_chunks": doc_chunks,
        "candidate_intents": candidate_intents,
        "verified_items": verified_items,
        "inferred_items": inferred_items,
        "stats": {
            "total_files": len(files),
            "lines_of_code": total_loc,
            "routes_count": len(res.get("routes_discovered", [])),
            "models_count": len(res.get("database_models", [])),
            "intents_count": len(candidate_intents),
        },
    }


class OpenApiAdapter(BaseAnalyzerAdapter):
    def detect(self, files: list[Path], root_dir: Path) -> bool:
        for f in files:
            if f.name.lower() in ("swagger.json", "openapi.json", "swagger.yaml", "openapi.yaml"):
                return True
        return False

    def analyze(self, files: list[Path], root_dir: Path) -> dict[str, Any]:
        for f in files:
            if f.name.lower() in ("swagger.json", "openapi.json", "swagger.yaml", "openapi.yaml"):
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if f.suffix in (".yaml", ".yml"):
                        spec = yaml.safe_load(content)
                    else:
                        spec = json.loads(content)
                    return parse_openapi_spec(spec)
                except Exception:
                    pass
        return {}
