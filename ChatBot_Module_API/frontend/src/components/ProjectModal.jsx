import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Code,
  Database,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Route,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";

export default function ProjectModal({ open, initialProject, onClose, onSubmit }) {
  const isEdit = Boolean(initialProject);
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [devType, setDevType] = useState("Software Development");
  const [platform, setPlatform] = useState("Windows");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [endpointPath, setEndpointPath] = useState("/api/protect");
  const [enableBearer, setEnableBearer] = useState(true);
  const [tokenVal, setTokenVal] = useState("");
  const [enableApiKey, setEnableApiKey] = useState(true);
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [headerName, setHeaderName] = useState("X-API-Key");
  const [enableDb, setEnableDb] = useState(false);
  const [dbType, setDbType] = useState("mongodb");
  const [dbUri, setDbUri] = useState("");
  const [dbName, setDbName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateRandomToken = (prefix = "prj_tok_") => {
    const res = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2,"0")).join("");
    return `${prefix}${res}`;
  };

  useEffect(() => {
    if (!open) return;
    setError("");
    if (initialProject) {
      setName(initialProject.name || "");
      setProjectCode(initialProject.project_code || "");
      setDescription(initialProject.description || "");
      setBaseUrl(initialProject.base_url || "http://localhost:8000");
      setEndpointPath(initialProject.health_path || "/api/protect");
      
      const hasBearer =
        initialProject.auth_type === "bearer" ||
        initialProject.auth_type === "bearer_and_api_key" ||
        Boolean(initialProject.auth_config?.token);
      const hasApiKey =
        initialProject.auth_type === "api_key" ||
        initialProject.auth_type === "bearer_and_api_key" ||
        Boolean(initialProject.auth_config?.api_key);

      setEnableBearer(hasBearer);
      setTokenVal(initialProject.auth_config?.token || "");
      setEnableApiKey(hasApiKey);
      setApiKeyVal(initialProject.auth_config?.api_key || "");
      setHeaderName(initialProject.auth_config?.header_name || "X-API-Key");
      setEnableDb(Boolean(initialProject.db_access_enabled));
      setDbType(initialProject.db_config?.db_type || "mongodb");
      setDbUri("");
      setDbName(initialProject.db_config?.db_name || "");
      setIsActive(Boolean(initialProject.is_active));

      if (initialProject.description?.toLowerCase().includes("web")) {
        setDevType("Web Development");
        setPlatform("Web");
      } else {
        setDevType("Software Development");
        setPlatform("Windows");
      }
    } else {
      setName("");
      setProjectCode("");
      setDevType("Software Development");
      setPlatform("Windows");
      setDescription("");
      setBaseUrl("http://localhost:8000");
      setEndpointPath("/api/");
      setEnableBearer(true);
      setTokenVal(generateRandomToken("bearer_"));
      setEnableApiKey(true);
      setApiKeyVal(generateRandomToken("key_"));
      setHeaderName("X-API-Key");
      setEnableDb(false);
      setDbType("mongodb");
      setDbUri("");
      setDbName("");
      setIsActive(true);
    }
  }, [open, initialProject]);

  const handleNameChange = (val) => {
    setName(val);
    if (!isEdit) {
      const slug = val
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const autoCode = slug.toUpperCase();
      setProjectCode(autoCode);
      setEndpointPath(slug ? `/api/${slug}` : "/api/");

      // Auto-update description structure
      if (val.trim()) {
        setDescription(`The ${val.trim()} is ${devType} in ${platform}`);
      } else {
        setDescription("");
      }
    }
  };

  const handleFormatDescription = (customName = name, customDev = devType, customPlat = platform) => {
    const appName = customName.trim() || "Application";
    setDescription(`The ${appName} is ${customDev} in ${customPlat}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let calculatedAuthType = "none";
      if (enableBearer && enableApiKey) {
        calculatedAuthType = "bearer_and_api_key";
      } else if (enableBearer) {
        calculatedAuthType = "bearer";
      } else if (enableApiKey) {
        calculatedAuthType = "api_key";
      }

      let authConfig = null;
      if (enableBearer && tokenVal.trim()) {
        authConfig = { ...(authConfig || {}), token: tokenVal.trim() };
      }
      if (enableApiKey && apiKeyVal.trim()) {
        authConfig = {
          ...(authConfig || {}),
          api_key: apiKeyVal.trim(),
          header_name: headerName.trim() || "X-API-Key",
        };
      }

      const dbConfigPayload = enableDb && dbUri.trim() ? {
        db_type: dbType,
        db_uri: dbUri.trim(),
        db_name: dbName.trim() || undefined,
      } : null;

      const payload = isEdit
        ? {
            name: name.trim(),
            description: description.trim() || null,
            base_url: baseUrl.trim(),
            health_path: endpointPath.trim() || null,
            auth_type: calculatedAuthType,
            ...(authConfig ? { auth_config: authConfig } : {}),
            db_access_enabled: enableDb,
            db_config: dbConfigPayload,
            is_active: isActive,
          }
        : {
            name: name.trim(),
            project_code: projectCode.trim().toUpperCase(),
            description: description.trim() || null,
            base_url: baseUrl.trim(),
            health_path: endpointPath.trim() || null,
            auth_type: calculatedAuthType,
            auth_config: authConfig,
            db_access_enabled: enableDb,
            db_config: dbConfigPayload,
            is_active: isActive,
          };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save project.");
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191C]/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="glass-panel max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6 shadow-2xl border border-[#929DA7]/25 bg-[#17191C]"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between border-b border-[#929DA7]/15 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF4832]/15 text-[#FF4832] shadow-[0_0_12px_rgba(255,72,50,0.2)]">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    {isEdit ? "Edit Application" : "Add New Application"}
                  </h3>
                  <p className="text-xs text-[#929DA7]">
                    Default Base URL <span className="font-mono text-[#FF4832]">http://localhost:8000</span> (Endpoints auto-generated)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#929DA7] hover:bg-[#25292F] hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Application Name & Application Code (Auto Generated) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Application Name *
                    </label>
                    <span className="text-[10px] text-[#FF4832] font-mono">
                      auto-generates code &amp; endpoint
                    </span>
                  </div>
                  <input
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Protect"
                    className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 text-sm text-white placeholder-[#929DA7]/50 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-200">
                    Application Code *
                  </label>
                  <input
                    required
                    disabled={isEdit}
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PROTECT"
                    className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 font-mono text-sm text-[#FF4832] font-semibold outline-none focus:border-[#FF4832] disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Development Type & Target Platform */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-[#929DA7]/20 bg-[#1E2125]/70 p-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#929DA7]">
                    Development Type
                  </label>
                  <select
                    value={devType}
                    onChange={(e) => {
                      setDevType(e.target.value);
                      handleFormatDescription(name, e.target.value, platform);
                    }}
                    className="w-full rounded-lg border border-[#929DA7]/30 bg-[#17191C] px-3 py-2 text-xs text-white outline-none focus:border-[#FF4832]"
                  >
                    <option value="Software Development">Software Development</option>
                    <option value="Web Development">Web Development</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#929DA7]">
                    Target Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => {
                      setPlatform(e.target.value);
                      handleFormatDescription(name, devType, e.target.value);
                    }}
                    className="w-full rounded-lg border border-[#929DA7]/30 bg-[#17191C] px-3 py-2 text-xs text-white outline-none focus:border-[#FF4832]"
                  >
                    <option value="Windows">Windows</option>
                    <option value="Web">Web</option>
                    <option value="Cross-Platform">Cross-Platform</option>
                  </select>
                </div>
              </div>

              {/* Single Base URL (Default http://localhost:8000) & Auto-Generated Endpoint Path */}
              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Single Base URL *
                    </label>
                    <span className="text-[10px] text-[#929DA7] font-mono">
                      Default: http://localhost:8000
                    </span>
                  </div>
                  <input
                    required
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 font-mono text-sm text-[#929DA7] outline-none focus:border-[#FF4832]"
                  />
                </div>
                <div className="sm:col-span-5">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      Auto Endpoint Path *
                    </label>
                    <span className="text-[10px] text-[#FF4832] font-mono">
                      Auto-filled
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      required
                      value={endpointPath}
                      onChange={(e) => setEndpointPath(e.target.value)}
                      placeholder="/api/protect"
                      className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 font-mono text-sm text-[#FF4832] font-semibold outline-none focus:border-[#FF4832]"
                    />
                  </div>
                </div>
              </div>

              {/* Unique API Endpoint Preview Banner */}
              <div className="rounded-xl border border-[#FF4832]/30 bg-[#FF4832]/5 p-2.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] text-[#929DA7] mb-1">
                  <span>Unique Project API Endpoint:</span>
                  <span className="text-emerald-400 font-semibold">⚡ Automatically Created in Swagger UI</span>
                </div>
                <div className="text-white font-semibold flex items-center gap-1.5 overflow-x-auto">
                  <Route className="h-3.5 w-3.5 text-[#FF4832] flex-shrink-0" />
                  <span>{baseUrl.replace(/\/+$/, "")}{endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}</span>
                </div>
              </div>

              {/* Description with Auto-Format */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-200">
                    Description
                  </label>
                  <button
                    type="button"
                    onClick={() => handleFormatDescription()}
                    className="inline-flex items-center gap-1 text-[11px] text-[#FF4832] hover:underline"
                  >
                    <Wand2 className="h-3 w-3" /> Auto-Format Format
                  </button>
                </div>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. The Protect is Insurance Management Software in Windows"
                  className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 text-sm text-white placeholder-[#929DA7]/40 outline-none focus:border-[#FF4832]"
                />
              </div>

              {/* Dedicated Separate Auth Credentials: Bearer Token & API Key */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-[#FF4832]" />
                    Outbound Project Credentials (Separate Bearer &amp; API Key)
                  </span>
                  <span className="text-[10px] text-[#929DA7]">
                    Tokens attached when querying or submitting to this project
                  </span>
                </div>

                {/* 1. Bearer Token Card (Separated) */}
                <div className={`rounded-xl border p-3.5 space-y-2.5 transition ${
                  enableBearer ? "border-emerald-500/40 bg-emerald-950/10" : "border-[#929DA7]/20 bg-[#1E2125]/60"
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableBearer}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnableBearer(checked);
                          if (checked && !tokenVal) {
                            setTokenVal(generateRandomToken(`bearer_${projectCode.toLowerCase() || "app"}_`));
                          }
                        }}
                        className="h-4 w-4 rounded border-[#929DA7]/40 bg-[#17191C] text-[#FF4832] focus:ring-[#FF4832]"
                      />
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>1. Bearer Token (Authorization: Bearer ...)</span>
                    </label>

                    {enableBearer && (
                      <button
                        type="button"
                        onClick={() => setTokenVal(generateRandomToken(`bearer_${projectCode.toLowerCase() || "app"}_`))}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Generate Bearer Token
                      </button>
                    )}
                  </div>

                  {enableBearer && (
                    <div>
                      <input
                        type="text"
                        value={tokenVal}
                        onChange={(e) => setTokenVal(e.target.value)}
                        placeholder={isEdit ? "Leave blank to keep existing token" : "Enter or generated Bearer Token"}
                        className="w-full rounded-xl border border-emerald-500/30 bg-[#17191C] px-3.5 py-2 font-mono text-xs text-emerald-300 outline-none focus:border-emerald-500 select-all"
                      />
                      <p className="mt-1 text-[10px] text-[#929DA7]">
                        Attached as header: <span className="text-slate-300 font-mono">Authorization: Bearer {tokenVal || "<token>"}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. API Key Card (Separated) */}
                <div className={`rounded-xl border p-3.5 space-y-2.5 transition ${
                  enableApiKey ? "border-amber-500/40 bg-amber-950/10" : "border-[#929DA7]/20 bg-[#1E2125]/60"
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableApiKey}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnableApiKey(checked);
                          if (checked && !apiKeyVal) {
                            setApiKeyVal(generateRandomToken(`key_${projectCode.toLowerCase() || "app"}_`));
                          }
                        }}
                        className="h-4 w-4 rounded border-[#929DA7]/40 bg-[#17191C] text-[#FF4832] focus:ring-[#FF4832]"
                      />
                      <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                      <span>2. API Key (Data Fetching / Header Key)</span>
                    </label>

                    {enableApiKey && (
                      <button
                        type="button"
                        onClick={() => setApiKeyVal(generateRandomToken(`key_${projectCode.toLowerCase() || "app"}_`))}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Generate API Key
                      </button>
                    )}
                  </div>

                  {enableApiKey && (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-[#929DA7] mb-1">Header Name</label>
                        <input
                          value={headerName}
                          onChange={(e) => setHeaderName(e.target.value)}
                          placeholder="X-API-Key"
                          className="w-full rounded-xl border border-amber-500/30 bg-[#17191C] px-3 py-2 font-mono text-xs text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#929DA7] mb-1">API Key Value</label>
                        <input
                          type="text"
                          value={apiKeyVal}
                          onChange={(e) => setApiKeyVal(e.target.value)}
                          placeholder={isEdit ? "Leave blank to keep existing key" : "API Key token value"}
                          className="w-full rounded-xl border border-amber-500/30 bg-[#17191C] px-3 py-2 font-mono text-xs text-amber-300 outline-none focus:border-amber-500 select-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Database Access Configuration (Optional & Encrypted) */}
              <div className="space-y-2 border-t border-[#929DA7]/15 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Database Access Configuration <span className="text-[11px] font-normal text-[#929DA7]">(Optional)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <Lock className="h-2.5 w-2.5" /> AES-256 Encrypted
                  </span>
                </div>

                <div className={`rounded-xl border p-3.5 space-y-3 transition ${
                  enableDb ? "border-cyan-500/40 bg-cyan-950/15" : "border-[#929DA7]/20 bg-[#1E2125]/60"
                }`}>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableDb}
                      onChange={(e) => setEnableDb(e.target.checked)}
                      className="h-4 w-4 rounded border-[#929DA7]/40 bg-[#17191C] text-cyan-400 focus:ring-cyan-400"
                    />
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Enable Direct Database Access for this Application</span>
                  </label>

                  {enableDb ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] text-[#929DA7] mb-1">Database Type</label>
                          <select
                            value={dbType}
                            onChange={(e) => setDbType(e.target.value)}
                            className="w-full rounded-xl border border-cyan-500/30 bg-[#17191C] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                          >
                            <option value="mongodb">MongoDB (Atlas / Local)</option>
                            <option value="postgresql">PostgreSQL</option>
                            <option value="mysql">MySQL</option>
                            <option value="mssql">Microsoft SQL Server</option>
                            <option value="sqlite">SQLite (server file)</option>
                            <option value="supabase">Supabase (PostgreSQL)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#929DA7] mb-1">Database / Schema Name</label>
                          <input
                            type="text"
                            value={dbName}
                            onChange={(e) => setDbName(e.target.value)}
                            placeholder="e.g. universal_chatbot"
                            className="w-full rounded-xl border border-cyan-500/30 bg-[#17191C] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                          >
                          </input>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#929DA7] mb-1">
                          Database Connection URI (Encrypted before storage)
                        </label>
                        <input
                          type="password"
                          value={dbUri}
                          onChange={(e) => setDbUri(e.target.value)}
                          placeholder={isEdit ? "Leave blank to retain existing connection" : "Connection URI or SQLite file path"}
                          className="w-full rounded-xl border border-cyan-500/30 bg-[#17191C] px-3 py-2 font-mono text-xs text-cyan-300 outline-none focus:border-cyan-400"
                        />
                        <p className="mt-1 text-[10px] text-[#929DA7]">
                          🔒 Details are encrypted via AES-256 in database. Passwords are never returned in plaintext.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#929DA7]">
                      Without database access, the chatbot runs in <strong className="text-slate-300">Pure NLP Mode</strong> (NLTK extracts, cleans, and analyzes question language without querying a database).
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#929DA7]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#929DA7]/40 bg-[#1E2125] text-[#FF4832] focus:ring-[#FF4832]"
                />
                <span className="text-slate-300">Application is active</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#929DA7]/15">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[#929DA7]/30 px-4 py-2 text-xs font-semibold text-[#929DA7] hover:bg-[#25292F] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF4832] hover:bg-[#E63A25] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#FF4832]/25 transition disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isEdit ? "Save Changes" : "Register Application"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
