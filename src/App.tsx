import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PasswordGate } from "@/components/PasswordGate";
import TodayPage from "./pages/Today";
import Index from "./pages/Index";
import BookingsPage from "./pages/Bookings";
import BalancesPage from "./pages/Balances";
import RevenuePage from "./pages/Revenue";
import GuestsPage from "./pages/Guests";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PasswordGate>
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/availability" element={<Index />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/balances" element={<BalancesPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/guests" element={<GuestsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PasswordGate>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
