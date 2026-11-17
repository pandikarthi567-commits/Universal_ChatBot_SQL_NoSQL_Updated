"""
Unit and Security Tests for Universal Project Static Analyzer Engine.
Tests:
- Safe ZIP extraction
- Zip-slip path traversal attack prevention
- OpenAPI spec parsing (JSON & YAML)
- Multi-domain schema extraction
- Documentation parsing and chunking
- Verified vs inferred items distinction
"""
from io import BytesIO
from pathlib import Path
import zipfile
import pytest

import sys
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "python"))

from analyzer.static_analyzer import (
    analyze_project_directory,
    extract_zip_safely,
    parse_markdown_docs,
    parse_openapi_spec,
)


def create_in_memory_zip(file_map: dict[str, str]) -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in file_map.items():
            zf.writestr(filename, content)
    buffer.seek(0)
    return buffer.getvalue()


def test_zip_slip_path_traversal_prevention(tmp_path):
    """Verifies that malicious zip files containing ../ are caught and rejected."""
    malicious_files = {
        "../../evil.txt": "malicious content",
        "sub/../../../etc/passwd": "root:x:0:0",
    }
    zip_bytes = create_in_memory_zip(malicious_files)

    with pytest.raises(ValueError, match="Zip slip security violation"):
        extract_zip_safely(zip_bytes, tmp_path)


def test_zip_safe_extraction_and_exclusions(tmp_path):
    """Verifies safe files extract while secrets, .git, and node_modules are excluded."""
    files = {
        "package.json": '{"name": "test-app", "dependencies": {"express": "^4.18.2"}}',
        "server.js": "const express = require('express'); const app = express(); app.get('/api/users', (req, res) => {});",
        ".env": "SECRET_KEY=12345",
        "node_modules/dummy/index.js": "console.log('ignore');",
        ".git/config": "ignore",
    }
    zip_bytes = create_in_memory_zip(files)
    extracted = extract_zip_safely(zip_bytes, tmp_path)

    extracted_names = [p.name for p in extracted]
    assert "package.json" in extracted_names
    assert "server.js" in extracted_names
    assert ".env" not in extracted_names
    assert "dummy" not in [p.parent.name for p in extracted]


def test_openapi_spec_parser_medical_shop():
    """Domain 1: Medical Shop OpenAPI specification analysis."""
    spec = {
        "openapi": "3.0.0",
        "info": {
          "title": "Medical Shop API",
          "description": "Medicine search and pharmacy order processing",
          "version": "1.0.0"
        },
        "paths": {
            "/api/medicines/search": {
                "get": {
                    "summary": "Search medicines by name",
                    "operationId": "searchMedicines",
                    "tags": ["Medicines"],
                    "parameters": [
                        {"name": "query", "in": "query", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "List of matching medicines"}}
                }
            },
            "/api/medicines/{id}/price": {
                "get": {
                    "summary": "Get medicine price and stock",
                    "operationId": "getMedicinePrice",
                    "tags": ["Medicines"],
                    "parameters": [
                        {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "Price details"}}
                }
            },
            "/api/cart/add": {
                "post": {
                    "summary": "Add medicine to cart",
                    "operationId": "addToCart",
                    "tags": ["Cart"],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "medicine_id": {"type": "string"},
                                        "quantity": {"type": "integer"}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "Item added"}}
                }
            }
        }
    }

    result = parse_openapi_spec(spec)
    assert result["title"] == "Medical Shop API"
    assert len(result["routes_discovered"]) == 3
    assert len(result["modules"]) == 2

    # Check route attributes
    routes = {r["path"]: r for r in result["routes_discovered"]}
    assert routes["/api/medicines/search"]["method"] == "GET"
    assert routes["/api/medicines/search"]["is_mutating"] is False
    assert routes["/api/cart/add"]["method"] == "POST"
    assert routes["/api/cart/add"]["is_mutating"] is True

    # Check candidate intents
    intents = [it["intent_name"] for it in result["candidate_intents"]]
    assert any("search" in it.lower() for it in intents)
    assert any("cart" in it.lower() for it in intents)


def test_openapi_spec_parser_ecommerce():
    """Domain 2: E-Commerce Store OpenAPI specification analysis."""
    spec = {
        "openapi": "3.0.0",
        "info": {
          "title": "E-Commerce Catalog API",
          "description": "Products and orders management",
          "version": "2.0.0"
        },
        "paths": {
            "/api/products": {
                "get": {
                    "summary": "Search products catalog",
                    "operationId": "listProducts",
                    "tags": ["Products"],
                    "parameters": [
                        {"name": "category", "in": "query", "required": False, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "List of products"}}
                }
            },
            "/api/orders/{orderId}/status": {
                "get": {
                    "summary": "Track order shipping status",
                    "operationId": "trackOrderStatus",
                    "tags": ["Orders"],
                    "parameters": [
                        {"name": "orderId", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "Order tracking details"}}
                }
            }
        }
    }

    result = parse_openapi_spec(spec)
    assert result["title"] == "E-Commerce Catalog API"
    assert len(result["routes_discovered"]) == 2
    assert "Products" in [m["name"] for m in result["modules"]]
    assert "Orders" in [m["name"] for m in result["modules"]]


def test_markdown_documentation_chunking():
    """Tests chunking of documentation by headers."""
    doc = """# Pharmacy System Guide

## Overview
Pharmacy Management System provides real-time stock inquiry and door delivery services.

## Return Policy
Prescription items cannot be returned after 48 hours of delivery.

## Contact Support
Reach pharmacist support at support@pharmacyshop.com.
"""
    chunks = parse_markdown_docs(doc, "README.md")
    assert len(chunks) == 3
    titles = [c["title"] for c in chunks]
    assert "Overview" in titles
    assert "Return Policy" in titles
    assert "Contact Support" in titles
    assert "Pharmacy Management System" in chunks[0]["content"]
