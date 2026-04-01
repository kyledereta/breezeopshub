import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import TodayPage from "./pages/Today";
import Index from "./pages/Index";
import BookingsPage from "./pages/Bookings";
import BalancesPage from "./pages/Balances";
import RevenuePage from "./pages/Revenue";
import GuestsPage from "./pages/Guests";
import SettingsPage from "./pages/Settings";
import UnitsPage from "./pages/Units";
import ResortMapPage from "./pages/ResortMap";
import LoginPage from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<TodayPage />} />
      <Route path="/availability" element={<Index />} />
      <Route path="/bookings" element={<BookingsPage />} />
      <Route path="/balances" element={<BalancesPage />} />
      <Route path="/revenue" element={<RevenuePage />} />
      <Route path="/guests" element={<GuestsPage />} />
      <Route path="/units" element={<UnitsPage />} />
      <Route path="/map" element={<ResortMapPage />} />
      <Route path="/beach-map" element={<BeachMapPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
