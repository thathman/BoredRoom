import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaUpdatePrompt } from "@/components/system/PwaUpdatePrompt";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SessionScreenPage = lazy(() => import("./pages/SessionScreen"));
const SessionSetupPage = lazy(() => import("./pages/SessionSetup"));
const SessionJoinPage = lazy(() => import("./pages/SessionJoin"));
const GamesPage = lazy(() => import("./pages/Games"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboard"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="font-display text-sm uppercase tracking-wider text-muted-foreground">Loading…</div>
  </div>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PwaUpdatePrompt />
        <div className="relative min-h-screen">
          <div className="relative z-10">
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  {/* Unified house-session routing. Games never leave these session routes. */}
                  <Route path="/start" element={<SessionSetupPage />} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/packs" element={<Navigate to="/games" replace />} />
                  <Route path="/join" element={<SessionJoinPage />} />
                  <Route path="/join/:sessionCode" element={<SessionJoinPage />} />
                  <Route path="/session/:code/:screen" element={<SessionScreenPage />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
