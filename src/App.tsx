import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TransactionsProvider } from "@/context/TransactionsContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { SubcategoriesProvider } from "@/context/SubcategoriesContext";
import { OrganizationProvider, useOrganization } from "@/context/OrganizationContext";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Install from "./pages/Install";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import PendingApproval from "./pages/PendingApproval";
import AdminApproval from "./pages/AdminApproval";
import AdminHistory from "./pages/AdminHistory";
import Onboarding from "./pages/Onboarding";
import OrgSettings from "./pages/OrgSettings";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, approved } = useAuth();
  const { hasOrg, loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (approved === false) return <Navigate to="/pending" replace />;
  if (!hasOrg) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const { loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const OnboardingRoute = () => {
  const { user, loading, approved } = useAuth();
  const { hasOrg, loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (approved === false) return <Navigate to="/pending" replace />;
  if (hasOrg) return <Navigate to="/" replace />;
  return <Onboarding />;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <CategoriesProvider>
              <SubcategoriesProvider>
                <TransactionsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <Routes>
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/pending" element={<PendingApproval />} />
                      <Route path="/onboarding" element={<OnboardingRoute />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="/admin" element={<AdminRoute><AdminApproval /></AdminRoute>} />
                      <Route path="/admin/history" element={<AdminRoute><AdminHistory /></AdminRoute>} />
                      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </TooltipProvider>
                </TransactionsProvider>
              </SubcategoriesProvider>
            </CategoriesProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
