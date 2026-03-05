import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import AdminDashboard from "./pages/AdminDashboard";
import HidracorFormatter from "./pages/HidracorFormatter";
import HidracorLoadsList from "./pages/HidracorLoadsList";
import HidracorLoadManager from "./pages/HidracorLoadManager";
import CerbrasFormatter from "./pages/CerbrasFormatter";
import CerbrasWeightsByCity from "./pages/CerbrasWeightsByCity";
import CerbrasCollectionForecast from "./pages/CerbrasCollectionForecast";
import ExternalLoads from "./pages/ExternalLoads";
import SavedExternalLoads from "./pages/SavedExternalLoads";
import LuzarteBudgets from "./pages/LuzarteBudgets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/hidracor-formatter" element={<HidracorFormatter />} />
            <Route path="/admin/hidracor-loads" element={<HidracorLoadsList />} />
            <Route path="/admin/hidracor-loads/:id" element={<HidracorLoadManager />} />
            <Route path="/admin/cerbras-formatter" element={<CerbrasFormatter />} />
            <Route path="/admin/cerbras-weights" element={<CerbrasWeightsByCity />} />
            <Route path="/admin/cerbras-collection" element={<CerbrasCollectionForecast />} />
            <Route path="/admin/external-loads" element={<ExternalLoads />} />
            <Route path="/admin/external-loads/saved" element={<SavedExternalLoads />} />
            <Route path="/admin/luzarte-budgets" element={<LuzarteBudgets />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;