import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, Loader2, X } from "lucide-react";

export default function IntentFormModal({ open, endpoints, onClose, onSubmit }) {
  const [intentName, setIntentName] = useState("");
  const [endpointName, setEndpointName] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [phrasesText, setPhrasesText] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setIntentName("");
    setEndpointName(endpoints?.[0]?.name || "");
    setKeywordsText("");
    setPhrasesText("");
    setDescription("");
  }, [open, endpoints]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({
        intent_name: intentName.trim().toUpperCase(),
        endpoint_name: endpointName,
        description: description.trim() || null,
        keywords: keywordsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        phrases: phrasesText
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
        enabled: true,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create intent.");
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
            className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-500/15 text-coral-400">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Map New Intent
                  </h2>
                  <p className="text-xs text-steel-400">
                    Connect natural-language phrases to one endpoint in this project.
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

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Intent Name *
                </label>
                <input
                  required
                  value={intentName}
                  onChange={(e) => setIntentName(e.target.value.toUpperCase())}
                  placeholder="VIEW_INVOICES"
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 font-mono text-sm text-white outline-none focus:border-coral-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Target Endpoint *
                </label>
                <select
                  required
                  value={endpointName}
                  onChange={(e) => setEndpointName(e.target.value)}
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                >
                  {endpoints.length === 0 && <option value="">No endpoints available</option>}
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.name}>
                      {ep.name} ({ep.http_method} {ep.path})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Keywords (comma-separated)
                </label>
                <input
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="invoice, invoices, billing, pending"
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Sample Phrases (comma or newline separated)
                </label>
                <textarea
                  rows={3}
                  value={phrasesText}
                  onChange={(e) => setPhrasesText(e.target.value)}
                  placeholder={"show pending invoices\nlist overdue invoices"}
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="View customer invoices"
                  className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                />
              </div>

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
                  disabled={loading || endpoints.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:brightness-110 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Intent
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

