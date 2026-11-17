import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Route, Sparkles, X } from "lucide-react";

const SAMPLE_MAPPINGS = `{
  "time_period": {
    "param": "period",
    "value_map": {
      "today": "today",
      "this month": "month",
      "this year": "year"
    }
  },
  "status": { "param": "status" },
  "limit": { "param": "limit" }
}`;

export default function EndpointFormModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("/api/");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [description, setDescription] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [requiredText, setRequiredText] = useState("");
  const [optionalText, setOptionalText] = useState("period, status, limit");
  const [allowedText, setAllowedText] = useState("period, status, limit");
  const [mappingsJson, setMappingsJson] = useState(SAMPLE_MAPPINGS);
  const [intentName, setIntentName] = useState("");
  const [phrasesText, setPhrasesText] = useState("");
  const [answerTemplate, setAnswerTemplate] = useState("");
  const [listPath, setListPath] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName("");
    setPath("/api/");
    setHttpMethod("GET");
    setDescription("");
    setKeywordsText("");
    setRequiredText("");
    setOptionalText("period, status, limit");
    setAllowedText("period, status, limit");
    setMappingsJson(SAMPLE_MAPPINGS);
    setIntentName("");
    setPhrasesText("");
    setAnswerTemplate("");
    setListPath("");
    setRequiresAuth(true);
  }, [open]);

  const splitCsv = (val) =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const fillSalesSample = () => {
    setName("Get Sales");
    setPath("/api/sales");
    setHttpMethod("GET");
    setDescription("Retrieve sales and revenue totals");
    setKeywordsText("sales, revenue, sold");
    setRequiredText("");
    setOptionalText("period, limit");
    setAllowedText("period, limit");
    setMappingsJson(
      JSON.stringify(
        {
          time_period: {
            param: "period",
            value_map: { today: "today", "this month": "month", "this year": "year" },
          },
          limit: { param: "limit" },
        },
        null,
        2
      )
    );
    setIntentName("VIEW_SALES");
    setPhrasesText("show today's sales, total sales amount");
    setAnswerTemplate("Total sales are {total_sales} across {count} orders.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    let parsedMappings = {};
    try {
      parsedMappings = mappingsJson.trim() ? JSON.parse(mappingsJson) : {};
    } catch {
      setError("parameter_mappings must be valid JSON.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        path: path.trim(),
        http_method: httpMethod,
        description: description.trim() || null,
        intent_name: intentName.trim() ? intentName.trim().toUpperCase() : null,
        phrases: splitCsv(phrasesText),
        keywords: splitCsv(keywordsText),
        required_params: splitCsv(requiredText),
        optional_params: splitCsv(optionalText),
        allowed_query_params: splitCsv(allowedText),
        parameter_mappings: parsedMappings,
        requires_auth: requiresAuth,
        is_enabled: true,
        response_answer_template: answerTemplate.trim() || null,
        response_list_path: listPath.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add endpoint.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            className="glass-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-500/15 text-coral-400">
                  <Route className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Add Endpoint Route
                  </h2>
                  <p className="text-xs text-steel-400">
                    Relative path only (starts with `/`, whitelisted query parameters).
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

            <div className="mb-4 flex items-center justify-between rounded-xl border border-charcoal-750 bg-charcoal-900/60 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-steel-400">
                <Sparkles className="h-3.5 w-3.5 text-coral-500" /> Need an example?
              </span>
              <button
                type="button"
                onClick={fillSalesSample}
                className="rounded-lg border border-coral-500/30 bg-coral-500/10 px-2.5 py-1 font-medium text-coral-300 hover:bg-coral-500/20"
              >
                Fill Sales Endpoint + Intent
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Endpoint Name *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Get Sales"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Method *
                  </label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-sm text-white outline-none focus:border-coral-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Relative Path *
                  </label>
                  <input
                    required
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/api/sales"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-sm text-coral-300 outline-none focus:border-coral-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Keywords (comma-separated)
                  </label>
                  <input
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    placeholder="sales, revenue, sold"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Auto-Create Intent Name (optional)
                  </label>
                  <input
                    value={intentName}
                    onChange={(e) => setIntentName(e.target.value.toUpperCase())}
                    placeholder="VIEW_SALES"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
              </div>

              {intentName.trim() && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Intent Sample Phrases (comma-separated)
                  </label>
                  <input
                    value={phrasesText}
                    onChange={(e) => setPhrasesText(e.target.value)}
                    placeholder="show today's sales, total sales amount"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Required Params
                  </label>
                  <input
                    value={requiredText}
                    onChange={(e) => setRequiredText(e.target.value)}
                    placeholder="e.g. id"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Optional Params
                  </label>
                  <input
                    value={optionalText}
                    onChange={(e) => setOptionalText(e.target.value)}
                    placeholder="period, status, limit"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Allowed Query Params *
                  </label>
                  <input
                    value={allowedText}
                    onChange={(e) => setAllowedText(e.target.value)}
                    placeholder="period, status, limit"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-coral-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Parameter Mappings (JSON)
                </label>
                <textarea
                  rows={5}
                  value={mappingsJson}
                  onChange={(e) => setMappingsJson(e.target.value)}
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 font-mono text-xs text-coral-200 outline-none focus:border-coral-500"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Answer Template (optional)
                  </label>
                  <input
                    value={answerTemplate}
                    onChange={(e) => setAnswerTemplate(e.target.value)}
                    placeholder="Total sales are {total_sales}."
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-xs text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Response List Path (optional)
                  </label>
                  <input
                    value={listPath}
                    onChange={(e) => setListPath(e.target.value)}
                    placeholder="data.items"
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-coral-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-steel-300">
                <input
                  type="checkbox"
                  checked={requiresAuth}
                  onChange={(e) => setRequiresAuth(e.target.checked)}
                  className="h-4 w-4 rounded border-charcoal-700 bg-charcoal-900 accent-coral-500"
                />
                Forward project outbound authentication credentials
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-charcoal-700 px-4 py-2 text-xs font-medium text-steel-300 hover:bg-charcoal-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:brightness-110 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Endpoint
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

