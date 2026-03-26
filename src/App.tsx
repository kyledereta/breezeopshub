import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import TodayPage from "./pages/Today";
import BookingsPage from "./pages/Bookings";
import BalancesPage from "./pages/Balances";
import RevenuePage from "./pages/Revenue";
import NotFound from "./pages/NotFound";
import { AppLayout } from "@/components/AppLayout";

const queryClient = new QueryClient();

const PlaceholderPage = ({ title }: { title: string }) => (
  <AppLayout>
    <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
      <h1 className="text-3xl font-display text-foreground">{title}</h1>
    </div>
  </AppLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/balances" element={<BalancesPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/guests" element={<PlaceholderPage title="Guest Database" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;