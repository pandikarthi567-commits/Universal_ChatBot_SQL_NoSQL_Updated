import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Key, Loader2, X } from "lucide-react";

export default function CredentialModal({
  open,
  project,
  onClose,
  onCreate,
  onSwitchToClient,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCred, setCreatedCred] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    setError("");
    setCreatedCred(null);
    setUsername(`${project.project_code.toLowerCase()}_client`);
    setPassword("ClientPass123!");
    setDescription(`Client token for ${project.name}`);
  }, [open, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onCreate(project.id, {
        username: username.trim(),
        password,
        description: description.trim() || null,
        is_active: true,
      });
      setCreatedCred({ username: username.trim(), password });
    } catch (err) {
      setError(err.message || "Failed to create client credential.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-500/15 text-coral-400">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Create Client Login
                  </h2>
                  <p className="text-xs text-steel-400">
                    Scoped strictly to <span className="font-mono text-coral-300">{project.project_code}</span>
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

            {createdCred ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-coral-500/30 bg-coral-500/10 p-4 text-xs text-coral-200">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-coral-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Client credential created!
                  </div>
                  <p className="text-steel-300">
                    Username: <span className="font-mono text-white">{createdCred.username}</span>
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-charcoal-700 px-4 py-2 text-xs text-steel-300 hover:bg-charcoal-800"
                  >
                    Stay as Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchToClient(createdCred.username, createdCred.password)}
                    className="rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Switch &amp; Open API Checker
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Client Username *
                  </label>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-steel-300">
                    Password (min 8 chars) *
                  </label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    className="w-full rounded-xl border border-charcoal-750 bg-charcoal-900/90 px-3 py-2 text-sm text-white outline-none focus:border-coral-500"
                  />
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-charcoal-700 px-4 py-2 text-xs text-steel-300 hover:bg-charcoal-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-coral-500 to-coral-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-500/25"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Create Credential
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

