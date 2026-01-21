import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ContentGenerator from "./pages/ContentGenerator";
import BulkContent from "./pages/BulkContent";
import SeoAudit from "./pages/SeoAudit";
import KeywordResearch from "./pages/KeywordResearch";
import RankTracking from "./pages/RankTracking";
import Competitors from "./pages/Competitors";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/content" element={<ContentGenerator />} />
            <Route path="/bulk-content" element={<BulkContent />} />
            <Route path="/audit" element={<SeoAudit />} />
            <Route path="/keywords" element={<KeywordResearch />} />
            <Route path="/rank-tracking" element={<RankTracking />} />
            <Route path="/competitors" element={<Competitors />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
