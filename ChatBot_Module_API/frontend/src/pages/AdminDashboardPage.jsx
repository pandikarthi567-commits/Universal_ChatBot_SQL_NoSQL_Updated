import { UniversalSourceEditor } from "../components/UniversalSourceEditor";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  BookOpen,
  BrainCircuit,
  Building2,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Edit3,
  Eye,
  EyeOff,
  FileCode,
  FileText,
  FolderArchive,
  FolderKanban,
  Globe,
  KeyRound,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  Network,
  Play,
  Plus,
  Power,
  RefreshCw,
  Route,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { analyzeQuestion } from "../api/chatApi";
import { createEndpoint, deleteEndpoint } from "../api/endpointsApi";
import { createIntent, deleteIntent } from "../api/intentsApi";
import {
  approveEndpointApi,
  deleteProject,
  deleteProjectKnowledge,
  getProjectAnalysis,
  getProjectDetail,
  getProjectKnowledge,
  listProjects,
  patchProjectStatus,
  reanalyzeProjectApi,
  registerProject,
  testProjectConnection,
  updateProject,
} from "../api/projectsApi";
import EndpointFormModal from "../components/EndpointFormModal";
import IntentFormModal from "../components/IntentFormModal";
import KnowledgeModal from "../components/KnowledgeModal";
import ProjectAnalyzerModal from "../components/ProjectAnalyzerModal";
import ProjectModal from "../components/ProjectModal";
import CountUp from "../components/reactbits/CountUp";
import DecryptedText from "../components/reactbits/DecryptedText";
import MagnetButton from "../components/reactbits/MagnetButton";
import SplitText from "../components/reactbits/SplitText";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboardPage({ onOpenChecker }) {
  const { auth } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("analyzer");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [connResult, setConnResult] = useState(null);
  const [testingConn, setTestingConn] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [showBearer, setShowBearer] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Knowledge base state
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [editingKnowledgeItem, setEditingKnowledgeItem] = useState(null);

  // Analysis state
  const [analysisReport, setAnalysisReport] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Quick NLP state
  const [nlpQuestion, setNlpQuestion] = useState("Is Dolo 650 available in stock?");
  const [nlpResult, setNlpResult] = useState(null);
  const [nlpLoading, setNlpLoading] = useState(false);

  // Modals
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [endpointModalOpen, setEndpointModalOpen] = useState(false);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [analyzerModalOpen, setAnalyzerModalOpen] = useState(false);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadProjects = useCallback(async (keepId = null) => {
    setLoadingList(true);
    setBannerError("");
    try {
      const res = await listProjects();
      const rows = res.data || [];
      setProjects(rows);
      const nextId = keepId && rows.some((p) => p.id === keepId) ? keepId : rows[0]?.id ?? null;
      setSelectedId(nextId);
    } catch (err) {
      setBannerError(err.message || "Could not load projects.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (projectId) => {
    if (!projectId) {
      setDetail(null);
      setAnalysisReport(null);
      setKnowledgeItems([]);
      return;
    }
    setLoadingDetail(true);
    setConnResult(null);
    setNlpResult(null);
    try {
      const res = await getProjectDetail(projectId);
      setDetail(res.data);

      // Load analysis report
      try {
        const aRes = await getProjectAnalysis(projectId);
        setAnalysisReport(aRes.data);
      } catch {
        setAnalysisReport(null);
      }

      // Load knowledge items
      try {
        const kRes = await getProjectKnowledge(projectId);
        setKnowledgeItems(kRes.data?.items || []);
      } catch {
        setKnowledgeItems([]);
      }
    } catch (err) {
      setBannerError(err.message || "Could not load project detail.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleTestConnection = async () => {
    if (!detail) return;
    setTestingConn(true);
    setConnResult(null);
    try {
      const res = await testProjectConnection(detail.id);
      setConnResult({
        connected: res.data.reachable,
        status_code: res.data.status_code,
        latency_ms: res.data.latency_ms,
        message: res.data.message || (res.data.reachable ? "Connection successful" : "Unreachable"),
      });
    } catch (err) {
      setConnResult({
        connected: false,
        status_code: null,
        latency_ms: null,
        message: err.message || "Connection failed.",
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleRunQuickNlp = async (e) => {
    if (e) e.preventDefault();
    if (!nlpQuestion.trim()) return;
    setNlpLoading(true);
    setNlpResult(null);
    const start = performance.now();
    try {
      const res = await analyzeQuestion({
        question: nlpQuestion.trim(),
        projectId: detail?.id,
        projectCode: detail?.project_code,
      });
      const end = performance.now();
      setNlpResult({
        data: res.data,
        latencyMs: end - start,
      });
    } catch (err) {
      setBannerError(err.message || "NLP analysis failed.");
    } finally {
      setNlpLoading(false);
    }
  };

  const handleToggleApproveEndpoint = async (endpointId, currentStatus) => {
    try {
      await approveEndpointApi(detail.id, endpointId, !currentStatus);
      await loadDetail(detail.id);
    } catch (err) {
      setBannerError(err.message || "Could not update approval status.");
    }
  };

  const handleDeleteKnowledge = async (kId) => {
    try {
      await deleteProjectKnowledge(detail.id, kId);
      const kRes = await getProjectKnowledge(detail.id);
      setKnowledgeItems(kRes.data?.items || []);
    } catch (err) {
      setBannerError(err.message || "Could not delete knowledge item.");
    }
  };

  const handleReanalyze = async () => {
    if (!detail) return;
    setReanalyzing(true);
    try {
      await reanalyzeProjectApi(detail.id, { source_type: "base_url_probe" });
      await loadDetail(detail.id);
    } catch (err) {
      setBannerError(err.message || "Re-analysis failed.");
    } finally {
      setReanalyzing(false);
    }
  };

  const handleSaveProject = async (payload) => {
    if (editingProject) {
      await updateProject(editingProject.id, payload);
      await loadProjects(editingProject.id);
    } else {
      const res = await registerProject(payload);
      await loadProjects(res.data?.id);
    }
    setProjectModalOpen(false);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.project_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {bannerError && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError("")} className="text-rose-400 hover:text-white">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Universal AI Chatbot Studio
          </h1>
          <p className="mt-1 text-xs text-steel-400">
            Plug-and-play project-aware chatbot platform for medical shops, e-commerce, ERP, HR, and custom applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MagnetButton
            onClick={() => setAnalyzerModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:from-coral-600"
          >
            <Wand2 className="h-4 w-4" /> Auto-Analyze Application
          </MagnetButton>

          <button
            onClick={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-charcoal-700 bg-charcoal-850 px-3.5 py-2 text-xs font-semibold text-steel-300 hover:bg-charcoal-800 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Register Manually
          </button>
        </div>
      </div>

      {/* Main Grid: Projects Sidebar + Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3 lg:col-span-4"
        >
          <div className="flex items-center gap-2 rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2">
            <Search className="h-4 w-4 text-steel-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter registered applications..."
              className="w-full bg-transparent text-xs text-white placeholder-steel-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            {loadingList ? (
              <div className="flex items-center justify-center py-12 text-steel-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-charcoal-750 p-6 text-center text-xs text-steel-400">
                No applications registered yet. Click Auto-Analyze to onboard your first project!
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isSelected = proj.id === selectedId;
                return (
                  <SpotlightCard
                    key={proj.id}
                    onClick={() => setSelectedId(proj.id)}
                    className={`cursor-pointer !rounded-xl p-3.5 transition ${
                      isSelected
                        ? "border-coral-500/50 bg-coral-500/10 shadow-lg shadow-coral-500/10"
                        : "border-charcoal-800 bg-charcoal-900/60 hover:border-charcoal-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-sm font-semibold text-white">{proj.name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-coral-400">{proj.project_code}</div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-steel-400 font-mono">
                          <span className="rounded bg-charcoal-800 px-1.5 py-0.5 text-steel-300">
                            {proj.integration_mode || "MODE_B_DIRECT_API"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          proj.is_active
                            ? "border border-coral-500/30 bg-coral-500/15 text-coral-300"
                            : "border border-charcoal-700 bg-charcoal-850 text-steel-400"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${proj.is_active ? "bg-coral-500" : "bg-steel-500"}`} />
                        {proj.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                  </SpotlightCard>
                );
              })
            )}
          </div>
        </motion.aside>

        {/* Main Details Panel */}
        <section className="space-y-5 lg:col-span-8">
          {!detail ? (
            <SpotlightCard className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <Layers className="mb-3 h-10 w-10 text-coral-500/70" />
              <h3 className="font-display text-lg font-semibold text-white">Select or Add an Application</h3>
              <p className="mt-1 max-w-md text-xs text-steel-400">
                Onboard any application via ZIP upload, OpenAPI spec, docs, or base URL to enable intelligent chatbot interactions.
              </p>
              <button
                onClick={() => setAnalyzerModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25"
              >
                <Wand2 className="h-4 w-4" /> Auto-Analyze Project
              </button>
            </SpotlightCard>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={detail.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Project Header Card */}
                <SpotlightCard className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-xl font-bold text-white">{detail.name}</h2>
                        <span className="rounded-lg border border-coral-500/30 bg-coral-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-coral-300">
                          {detail.project_code}
                        </span>
                        <span className="rounded-lg border border-charcoal-700 bg-charcoal-850 px-2 py-0.5 font-mono text-[11px] text-steel-300">
                          {detail.integration_mode || "MODE_B_DIRECT_API"}
                        </span>
                        {analysisReport?.tech_stack?.framework && (
                          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                            {analysisReport.tech_stack.framework}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-steel-400">
                        <span className="inline-flex items-center gap-1.5 font-mono text-steel-300">
                          <Globe className="h-3.5 w-3.5 text-coral-500" />
                          {detail.base_url}
                        </span>
                        {detail.description && <span>• {detail.description}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <MagnetButton
                        onClick={handleTestConnection}
                        disabled={testingConn}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-coral-500/40 bg-coral-500/15 px-3 py-1.5 text-xs font-semibold text-coral-200 hover:bg-coral-500/25 disabled:opacity-60"
                      >
                        {testingConn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                        Test Connection
                      </MagnetButton>

                      <button
                        onClick={() => onOpenChecker(detail.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-steel-500/40 bg-steel-500/15 px-3 py-1.5 text-xs font-semibold text-steel-300 hover:bg-steel-500/25 hover:text-white"
                      >
                        <Terminal className="h-3.5 w-3.5 text-coral-400" /> Open Chat Studio
                      </button>
                    </div>
                  </div>

                  {/* Credentials row */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 pt-3 border-t border-charcoal-750">
                    <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-2.5">
                      <div className="flex items-center justify-between text-xs text-steel-400">
                        <span className="font-semibold text-coral-300">Bearer Token</span>
                        <div className="flex gap-2">
                          <button onClick={() => setShowBearer(!showBearer)} className="hover:text-white">
                            {showBearer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(detail.auth_config?.token, "bearer")} className="hover:text-white">
                            {copiedKey === "bearer" ? <Check className="h-3.5 w-3.5 text-coral-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 font-mono text-xs text-coral-200 truncate bg-charcoal-950 px-2 py-1 rounded">
                        {showBearer ? detail.auth_config?.token : "••••••••••••••••••••••••"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-2.5">
                      <div className="flex items-center justify-between text-xs text-steel-400">
                        <span className="font-semibold text-amber-300">Project API Key</span>
                        <div className="flex gap-2">
                          <button onClick={() => setShowApiKey(!showApiKey)} className="hover:text-white">
                            {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyToClipboard(detail.auth_config?.api_key, "apikey")} className="hover:text-white">
                            {copiedKey === "apikey" ? <Check className="h-3.5 w-3.5 text-amber-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 font-mono text-xs text-amber-200 truncate bg-charcoal-950 px-2 py-1 rounded">
                        {showApiKey ? detail.auth_config?.api_key : "••••••••••••••••••••••••"}
                      </div>
                    </div>
                  </div>

                  {connResult && (
                    <div
                      className={`mt-3 flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                        connResult.connected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {connResult.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                        <span>{connResult.message}</span>
                      </div>
                      {connResult.latency_ms && <span className="font-mono">{connResult.latency_ms} ms</span>}
                    </div>
                  )}
                </SpotlightCard>

                {/* Sub-Tabs Navigation */}
                <div className="glass-panel rounded-2xl p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-750 pb-3">
                    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-charcoal-900/90 p-1">
                      {[
                        { id: "analyzer", label: "Static Analysis", icon: Wand2 },
                        { id: "endpoints", label: `Endpoints (${detail.endpoints?.length || 0})`, icon: Route },
                        { id: "knowledge", label: `Knowledge Base (${knowledgeItems.length})`, icon: BookOpen },
                        { id: "intents", label: `Intents (${detail.intents?.length || 0})`, icon: BrainCircuit },
                        { id: "nlp", label: "NLP Playground", icon: Play },
                        { id: "guide", label: "Integration Guide", icon: Code2 },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const active = subTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              active ? "bg-coral-500/20 text-coral-300 border border-coral-500/40" : "text-steel-400 hover:text-white"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadDetail(detail.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-charcoal-700 px-2.5 py-1.5 text-xs text-steel-300 hover:bg-charcoal-800 hover:text-white"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingDetail ? "animate-spin" : ""}`} /> Refresh
                      </button>

                      {subTab === "endpoints" && (
                        <button
                          onClick={() => setEndpointModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-coral-500/40 bg-coral-500/20 px-3 py-1.5 text-xs font-semibold text-coral-200 hover:bg-coral-500/30"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Endpoint
                        </button>
                      )}

                      {subTab === "knowledge" && (
                        <button
                          onClick={() => {
                            setEditingKnowledgeItem(null);
                            setKnowledgeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Knowledge Item
                        </button>
                      )}

                      {subTab === "intents" && (
                        <button
                          onClick={() => setIntentModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-steel-500/40 bg-steel-500/20 px-3 py-1.5 text-xs font-semibold text-steel-200 hover:bg-steel-500/30"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Intent
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. Tab: Static Analysis Report */}
                  {subTab === "analyzer" && (
                    <div className="space-y-4">
                      {analysisReport ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-3 text-center">
                              <div className="text-xl font-bold text-coral-400">
                                {analysisReport.stats?.routes_count || detail.endpoints?.length || 0}
                              </div>
                              <div className="text-[11px] text-steel-400">Discovered Routes</div>
                            </div>
                            <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-3 text-center">
                              <div className="text-xl font-bold text-emerald-400">
                                {analysisReport.stats?.models_count || 0}
                              </div>
                              <div className="text-[11px] text-steel-400">Data Models</div>
                            </div>
                            <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-3 text-center">
                              <div className="text-xl font-bold text-amber-400">
                                {analysisReport.candidate_intents?.length || detail.intents?.length || 0}
                              </div>
                              <div className="text-[11px] text-steel-400">Candidate Intents</div>
                            </div>
                            <div className="rounded-xl border border-charcoal-750 bg-charcoal-900/60 p-3 text-center">
                              <div className="text-sm font-bold text-white truncate">
                                {analysisReport.tech_stack?.framework || "REST API"}
                              </div>
                              <div className="text-[11px] text-steel-400">Framework</div>
                            </div>
                          </div>

                          {/* Discovered Modules */}
                          {analysisReport.modules?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-white mb-2">Discovered Application Modules</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {analysisReport.modules.map((m, idx) => (
                                  <div key={idx} className="rounded-lg border border-charcoal-800 bg-charcoal-950 p-2.5 text-xs">
                                    <div className="font-semibold text-coral-300">{m.name}</div>
                                    <div className="text-steel-400 text-[11px]">{m.description}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Verified vs Inferred Breakdown */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-charcoal-750">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                Verified Analysis Items ({analysisReport.verified_items?.length || 0})
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                {(analysisReport.verified_items || []).slice(0, 10).map((vi, idx) => (
                                  <div key={idx} className="rounded border border-charcoal-800 bg-charcoal-950 px-2 py-1 text-[11px]">
                                    <span className="font-mono text-emerald-400">[{vi.category}]</span>{" "}
                                    <span className="text-steel-200">{vi.item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-2">
                                <Lightbulb className="h-4 w-4 text-amber-400" />
                                Inferred Items & Intents ({analysisReport.inferred_items?.length || 0})
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                {(analysisReport.inferred_items || []).slice(0, 10).map((ii, idx) => (
                                  <div key={idx} className="rounded border border-charcoal-800 bg-charcoal-950 px-2 py-1 text-[11px]">
                                    <span className="font-mono text-amber-400">[{ii.category}]</span>{" "}
                                    <span className="text-steel-200">{ii.item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-charcoal-750 p-8 text-center text-xs text-steel-400 space-y-3">
                          <p>No static analysis has been performed on this project yet.</p>
                          <button
                            onClick={() => setAnalyzerModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-coral-500/20 border border-coral-500/40 px-3 py-1.5 text-xs font-semibold text-coral-300 hover:bg-coral-500/30"
                          >
                            <Wand2 className="h-3.5 w-3.5" /> Analyze Project Code or Spec
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Tab: Endpoints & Approval */}
                  {subTab === "endpoints" && (
                    <div className="space-y-3">
                      {detail.endpoints?.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-charcoal-750 p-8 text-center text-xs text-steel-400">
                          No endpoints discovered or created yet.
                        </div>
                      ) : (
                        detail.endpoints.map((ep) => (
                          <SpotlightCard key={ep.id} className="!rounded-xl p-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                                      ep.http_method === "POST"
                                        ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                                        : ep.http_method === "DELETE"
                                        ? "border border-rose-500/40 bg-rose-500/20 text-rose-300"
                                        : "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                                    }`}
                                  >
                                    {ep.http_method}
                                  </span>
                                  <span className="font-display text-sm font-semibold text-white">{ep.name}</span>
                                  <code className="font-mono text-xs text-coral-300">{ep.path}</code>

                                  {ep.is_mutating && (
                                    <span className="rounded bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-300">
                                      Mutating Action
                                    </span>
                                  )}
                                </div>

                                {ep.description && <p className="text-xs text-steel-400">{ep.description}</p>}

                                {ep.expected_params?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {ep.expected_params.map((p, idx) => (
                                      <span key={idx} className="rounded bg-charcoal-800 px-2 py-0.5 font-mono text-[10px] text-steel-300">
                                        {p.name} {p.required && <span className="text-rose-400">*</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleApproveEndpoint(ep.id, ep.is_approved)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                    ep.is_approved
                                      ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                      : "border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                  }`}
                                  title="Approve or disapprove endpoint for live execution"
                                >
                                  {ep.is_approved ? "✓ Approved" : "Pending Approval"}
                                </button>

                                <button
                                  onClick={async () => {
                                    await deleteEndpoint(detail.id, ep.id);
                                    await loadDetail(detail.id);
                                  }}
                                  className="rounded-lg p-1.5 text-steel-400 hover:bg-rose-500/15 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </SpotlightCard>
                        ))
                      )}
                    </div>
                  )}

                  {/* 3. Tab: Grounded Knowledge Base */}
                  {subTab === "knowledge" && (
                    <div className="space-y-3">
                      {knowledgeItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-charcoal-750 p-8 text-center text-xs text-steel-400">
                          No knowledge chunks found. Add documentation, FAQs, or policies to ground the chatbot's answers.
                        </div>
                      ) : (
                        knowledgeItems.map((item) => (
                          <SpotlightCard key={item.id} className="!rounded-xl p-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-coral-500/20 border border-coral-500/40 px-2 py-0.5 text-[10px] font-semibold text-coral-300">
                                    {item.category}
                                  </span>
                                  <h4 className="font-display text-sm font-semibold text-white">{item.title}</h4>
                                </div>
                                <p className="text-xs text-steel-300 leading-relaxed whitespace-pre-line">{item.content}</p>
                                {item.keywords?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {item.keywords.map((k, i) => (
                                      <span key={i} className="rounded bg-charcoal-800 px-1.5 py-0.5 text-[10px] text-steel-400">
                                        #{k}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteKnowledge(item.id)}
                                className="rounded-lg p-1.5 text-steel-400 hover:bg-rose-500/15 hover:text-rose-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </SpotlightCard>
                        ))
                      )}
                    </div>
                  )}

                  {/* 4. Tab: Intents */}
                  {subTab === "intents" && (
                    <div className="space-y-3">
                      {detail.intents?.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-charcoal-750 p-8 text-center text-xs text-steel-400">
                          No intents configured yet.
                        </div>
                      ) : (
                        detail.intents.map((it) => (
                          <SpotlightCard key={it.id} className="!rounded-xl p-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-mono text-xs font-bold text-coral-400">{it.intent_name}</div>
                                {it.description && <div className="text-[11px] text-steel-400 mt-0.5">{it.description}</div>}
                                {it.sample_utterances?.length > 0 && (
                                  <div className="mt-2 text-[11px] text-steel-300">
                                    <span className="text-steel-500">Utterances:</span> {it.sample_utterances.slice(0, 4).join(" • ")}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  await deleteIntent(detail.id, it.id);
                                  await loadDetail(detail.id);
                                }}
                                className="rounded-lg p-1.5 text-steel-400 hover:bg-rose-500/15 hover:text-rose-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </SpotlightCard>
                        ))
                      )}
                    </div>
                  )}

                  {/* 5. Tab: NLP Playground */}
                  {subTab === "nlp" && (
                    <div className="space-y-4">
                      {/* Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-steel-400">
                        <span>Sample phrases:</span>
                        {[
                          "Is Dolo 650 available in stock?",
                          "What is its price?",
                          "Dolo 650 irukka?",
                          "Vilai enna?",
                          "Add 2 to my cart",
                          "What is your return policy?",
                        ].map((ph, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setNlpQuestion(ph)}
                            className="rounded-lg border border-charcoal-750 bg-charcoal-900 px-2 py-0.5 text-[11px] text-coral-300 hover:border-coral-500/50"
                          >
                            {ph}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleRunQuickNlp} className="flex gap-2">
                        <input
                          value={nlpQuestion}
                          onChange={(e) => setNlpQuestion(e.target.value)}
                          placeholder="Test English, Tamil, or Tanglish questions..."
                          className="flex-1 rounded-xl border border-charcoal-750 bg-charcoal-950 px-3.5 py-2 text-sm text-white outline-none focus:border-coral-500"
                        />
                        <button
                          type="submit"
                          disabled={nlpLoading}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-coral-500/25 hover:from-coral-600"
                        >
                          {nlpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Analyze
                        </button>
                      </form>

                      {nlpResult && (
                        <div className="space-y-3 rounded-xl border border-charcoal-750 bg-charcoal-950 p-4 font-mono text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-750 pb-2">
                            <span>
                              Detected Intent:{" "}
                              <strong className="text-coral-300">{nlpResult.data.intent || "UNKNOWN"}</strong>{" "}
                              (<CountUp to={(nlpResult.data.confidence || 0) * 100} suffix="%" />)
                            </span>
                            <span className="text-steel-400">
                              Language Hint:{" "}
                              <strong className="text-emerald-300">{nlpResult.data.language_hint || "en"}</strong>
                            </span>
                          </div>

                          <div className="text-steel-300">
                            Planned Endpoint:{" "}
                            <span className="text-coral-300">
                              {nlpResult.data.planned_endpoint_name || "None / Knowledge Grounding"}
                            </span>
                          </div>

                          <div className="text-steel-300">
                            Extracted Entities:{" "}
                            <span className="text-amber-300">{JSON.stringify(nlpResult.data.entities || {})}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. Tab: Integration Documentation */}
                  {subTab === "guide" && (
                    <div className="space-y-4 text-xs">
                      <p className="text-steel-300 leading-relaxed">
                        Integrate this AI Chatbot Module with your software application using the universal REST endpoints below.
                      </p>

                      <UniversalSourceEditor key={detail.id} project={detail} />
                      <div className="rounded-xl border border-charcoal-750 bg-charcoal-950 p-4 space-y-2">
                        <div className="font-semibold text-coral-300">Project chat endpoint</div>
                        <pre className="overflow-x-auto">{`POST /api/chat/${detail.project_code.toLowerCase()}\nX-API-Key: <SERVER_SIDE_PROJECT_KEY>\nContent-Type: application/json\n\n{"session_id":"unique-session","question":"count products"}`}</pre>
                        <p>Keep project credentials on your server, not in public browser or desktop bundles.</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </section>
      </div>

      {/* Modals */}
      <ProjectAnalyzerModal
        open={analyzerModalOpen}
        onClose={() => setAnalyzerModalOpen(false)}
        onProjectCreated={(newProj) => {
          loadProjects(newProj.id);
          setAnalyzerModalOpen(false);
        }}
      />

      <KnowledgeModal
        open={knowledgeModalOpen}
        projectId={detail?.id}
        initialItem={editingKnowledgeItem}
        onClose={() => setKnowledgeModalOpen(false)}
        onSaved={async () => {
          const kRes = await getProjectKnowledge(detail.id);
          setKnowledgeItems(kRes.data?.items || []);
        }}
      />

      <ProjectModal
        open={projectModalOpen}
        initialProject={editingProject}
        onClose={() => setProjectModalOpen(false)}
        onSubmit={handleSaveProject}
      />

      <EndpointFormModal
        open={endpointModalOpen}
        onClose={() => setEndpointModalOpen(false)}
        onSubmit={async (payload) => {
          await createEndpoint(detail.id, payload);
          await loadDetail(detail.id);
        }}
      />

      <IntentFormModal
        open={intentModalOpen}
        endpoints={detail?.endpoints || []}
        onClose={() => setIntentModalOpen(false)}
        onSubmit={async (payload) => {
          await createIntent(detail.id, payload);
          await loadDetail(detail.id);
        }}
      />
    </div>
  );
}
