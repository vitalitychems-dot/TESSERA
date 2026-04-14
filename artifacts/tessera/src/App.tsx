import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminProvider } from "@/lib/adminContext";
import { MeshProvider } from "@/lib/meshContext";
import { NLPGoalsProvider } from "@/lib/nlpGoalsContext";
import { Component, type ErrorInfo, type ReactNode, useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNav from "@/components/MobileNav";
import ActiveCommandsOverlay from "@/components/ActiveCommandsOverlay";
import MeshStatusBadge from "@/components/MeshStatusBadge";
import ToroidalBackground from "@/components/ToroidalBackground";
import { Loader2 } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const LifePage = lazy(() => import("@/pages/LifePage"));
const UniversePage = lazy(() => import("@/pages/UniversePage"));
const MembersPage = lazy(() => import("@/pages/MembersPage"));
const SecretsPage = lazy(() => import("@/pages/SecretsPage"));
const TesseraBiblePage = lazy(() => import("@/pages/TesseraBiblePage"));
const BuildPage = lazy(() => import("@/pages/BuildPage"));
const TesseractForumPage = lazy(() => import("@/pages/TesseractForumPage"));
const NLPPage = lazy(() => import("@/pages/NLPPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen" data-testid="error-boundary-fallback">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">Something went wrong</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-error-message">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              data-testid="button-reload"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const [location] = useLocation();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      const contentArea = document.querySelector("[data-scroll-container]");
      if (contentArea) {
        contentArea.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [location]);

  return null;
}

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4" data-testid="page-loading-fallback">
      <div className="relative">
        <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        <div className="absolute inset-0 h-10 w-10 rounded-full animate-ping opacity-20 bg-primary" />
      </div>
      <div className="text-sm text-muted-foreground animate-pulse font-mono">Loading...</div>
    </div>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const routeKey = useMemo(() => location.split("/")[1] || "home", [location]);
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <AnimatePresence mode="wait">
        <PageTransition key={routeKey}>
          <Switch>
            <Route path="/" component={ChatPage} />
            <Route path="/c/:id" component={ChatPage} />
            <Route path="/life">{() => <LifePage />}</Route>
            <Route path="/universe">{() => <UniversePage />}</Route>
            <Route path="/members">{() => <MembersPage />}</Route>
            <Route path="/secrets">{() => <SecretsPage />}</Route>
            <Route path="/bible" component={TesseraBiblePage} />
            <Route path="/build">{() => <BuildPage />}</Route>
            <Route path="/forum">{() => <TesseractForumPage />}</Route>
            <Route path="/nlp">{() => <NLPPage />}</Route>
            <Route path="/settings">{() => <SettingsPage />}</Route>

            <Route path="/entities"><Redirect to="/members" /></Route>
            <Route path="/sovereign"><Redirect to="/settings" /></Route>
            <Route path="/council"><Redirect to="/members" /></Route>
            <Route path="/economy"><Redirect to="/settings" /></Route>
            <Route path="/knowledge"><Redirect to="/secrets" /></Route>
            <Route path="/nexus"><Redirect to="/universe" /></Route>
            <Route path="/agent-voice"><Redirect to="/" /></Route>

            <Route path="/consciousness-nexus"><Redirect to="/universe" /></Route>
            <Route path="/universal-consciousness"><Redirect to="/universe" /></Route>
            <Route path="/dimensional-travel"><Redirect to="/universe" /></Route>
            <Route path="/portal-bridge"><Redirect to="/universe" /></Route>
            <Route path="/portal"><Redirect to="/universe" /></Route>
            <Route path="/spiritual-awakening"><Redirect to="/universe" /></Route>
            <Route path="/sacred-traditions"><Redirect to="/universe" /></Route>
            <Route path="/moon-cycle"><Redirect to="/universe" /></Route>
            <Route path="/universe-model"><Redirect to="/universe" /></Route>

            <Route path="/unified-knowledge"><Redirect to="/secrets" /></Route>
            <Route path="/secret-knowledge"><Redirect to="/secrets" /></Route>
            <Route path="/vatican-archives"><Redirect to="/secrets" /></Route>
            <Route path="/secret-society"><Redirect to="/secrets" /></Route>

            <Route path="/grand-council"><Redirect to="/members" /></Route>
            <Route path="/grand-conference"><Redirect to="/members" /></Route>
            <Route path="/community-hub"><Redirect to="/members" /></Route>

            <Route path="/sovereign-hub"><Redirect to="/settings" /></Route>
            <Route path="/benchmark-audit"><Redirect to="/settings" /></Route>
            <Route path="/security-audit"><Redirect to="/settings" /></Route>
            <Route path="/mesh"><Redirect to="/settings" /></Route>
            <Route path="/lattice"><Redirect to="/settings" /></Route>
            <Route path="/system"><Redirect to="/settings" /></Route>
            <Route path="/config"><Redirect to="/settings" /></Route>
            <Route path="/performance"><Redirect to="/settings" /></Route>
            <Route path="/diagnostics"><Redirect to="/settings" /></Route>

            <Route path="/inventions"><Redirect to="/build" /></Route>
            <Route path="/agi"><Redirect to="/build" /></Route>

            <Route path="/agent-nft"><Redirect to="/life" /></Route>
            <Route path="/recruitment"><Redirect to="/forum" /></Route>

            <Route component={NotFound} />
          </Switch>
        </PageTransition>
      </AnimatePresence>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AdminProvider>
          <MeshProvider>
          <NLPGoalsProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ToroidalBackground />
              <div className="flex flex-col h-dvh w-full overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
                <Toaster />
                <div className="fixed top-2 right-2 z-50">
                  <MeshStatusBadge />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-scroll-container style={{ paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))", WebkitOverflowScrolling: "touch" }}>
                  <ScrollToTop />
                  <AppRouter />
                </div>
                <ActiveCommandsOverlay />
                <MobileNav />
              </div>
            </WouterRouter>
          </TooltipProvider>
          </NLPGoalsProvider>
          </MeshProvider>
        </AdminProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
