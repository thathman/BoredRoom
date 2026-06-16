import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaUpdatePrompt } from "@/components/system/PwaUpdatePrompt";
import { GameIndexRedirect, GameRouteGuard } from "@/components/routing/GameRouteGuard";
import { GameAtmosphereCanvas } from "@/components/game/GameAtmosphereCanvas";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const HostPage = lazy(() => import("./pages/Host"));
const JoinPage = lazy(() => import("./pages/Join"));
const RoomPage = lazy(() => import("./pages/Room"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const DisplayStatsPage = lazy(() => import("./pages/DisplayStats"));
const DevGameOverPage = lazy(() => import("./pages/DevGameOver"));
const RecapPage = lazy(() => import("./pages/Recap"));
const ReplayViewerPage = lazy(() => import("./pages/ReplayViewer"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          <GameAtmosphereCanvas />
          <div className="relative z-10">
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/display/stats" element={<DisplayStatsPage />} />
                  <Route path="/dev/gameover/:gameId" element={<DevGameOverPage />} />
                  <Route path="/r/:token" element={<RecapPage />} />
                  <Route path="/replay/:id" element={<ReplayViewerPage />} />
                  <Route path="/arcade" element={<Navigate to="/" replace />} />
                  <Route path="/arcade/:gameId" element={<Navigate to="/" replace />} />

                  {/* Game-scoped routes */}
                  <Route path="/:game" element={<GameIndexRedirect />} />
                  <Route
                    path="/:game/host"
                    element={
                      <GameRouteGuard>
                        <HostPage />
                      </GameRouteGuard>
                    }
                  />
                  <Route
                    path="/:game/join"
                    element={
                      <GameRouteGuard>
                        <JoinPage />
                      </GameRouteGuard>
                    }
                  />
                  <Route
                    path="/:game/join/:code"
                    element={
                      <GameRouteGuard>
                        <JoinPage />
                      </GameRouteGuard>
                    }
                  />
                  <Route
                    path="/:game/room/:code"
                    element={
                      <GameRouteGuard>
                        <RoomPage />
                      </GameRouteGuard>
                    }
                  />

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
