import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  FileText,
  History,
  Layers,
  Loader2,
  Play,
  Plus,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import {
  analyzeQuestion,
  askQuestion,
  clearAllHistory,
  clearSession,
  completeExternal,
  confirmAction,
  deleteSessionHistory,
  getSessionHistory,
} from "../api/chatApi";
import { listProjects } from "../api/projectsApi";
import CountUp from "../components/reactbits/CountUp";
import DecryptedText from "../components/reactbits/DecryptedText";
import MagnetButton from "../components/reactbits/MagnetButton";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import { useAuth } from "../context/AuthContext";

const SAMPLE_PRESETS = [
  { label: "1. Medicine Stock", text: "Is Dolo 650 available in stock?", lang: "EN" },
  { label: "2. Anaphora: 'its price'", text: "What is its price?", lang: "EN" },
  { label: "3. Action: 'add two'", text: "Add two to my cart", lang: "EN" },
  { label: "4. Return Policy", text: "What is your return policy?", lang: "EN" },
  { label: "5. Tanglish: 'irukka?'", text: "Dolo 650 irukka?", lang: "TA" },
  { label: "6. Tanglish: 'vilai enna?'", text: "Vilai enna?", lang: "TA" },
];

export default function ApiCheckingPage({ initialProjectId = null }) {
  const { auth } = useAuth();
  const isAdmin = auth?.role === "admin";

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || "");
  const [question, setQuestion] = useState("Is Dolo 650 available in stock?");
  const [activeTab, setActiveTab] = useState("live");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState([]);
  const [lastDebug, setLastDebug] = useState(null);

  const selectedProject = projects.find((p) => String(p.id) === String(selectedProjectId));

  useEffect(() => {
    listProjects()
      .then((res) => {
        const list = res.data || [];
        setProjects(list);
        if (!selectedProjectId && list[0]?.id) {
          setSelectedProjectId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, [selectedProjectId]);

  const handleAsk = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    setError("");
    setLoading(true);

    const activeSession = selectedProject
      ? `SESSION-${selectedProject.project_code}`
      : "DEFAULT-SESSION";

    try {
      const res = await askQuestion({
        sessionId: activeSession,
        question: question.trim(),
        projectId: selectedProjectId ? Number(selectedProjectId) : null,
        projectCode: selectedProject?.project_code,
      });

      const responseData = res.data;

      setFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          question: question.trim(),
          response: responseData,
          latencyMs: res.latencyMs,
          status: res.status,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      setLastDebug({
        endpoint: "POST /api/chat/ask",
        status: res.status,
        latencyMs: res.latencyMs,
        payload: {
          request: {
            session_id: activeSession,
            question: question.trim(),
            project_code: selectedProject?.project_code,
          },
          response: responseData,
        },
      });
    } catch (err) {
      setError(err.message || "Chat ask failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (correlationId, confirmed) => {
    if (!correlationId) return;
    setActionLoading(true);
    const activeSession = selectedProject
      ? `SESSION-${selectedProject.project_code}`
      : "DEFAULT-SESSION";

    try {
      const res = await confirmAction({
        correlationId,
        confirmed,
        sessionId: activeSession,
        projectId: selectedProjectId,
      });

      setFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          question: confirmed ? "Confirmed Action" : "Cancelled Action",
          response: res.data,
          latencyMs: res.latencyMs,
          status: res.status,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err.message || "Failed to confirm action.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteExternal = async (correlationId) => {
    if (!correlationId) return;
    setActionLoading(true);
    const activeSession = selectedProject
      ? `SESSION-${selectedProject.project_code}`
      : "DEFAULT-SESSION";

    try {
      const simulatedResult = {
        status: "SUCCESS",
        message: "External business logic executed successfully.",
        timestamp: new Date().toISOString(),
      };

      const res = await completeExternal({
        correlationId,
        resultData: simulatedResult,
        sessionId: activeSession,
        projectId: selectedProjectId,
      });

      setFeed((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          question: "External Completion Dispatched",
          response: res.data,
          latencyMs: res.latencyMs,
          status: res.status,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err.message || "Failed to dispatch completion.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearSession = async () => {
    const activeSession = selectedProject
      ? `SESSION-${selectedProject.project_code}`
      : "DEFAULT-SESSION";
    try {
      await clearSession(activeSession, selectedProjectId);
      setFeed([]);
    } catch (err) {
      setError(err.message || "Could not clear session.");
    }
  };

  const getBadgeStyle = (responseType) => {
    switch (responseType) {
      case "LIVE_API":
        return "border-coral-500/40 bg-coral-500/15 text-coral-300";
      case "KNOWLEDGE_ANSWER":
        return "border-blue-500/40 bg-blue-500/15 text-blue-300";
      case "DIRECT_ANSWER":
        return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
      case "ACTION_CONFIRMATION":
        return "border-purple-500/40 bg-purple-500/15 text-purple-300";
      case "API_REQUIRED":
        return "border-amber-500/40 bg-amber-500/15 text-amber-300";
      case "CLARIFICATION_REQUIRED":
        return "border-yellow-500/40 bg-yellow-500/15 text-yellow-300";
      case "ACCESS_DENIED":
      case "AUTH_REQUIRED":
        return "border-rose-500/40 bg-rose-500/15 text-rose-300";
      case "OUT_OF_SCOPE":
        return "border-charcoal-700 bg-charcoal-800 text-steel-400";
      default:
        return "border-charcoal-700 bg-charcoal-800 text-steel-300";
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal-750 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Live AI Chatbot Studio</h1>
          <p className="text-xs text-steel-400">
            Multi-turn intelligent conversations with context retention, grounded knowledge retrieval, and live API execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-xl border border-charcoal-750 bg-charcoal-900 px-3 py-1.5 text-xs text-white outline-none focus:border-coral-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.project_code})
              </option>
            ))}
          </select>

          <button
            onClick={handleClearSession}
            className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-700 bg-charcoal-850 px-3 py-1.5 text-xs text-steel-400 hover:text-rose-400"
            title="Reset multi-turn session context"
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset Session
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Query Box & Presets */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 lg:col-span-5">
          <SpotlightCard className="p-5 border-charcoal-750 bg-charcoal-900">
            <form onSubmit={handleAsk} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-white">Ask Question / Send Instruction</label>
                <textarea
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask in English, Tamil, or Tanglish..."
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 p-3 text-sm text-white outline-none focus:border-coral-500"
                />
              </div>

              {/* Sample Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-steel-400">Quick Test Scenarios &amp; Anaphora:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuestion(p.text)}
                      className="inline-flex items-center gap-1 rounded-full border border-charcoal-750 bg-charcoal-950 px-2.5 py-1 text-[11px] text-steel-300 hover:border-coral-500/50 hover:text-white"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-coral-400" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:from-coral-600 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Ask Universal Chatbot
                </button>
              </div>
            </form>
          </SpotlightCard>

          {/* Integration Mode Pill */}
          {selectedProject && (
            <div className="rounded-xl border border-charcoal-750 bg-charcoal-950 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Active Mode:</span>
                <span className="font-mono text-coral-400 font-bold">{selectedProject.integration_mode || "MODE_B_DIRECT_API"}</span>
              </div>
              <div className="text-[11px] text-steel-400">
                Session ID: <span className="font-mono text-steel-300">SESSION-{selectedProject.project_code}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Column: Chatbot Output Feed */}
        <SpotlightCard className="flex min-h-[520px] flex-col p-5 lg:col-span-7 border-charcoal-750 bg-charcoal-900">
          <div className="mb-4 flex items-center justify-between border-b border-charcoal-750 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("live")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "live" ? "bg-coral-500/20 border border-coral-500/40 text-coral-300" : "text-steel-400 hover:text-white"
                }`}
              >
                Conversational Output
              </button>
              <button
                onClick={() => setActiveTab("inspector")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === "inspector" ? "bg-coral-500/20 border border-coral-500/40 text-coral-300" : "text-steel-400 hover:text-white"
                }`}
              >
                JSON Contract Inspector
              </button>
            </div>

            {lastDebug && (
              <span className="font-mono text-[11px] text-steel-400">
                <CountUp to={lastDebug.latencyMs} decimals={1} suffix=" ms" />
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "live" && (
              <div className="flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
                {feed.length === 0 ? (
                  <div className="flex h-72 flex-col items-center justify-center text-center text-xs text-steel-400">
                    <Bot className="mb-3 h-10 w-10 text-coral-500/60" />
                    <p className="font-semibold text-white">No queries in this session yet.</p>
                    <p className="mt-1 max-w-sm text-steel-400">
                      Ask questions above to test multi-turn context, entity resolution, and intelligent decision modes.
                    </p>
                  </div>
                ) : (
                  feed.map((item) => (
                    <div key={item.id} className="space-y-3 rounded-2xl border border-charcoal-750 bg-charcoal-950/70 p-4">
                      {/* User Query */}
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-charcoal-800 text-steel-300">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-white">{item.question}</span>
                        </div>
                        <span className="font-mono text-[10px] text-steel-500">{item.timestamp}</span>
                      </div>

                      {/* Bot Response Bubble */}
                      <div className="rounded-xl border border-charcoal-750 bg-charcoal-900 p-3.5 text-xs text-steel-100 flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-coral-500/20 text-coral-400 mt-0.5">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-2 flex-1">
                          {/* Response Mode Badge & Source */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${getBadgeStyle(item.response?.response_type)}`}>
                              {item.response?.response_type || "DIRECT_ANSWER"}
                            </span>
                            <span className="rounded bg-charcoal-800 px-1.5 py-0.5 font-mono text-[10px] text-steel-400">
                              source: {item.response?.source || "grounded_engine"}
                            </span>
                            {item.response?.confidence != null && (
                              <span className="rounded bg-charcoal-800 px-1.5 py-0.5 font-mono text-[10px] text-coral-300">
                                {Math.round(item.response.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>

                          {/* Natural conversational answer */}
                          <div className="leading-relaxed whitespace-pre-wrap text-sm text-white">
                            {item.response?.answer}
                          </div>

                          {/* ACTION CONFIRMATION INTERACTION */}
                          {item.response?.response_type === "ACTION_CONFIRMATION" && item.response?.correlation_id && (
                            <div className="mt-3 rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-purple-200">
                                Explicit Confirmation Required
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleConfirmAction(item.response.correlation_id, true)}
                                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                                >
                                  ✓ Confirm Action
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleConfirmAction(item.response.correlation_id, false)}
                                  className="rounded-lg border border-charcoal-700 bg-charcoal-800 px-3 py-1.5 text-xs font-semibold text-steel-300 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* MODE C: API_REQUIRED EXTERNAL COMPLETION */}
                          {item.response?.response_type === "API_REQUIRED" && item.response?.correlation_id && (
                            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                              <div className="text-[11px] font-semibold text-amber-200">
                                Mode C: External Execution Dispatched
                              </div>
                              <p className="text-[10px] text-steel-400">
                                Correlation ID: <span className="font-mono text-amber-300">{item.response.correlation_id}</span>
                              </p>
                              <button
                                disabled={actionLoading}
                                onClick={() => handleCompleteExternal(item.response.correlation_id)}
                                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                              >
                                Simulate External Execution Completion
                              </button>
                            </div>
                          )}

                          {/* Clarification Suggestions */}
                          {item.response?.suggested_questions?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-charcoal-800">
                              <span className="text-[10px] text-steel-400">Suggested:</span>
                              {item.response.suggested_questions.map((sq, i) => (
                                <button
                                  key={i}
                                  onClick={() => setQuestion(sq)}
                                  className="rounded-lg border border-coral-500/30 bg-coral-500/10 px-2 py-0.5 text-[10px] text-coral-300 hover:bg-coral-500/20"
                                >
                                  {sq}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "inspector" && (
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                {!lastDebug ? (
                  <div className="flex h-72 items-center justify-center text-xs text-steel-400">
                    Execute a question to inspect the raw JSON contract.
                  </div>
                ) : (
                  <pre className="overflow-x-auto rounded-xl border border-charcoal-750 bg-charcoal-950 p-4 font-mono text-xs text-steel-200">
                    {JSON.stringify(lastDebug.payload, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </div>
    </div>
  );
}
