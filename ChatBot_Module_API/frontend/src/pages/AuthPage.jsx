import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import { checkHealth } from "../api/chatApi";
import BlurText from "../components/reactbits/BlurText";
import DecryptedText from "../components/reactbits/DecryptedText";
import MagnetButton from "../components/reactbits/MagnetButton";
import ShinyText from "../components/reactbits/ShinyText";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import StarBorder from "../components/reactbits/StarBorder";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Single-URL Isolation",
    desc: "Each project binds strictly to one base URL with Fernet-encrypted auth.",
    color: "text-[#FF4832]",
    bg: "bg-[#FF4832]/10 border-[#FF4832]/25",
    spotlight: "rgba(255, 72, 50, 0.16)",
  },
  {
    icon: Zap,
    title: "At Most 1 Call / Ask",
    desc: "NLTK scores intent & extracts entities before a single whitelisted HTTPX call.",
    color: "text-white",
    bg: "bg-[#929DA7]/15 border-[#929DA7]/25",
    spotlight: "rgba(146, 157, 167, 0.16)",
  },
  {
    icon: Cpu,
    title: "Live API Studio",
    desc: "Analyze tokens, lemmas, POS tags, planned params, and real upstream data.",
    color: "text-[#FF6753]",
    bg: "bg-[#FF6753]/10 border-[#FF6753]/25",
    spotlight: "rgba(255, 103, 83, 0.18)",
  },
];

