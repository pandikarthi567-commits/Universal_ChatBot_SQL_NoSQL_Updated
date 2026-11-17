import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Sparkles, X } from "lucide-react";
import { addProjectKnowledge, updateProjectKnowledge } from "../api/projectsApi";

export default function KnowledgeModal({ open, projectId, initialItem = null, onClose, onSaved }) {
  const [category, setCategory] = useState(initialItem?.category || "faq");
  const [title, setTitle] = useState(initialItem?.title || "");
  const [content, setContent] = useState(initialItem?.content || "");
  const [keywordsStr, setKeywordsStr] = useState((initialItem?.keywords || []).join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    setLoading(true);
    setError("");

    const keywords = keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      if (initialItem) {
        await updateProjectKnowledge(projectId, initialItem.id, {
          category,
          title: title.trim(),
          content: content.trim(),
          keywords,
        });
      } else {
        await addProjectKnowledge(projectId, {
          category,
          title: title.trim(),
          content: content.trim(),
          keywords,
        });
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save knowledge item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-charcoal-700 bg-charcoal-900 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-charcoal-750 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-coral-400" />
            <h3 className="font-display text-base font-bold text-white">
              {initialItem ? "Edit Knowledge Item" : "Add Grounded Knowledge Item"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-steel-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-rose-500/15 p-2.5 text-xs text-rose-300">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-medium text-steel-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 text-xs text-white focus:border-coral-500 focus:outline-none"
            >
              <option value="faq">FAQ (Frequently Asked Questions)</option>
              <option value="workflow">Workflow & Business Process</option>
              <option value="overview">Overview & Policy</option>
              <option value="module">Module Description</option>
              <option value="doc_chunk">Documentation Chunk</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-steel-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Return and Refund Policy"
              className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 text-xs text-white focus:border-coral-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-steel-300">Knowledge Content</label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter factual explanation for the AI chatbot to ground its answers..."
              className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 p-3 text-xs text-steel-200 focus:border-coral-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-steel-300">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywordsStr}
              onChange={(e) => setKeywordsStr(e.target.value)}
              placeholder="return, refund, exchange, days"
              className="w-full rounded-xl border border-charcoal-750 bg-charcoal-950 px-3 py-2 text-xs text-white focus:border-coral-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal-750">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-charcoal-700 px-4 py-2 text-xs font-medium text-steel-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25 hover:from-coral-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save Item
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
