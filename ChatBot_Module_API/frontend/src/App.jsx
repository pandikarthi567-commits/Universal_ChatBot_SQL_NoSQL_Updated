import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedBackdrop from "./components/AnimatedBackdrop";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ApiCheckingPage from "./pages/ApiCheckingPage";
import AuthPage from "./pages/AuthPage";

function StudioShell() {
  const { isAuthenticated, auth } = useAuth();
  const [activeView, setActiveView] = useState(
    auth?.role === "admin" ? "projects" : "checker"
  );
  const [checkerProjectId, setCheckerProjectId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setActiveView(auth?.role === "admin" ? "projects" : "checker");
  }, [isAuthenticated, auth?.role]);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackdrop />
      {!isAuthenticated ? (
        <AuthPage />
      ) : (
        <>
          <Navbar activeView={activeView} onChangeView={setActiveView} />
          <AnimatePresence mode="wait">
            {activeView === "projects" && auth?.role === "admin" ? (
              <motion.main
                key="projects"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <AdminDashboardPage
                  onOpenChecker={(projectId) => {
                    setCheckerProjectId(projectId);
                    setActiveView("checker");
                  }}
                />
              </motion.main>
            ) : (
              <motion.main
                key="checker"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <ApiCheckingPage initialProjectId={checkerProjectId} />
              </motion.main>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StudioShell />
    </AuthProvider>
  );
}