const PIPELINE_STEPS = [
  "01. JWT Auth",
  "02. NLTK Lemmatize",
  "03. Whitelist Params",
  "04. 1x HTTPX Call",
];

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [companyDetails, setCompanyDetails] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiOnline, setApiOnline] = useState(null);
  const [activePipe, setActivePipe] = useState(0);

  useEffect(() => {
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActivePipe((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (authMode === "login") {
        await login(username.trim(), password);
      } else {
        if (!companyName.trim()) {
          setError("Company Name is required.");
          setLoading(false);
          return;
        }
        if (!companyLocation.trim()) {
          setError("Company Location is required.");
          setLoading(false);
          return;
        }
        if (!phoneNumber.trim()) {
          setError("Company Phone Number is required.");
          setLoading(false);
          return;
        }
        if (!regEmail.trim()) {
          setError("Company Email is required.");
          setLoading(false);
          return;
        }
        if (regPassword.length < 8) {
          setError("Password must be at least 8 characters.");
          setLoading(false);
          return;
        }
        await signup({
          company_name: companyName.trim(),
          company_location: companyLocation.trim(),
          phone_number: phoneNumber.trim(),
          company_details: companyDetails.trim() || null,
          email: regEmail.trim(),
          password: regPassword,
        });
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        {/* Left animated hero */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8 lg:col-span-7"
        >
          <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#929DA7]/30 bg-[#1E2125]/85 px-4 py-1.5 text-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#FF4832]" />
            <ShinyText text="Universal NLP Chatbot API Platform v2" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#929DA7]/20 bg-[#17191C] px-2.5 py-0.5 text-[11px] text-[#929DA7]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${apiOnline === true
                  ? "bg-[#FF4832] shadow-[0_0_8px_rgba(255,72,50,0.9)]"
                  : apiOnline === false
                    ? "bg-rose-500"
                    : "bg-amber-400 animate-pulse"
                  }`}
              />
              {apiOnline === true ? "Backend Online" : apiOnline === false ? "Backend Offline" : "Checking"}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              <BlurText text="Architect Applications &" delay={0.06} />
              <span className="mt-1 block bg-gradient-to-r from-[#FF4832] via-[#FF7563] to-[#929DA7] bg-clip-text text-transparent">
                Inspect Live APIs
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#929DA7] sm:text-lg">
              Register isolated applications, map endpoints and NLTK intents visually, verify
              connectivity in one click, and inspect live{" "}
              <DecryptedText
                text="/api/chat/analyze"
                className="rounded bg-[#1E2125] px-1.5 py-0.5 font-mono text-sm text-[#FF4832]"
              />{" "}
              and{" "}
              <DecryptedText
                text="/api/chat/ask"
                className="rounded bg-[#1E2125] px-1.5 py-0.5 font-mono text-sm text-white"
              />{" "}
              responses.
            </p>
          </div>

          {/* Animated pipeline ticker */}
          <div className="glass-panel rounded-2xl p-3.5 border-[#929DA7]/20 bg-[#17191C]/90">
            <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-[#929DA7]">
              <span>EXECUTION PIPELINE</span>
              <span className="text-[#FF4832]">ZERO PYTHON DB • SINGLE-CALL</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PIPELINE_STEPS.map((step, i) => {
                const active = i === activePipe;
                return (
                  <motion.div
                    key={step}
                    animate={{
                      scale: active ? 1.03 : 1,
                      borderColor: active
                        ? "rgba(255, 72, 50, 0.65)"
                        : "rgba(146, 157, 167, 0.2)",
                    }}
                    className={`rounded-xl border px-3 py-2 text-center font-mono text-[11px] font-medium transition-colors ${active
                      ? "bg-[#FF4832]/15 text-white shadow-lg shadow-[#FF4832]/15 border-[#FF4832]/60"
                      : "bg-[#1E2125]/70 text-[#929DA7]"
                      }`}
                  >
                    {step}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Spotlight feature cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <SpotlightCard
                  key={feat.title}
                  spotlightColor={feat.spotlight}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + idx * 0.1, duration: 0.45 }}
                  whileHover={{ y: -4 }}
                  className="p-4 border-[#929DA7]/20 bg-[#17191C]/90"
                >
                  <div className={`mb-3 inline-flex rounded-xl border p-2.5 ${feat.bg}`}>
                    <Icon className={`h-5 w-5 ${feat.color}`} />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#929DA7]">
                    {feat.desc}
                  </p>
                </SpotlightCard>
              );
            })}
          </div>
        </motion.div>

        {/* Right StarBorder Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="lg:col-span-5"
        >
          <StarBorder innerClassName="p-7 shadow-2xl shadow-black/60 backdrop-blur-xl border border-[#929DA7]/25 bg-[#17191C]">
            {/* Mode Switcher Tabs */}
            <div className="mb-5 flex rounded-xl border border-[#929DA7]/20 bg-[#1E2125] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  authMode === "login"
                    ? "bg-[#FF4832] text-white shadow-[0_0_12px_rgba(255,72,50,0.35)]"
                    : "text-[#929DA7] hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  authMode === "register"
                    ? "bg-[#FF4832] text-white shadow-[0_0_12px_rgba(255,72,50,0.35)]"
                    : "text-[#929DA7] hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF4832] text-white shadow-lg shadow-[#FF4832]/30">
                  {authMode === "login" ? <Bot className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {authMode === "login" ? "Sign In" : "Register Company"}
                  </h2>
                  <p className="text-xs text-[#929DA7]">
                    {authMode === "login"
                      ? "Enter your credentials to access the studio"
                      : "Create your company account & API access"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-[#FF4832]/30 bg-[#FF4832]/10 px-2.5 py-1 text-[11px] font-medium text-[#FF4832]">
                <Lock className="h-3 w-3" />
                <span>MongoDB</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authMode === "login" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">
                      Email or Username *
                    </label>
                    <input
                      required
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="pandikarthi567@gmail.com or username"
                      className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={showPass ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2.5 pr-10 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#929DA7] hover:text-white"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">
                      Company Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Protect Insurance Tech"
                      className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-200">
                        Company Location *
                      </label>
                      <input
                        required
                        type="text"
                        value={companyLocation}
                        onChange={(e) => setCompanyLocation(e.target.value)}
                        placeholder="e.g. Chennai, India"
                        className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-200">
                        Phone Number *
                      </label>
                      <input
                        required
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">
                      Company Details / Industry
                    </label>
                    <input
                      type="text"
                      value={companyDetails}
                      onChange={(e) => setCompanyDetails(e.target.value)}
                      placeholder="e.g. Insurance Management Software in Windows"
                      className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">
                      Company Email *
                    </label>
                    <input
                      required
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. admin@protect.com"
                      className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">
                      Password (min 8 chars) *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={showPass ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-[#929DA7]/30 bg-[#1E2125] px-3.5 py-2 pr-10 text-sm text-white placeholder-[#929DA7]/40 outline-none transition focus:border-[#FF4832] focus:ring-1 focus:ring-[#FF4832]/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#929DA7] hover:text-white"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <MagnetButton
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4832] hover:bg-[#E63A25] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#FF4832]/30 transition hover:brightness-110 disabled:opacity-60 mt-2"
              >
                <span>
                  {loading
                    ? authMode === "login"
                      ? "Authenticating..."
                      : "Registering..."
                    : authMode === "login"
                    ? "Enter Studio"
                    : "Create Company Account"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </MagnetButton>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode((prev) => (prev === "login" ? "register" : "login"));
                  setError("");
                }}
                className="text-xs text-[#929DA7] hover:text-white transition underline"
              >
                {authMode === "login"
                  ? "Don't have an account? Register your company"
                  : "Already registered? Sign In to studio"}
              </button>
            </div>
          </StarBorder>
        </motion.div>
      </div>
    </div>
  );
}
