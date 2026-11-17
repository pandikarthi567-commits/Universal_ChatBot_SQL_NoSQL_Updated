import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  FileCode,
  FileText,
  FileUp,
  FolderArchive,
  Globe,
  Layers,
  Loader2,
  Network,
  Play,
  Route,
  Shield,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { analyzeProjectApi } from "../api/projectsApi";

const PRESET_OPENAPI_SPECS = {
  medical_shop: JSON.stringify(
    {
      openapi: "3.0.0",
      info: {
        title: "Medical Shop & Pharmacy API",
        version: "1.0.0",
        description: "Pharmaceutical inventory, medicine search, prescription verification, and order processing API.",
      },
      paths: {
        "/api/medicines/search": {
          get: {
            summary: "Search medicines by name or generic salt",
            operationId: "searchMedicines",
            parameters: [
              { name: "name", in: "query", required: true, schema: { type: "string" }, description: "Medicine name e.g. Dolo 650" },
              { name: "dosage", in: "query", required: false, schema: { type: "string" } },
            ],
            responses: { 200: { description: "Matching medicines list" } },
          },
        },
        "/api/medicines/{id}/price": {
          get: {
            summary: "Check medicine price and stock availability",
            operationId: "getMedicinePrice",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { 200: { description: "Price and stock details" } },
          },
        },
        "/api/cart/add": {
          post: {
            summary: "Add medicine to customer cart",
            operationId: "addToCart",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["medicine_id", "quantity"],
                    properties: {
                      medicine_id: { type: "string" },
                      quantity: { type: "integer", default: 1 },
                    },
                  },
                },
              },
            },
            responses: { 200: { description: "Item added to cart" } },
          },
        },
      },
    },
    null,
    2
  ),
  ecommerce: JSON.stringify(
    {
      openapi: "3.0.0",
      info: {
        title: "E-Commerce Retail Store API",
        version: "2.1.0",
        description: "Product catalog, inventory stock, order tracking, and shopping cart API.",
      },
      paths: {
        "/api/products": {
          get: {
            summary: "List or search products",
            operationId: "getProducts",
            parameters: [
              { name: "category", in: "query", schema: { type: "string" } },
              { name: "query", in: "query", schema: { type: "string" } },
            ],
            responses: { 200: { description: "List of catalog products" } },
          },
        },
        "/api/orders/{orderId}/status": {
          get: {
            summary: "Track order shipping and delivery status",
            operationId: "getOrderStatus",
            parameters: [
              { name: "orderId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { 200: { description: "Order tracking status" } },
          },
        },
      },
    },
    null,
    2
  ),
};

export default function ProjectAnalyzerModal({ open, onClose, onProjectCreated }) {
  const [tab, setTab] = useState("spec"); // "zip" | "spec" | "docs" | "probe"
  const [name, setName] = useState("Medical Shop API");
  const [projectCode, setProjectCode] = useState("MEDSHOP");
  const [baseUrl, setBaseUrl] = useState("http://localhost:5000");
  const [integrationMode, setIntegrationMode] = useState("MODE_B_DIRECT_API");

  // Tab payloads
  const [specContent, setSpecContent] = useState(PRESET_OPENAPI_SPECS.medical_shop);
  const [specFormat, setSpecFormat] = useState("json");
  const [docsText, setDocsText] = useState(
    "# Medical Shop Knowledge Base\n\n## Overview\nOnline Pharmacy & Medical Shop management application providing prescription fulfillment, medicine pricing, and door delivery.\n\n## Return Policy\nMedicines can be returned within 48 hours with original packaging and intact blister seals.\n\n## Delivery Times\nStandard delivery takes 2 to 4 hours in metro areas. Express delivery is available for urgent medications."
  );
  const [zipBase64, setZipBase64] = useState(null);
  const [zipFileName, setZipFileName] = useState("");
  const [healthPath, setHealthPath] = useState("/health");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  if (!open) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setError("Please select a valid .zip archive.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File exceeds 50MB limit.");
      return;
    }

    setError("");
    setZipFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      setZipBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAnalysis = async () => {
    if (!name.trim() || !projectCode.trim()) {
      setError("Project Name and Code are required.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysisResult(null);

    const payload = {
      name: name.trim(),
      project_code: projectCode.trim().toUpperCase(),
      base_url: baseUrl.trim(),
      integration_mode: integrationMode,
      source_type:
        tab === "zip"
          ? "zip_upload"
          : tab === "spec"
          ? "openapi_spec"
          : tab === "docs"
          ? "docs_import"
          : "base_url_probe",
      zip_base64: zipBase64,
      spec_content: specContent,
      spec_format: specFormat,
      docs_text: docsText,
      health_path: healthPath,
    };

    try {
      const res = await analyzeProjectApi(payload);
      if (res.data?.success) {
        setAnalysisResult(res.data);
        if (onProjectCreated) {
          onProjectCreated(res.data.project);
        }
      } else {
        setError(res.data?.detail || "Analysis failed.");
      }
    } catch (err) {
      setError(err.message || "Failed to analyze project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-charcoal-700 bg-charcoal-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-charcoal-750 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/25">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Automatic Project Analyzer & Onboarding Studio
              </h2>
              <p className="text-xs text-steel-400">
                Statically analyze any application, extract endpoints, models, and candidate intents.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-steel-400 hover:bg-charcoal-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[calc(92vh-140px)] overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Identity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!projectCode || projectCode === "MEDSHOP") {
                    setProjectCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10));
                  }
                }}
                className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 text-xs text-white focus:border-coral-500 focus:outline-none"
                placeholder="e.g. Medical Shop"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">Project Code</label>
              <input
                type="text"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 font-mono text-xs text-coral-300 focus:border-coral-500 focus:outline-none"
                placeholder="e.g. MEDSHOP"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">API Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 font-mono text-xs text-steel-300 focus:border-coral-500 focus:outline-none"
                placeholder="http://localhost:5000"
              />
            </div>
          </div>

          {/* Integration Mode Choice */}
          <div className="rounded-xl border border-charcoal-750 bg-charcoal-950/60 p-3.5">
            <label className="mb-1.5 block text-xs font-semibold text-white">Integration Mode</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { id: "MODE_A_KNOWLEDGE", label: "Mode A: Grounded Knowledge", desc: "Answers via FAQs, workflows, documentation" },
                { id: "MODE_B_DIRECT_API", label: "Mode B: Direct API Execution", desc: "Selects and executes approved project endpoints" },
                { id: "MODE_C_EXTERNAL", label: "Mode C: External Execution", desc: "Dispatches NLP payload to external app" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setIntegrationMode(m.id)}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    integrationMode === m.id
                      ? "border-coral-500 bg-coral-500/10 text-white"
                      : "border-charcoal-800 bg-charcoal-900/60 text-steel-400 hover:border-charcoal-700"
                  }`}
                >
                  <div className="text-xs font-semibold">{m.label}</div>
                  <div className="mt-0.5 text-[10px] text-steel-500">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Import Source Tabs */}
          <div>
            <div className="flex border-b border-charcoal-750 gap-2">
              {[
                { id: "spec", label: "OpenAPI / Swagger Spec", icon: Code2 },
                { id: "zip", label: "Project ZIP Upload", icon: FolderArchive },
                { id: "docs", label: "Documentation Import", icon: BookOpen },
                { id: "probe", label: "Live Base URL Probe", icon: Network },
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
                      active
                        ? "border-coral-500 text-coral-400 font-semibold"
                        : "border-transparent text-steel-400 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: OpenAPI Spec */}
            {tab === "spec" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steel-400">
                    Paste OpenAPI 2.0 / 3.0 / 3.1 JSON or YAML specification:
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSpecContent(PRESET_OPENAPI_SPECS.medical_shop);
                        setName("Medical Shop API");
                        setProjectCode("MEDSHOP");
                      }}
                      className="text-[11px] text-coral-400 underline hover:text-coral-300"
                    >
                      Load Medical Shop Spec
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpecContent(PRESET_OPENAPI_SPECS.ecommerce);
                        setName("E-Commerce Store");
                        setProjectCode("ECOMM");
                      }}
                      className="text-[11px] text-steel-400 underline hover:text-white"
                    >
                      Load E-Commerce Spec
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 p-3 font-mono text-xs text-steel-200 focus:border-coral-500 focus:outline-none"
                  placeholder="Paste OpenAPI JSON / YAML..."
                />
              </div>
            )}

            {/* Tab 2: ZIP Upload */}
            {tab === "zip" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border-2 border-dashed border-charcoal-700 bg-charcoal-950/40 p-6 text-center hover:border-coral-500/50 transition">
                  <UploadCloud className="mx-auto mb-2 h-8 w-8 text-coral-400" />
                  <div className="text-xs font-semibold text-white">
                    {zipFileName ? zipFileName : "Select a Project ZIP archive"}
                  </div>
                  <p className="mt-1 text-[11px] text-steel-500">
                    Supports Node.js/Express, Python FastAPI/Flask, Django, ASP.NET Core, and Spring Boot.
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-coral-500/40 bg-coral-500/15 px-3 py-1.5 text-xs font-medium text-coral-300 hover:bg-coral-500/25">
                    Browse File
                    <input type="file" accept=".zip" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-steel-500">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Safe static analysis. Never executes uploaded code. Ignores node_modules, .venv, .git, and secrets.
                  </span>
                </div>
              </div>
            )}

            {/* Tab 3: Documentation Import */}
            {tab === "docs" && (
              <div className="mt-4 space-y-3">
                <span className="text-xs text-steel-400">
                  Paste application documentation or README Markdown for grounded knowledge extraction:
                </span>
                <textarea
                  rows={8}
                  value={docsText}
                  onChange={(e) => setDocsText(e.target.value)}
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 p-3 font-mono text-xs text-steel-200 focus:border-coral-500 focus:outline-none"
                  placeholder="# Application Overview..."
                />
              </div>
            )}

            {/* Tab 4: Live Probe */}
            {tab === "probe" && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-charcoal-750 bg-charcoal-950/60 p-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-steel-300">Base URL</label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 font-mono text-xs text-white focus:border-coral-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-steel-300">Health Endpoint Path</label>
                    <input
                      type="text"
                      value={healthPath}
                      onChange={(e) => setHealthPath(e.target.value)}
                      className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 font-mono text-xs text-white focus:border-coral-500 focus:outline-none"
                      placeholder="/health"
                    />
                  </div>
                  <p className="text-[11px] text-steel-500">
                    The prober checks connectivity and attempts to discover exposed Swagger/OpenAPI documentation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Results Preview */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Analysis Completed Successfully!
                </div>
                <span className="font-mono text-[11px] text-emerald-400">
                  Status: Ready for Chatbot Execution
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-center">
                <div className="rounded-lg bg-charcoal-900/60 p-2">
                  <div className="text-lg font-bold text-white">
                    {analysisResult.endpoints_discovered || analysisResult.analysis?.routes_discovered?.length || 0}
                  </div>
                  <div className="text-[10px] text-steel-400">Endpoints Discovered</div>
                </div>
                <div className="rounded-lg bg-charcoal-900/60 p-2">
                  <div className="text-lg font-bold text-white">
                    {analysisResult.intents_created || analysisResult.analysis?.candidate_intents?.length || 0}
                  </div>
                  <div className="text-[10px] text-steel-400">Intents Synthesized</div>
                </div>
                <div className="rounded-lg bg-charcoal-900/60 p-2">
                  <div className="text-lg font-bold text-white">
                    {analysisResult.knowledge_items_created || 0}
                  </div>
                  <div className="text-[10px] text-steel-400">Knowledge Chunks</div>
                </div>
                <div className="rounded-lg bg-charcoal-900/60 p-2">
                  <div className="text-xs font-bold text-coral-400 truncate">
                    {analysisResult.analysis?.tech_stack?.framework || "REST API"}
                  </div>
                  <div className="text-[10px] text-steel-400">Framework</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-charcoal-750 px-6 py-3.5 bg-charcoal-950/40">
          <button
            onClick={onClose}
            className="rounded-xl border border-charcoal-700 px-4 py-2 text-xs font-medium text-steel-400 hover:bg-charcoal-800 hover:text-white"
          >
            {analysisResult ? "Done" : "Cancel"}
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:from-coral-600 hover:to-coral-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Project...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run Automatic Analysis
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
