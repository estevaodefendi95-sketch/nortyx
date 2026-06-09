import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TransactionsProvider } from "@/context/TransactionsContext";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { SubcategoriesProvider } from "@/context/SubcategoriesContext";
import { OrganizationProvider, useOrganization } from "@/context/OrganizationContext";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RouteTransition, FullscreenLoader, SuspenseOverlay } from "@/components/RouteTransition";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { isEmailSuperAdmin } from "@/lib/superAdmin";

// Lazy-load pages so route transitions show a clean loading state
// instead of flashing the previous page's content.
const Index = lazy(() => import("./pages/Index"));
const Install = lazy(() => import("./pages/Install"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const AdminApproval = lazy(() => import("./pages/AdminApproval"));
const AdminHistory = lazy(() => import("./pages/AdminHistory"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const OrgSettings = lazy(() => import("./pages/OrgSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

// Master (Super Admin) pages — separate lazy bundle
const MasterDashboard = lazy(() => import("./pages/master/Dashboard"));
const MasterCompanies = lazy(() => import("./pages/master/Companies"));
const MasterCompanyDetail = lazy(() => import("./pages/master/CompanyDetail"));
const MasterPlans = lazy(() => import("./pages/master/Plans"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid stale flashes when revisiting routes
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { hasOrg, loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  // Usuário logado mas sem empresa → wizard de onboarding
  if (!hasOrg) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const { loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isEmailSuperAdmin(user.email)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const OnboardingRoute = () => {
  const { user, loading } = useAuth();
  const { hasOrg, loading: orgLoading } = useOrganization();

  if (loading || orgLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  // Já tem empresa → dashboard direto
  if (hasOrg) return <Navigate to="/" replace />;
  return <Onboarding />;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<SuspenseOverlay />}>
      <RouteTransition>
        <Routes location={location}>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/install" element={<Install />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/admin" element={<AdminRoute><AdminApproval /></AdminRoute>} />
          <Route path="/admin/history" element={<AdminRoute><AdminHistory /></AdminRoute>} />
          <Route path="/settings" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          {/* Master / Super Admin routes */}
          <Route path="/master" element={<SuperAdminRoute><MasterDashboard /></SuperAdminRoute>} />
          <Route path="/master/empresas" element={<SuperAdminRoute><MasterCompanies /></SuperAdminRoute>} />
          <Route path="/master/empresas/:id" element={<SuperAdminRoute><MasterCompanyDetail /></SuperAdminRoute>} />
          <Route path="/master/planos" element={<SuperAdminRoute><MasterPlans /></SuperAdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </RouteTransition>
    </Suspense>
  );
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
                    <ImpersonationBanner />
                    <AppRoutes />
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
