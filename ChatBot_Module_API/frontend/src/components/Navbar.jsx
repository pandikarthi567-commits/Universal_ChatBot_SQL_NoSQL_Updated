import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bot, FolderKanban, LogOut, ShieldCheck, Terminal } from "lucide-react";
import { checkHealth } from "../api/chatApi";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ activeView, onChangeView }) {
  const { auth, logout } = useAuth();
  const [healthOk, setHealthOk] = useState(null);

  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      try {
        await checkHealth();
        if (mounted) setHealthOk(true);
      } catch {
        if (mounted) setHealthOk(false);
      }
    };
    probe();
    const timer = setInterval(probe, 20000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const tabs =
    auth?.role === "admin"
      ? [
          { id: "projects", label: "Applications & Setup", icon: FolderKanban },
          { id: "checker", label: "API Checking Studio", icon: Terminal },
        ]
      : [{ id: "checker", label: "API Checking Studio", icon: Terminal }];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="sticky top-0 z-30 border-b border-[#929DA7]/20 bg-[#17191C]/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF4832] to-[#FF6753] text-white shadow-lg shadow-[#FF4832]/30">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-bold tracking-tight text-white">
              {auth?.company_name || "Universal Chatbot API"}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#929DA7]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    healthOk === true
                      ? "bg-[#FF4832] shadow-[0_0_8px_rgba(255,72,50,0.9)]"
                      : healthOk === false
                      ? "bg-rose-500"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                {healthOk === true ? "API Online" : healthOk === false ? "API Offline" : "Checking..."}
              </span>
              <span className="text-[#929DA7]/50">•</span>
              <span className="font-mono text-[11px] text-[#929DA7]">
                {auth?.company_location ? `${auth.company_location} • ` : ""}Application Engine
              </span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-xl border border-[#929DA7]/20 bg-[#1F2328]/80 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeView(tab.id)}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-[#929DA7] hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-[#FF4832]/20 border border-[#FF4832]/50 shadow-[0_0_12px_rgba(255,72,50,0.25)]"
                  />
                )}
                <Icon className={`relative z-10 h-4 w-4 ${isActive ? "text-[#FF4832]" : "text-[#929DA7]"}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Swagger UI Documentation"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:border-emerald-500"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Swagger UI</span>
          </a>

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#929DA7]/20 bg-[#1F2328]/90 px-3 py-1.5 text-xs text-[#929DA7]">
            {auth?.role === "admin" ? (
              <>
                <span className="truncate max-w-[180px] font-mono text-slate-200">
                  {auth.username}
                </span>
                <span className="rounded-md border border-[#FF4832]/40 bg-[#FF4832]/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#FF4832]">
                  ADMIN
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-slate-200">{auth?.username}</span>
                <span className="rounded-md border border-[#929DA7]/40 bg-[#929DA7]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#929DA7]">
                  PRJ #{auth?.project_id}
                </span>
              </>
            )}
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-1.5 rounded-xl border border-[#929DA7]/25 bg-[#1F2328] px-3 py-1.5 text-xs font-medium text-[#929DA7] transition hover:border-[#FF4832]/50 hover:bg-[#FF4832]/10 hover:text-[#FF4832]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
