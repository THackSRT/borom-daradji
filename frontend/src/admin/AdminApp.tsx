import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth";
import { AdminLayout } from "./components/AdminLayout";
import { LoadingBlock } from "./components/ui";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const PropertiesPage = lazy(() => import("./pages/PropertiesPage"));
const PropertyDetailPage = lazy(() => import("./pages/PropertyDetailPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const VisitsPage = lazy(() => import("./pages/VisitsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SitePage = lazy(() => import("./pages/SitePage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));

/**
 * Back-office, monté sous /admin. Chargé à la demande : le site vitrine ne télécharge pas ce code.
 */
export default function AdminApp() {
  // Styles du back-office sur <body> : les fenêtres et menus (portails Radix) en héritent aussi.
  useEffect(() => {
    document.body.classList.add("admin");
    return () => document.body.classList.remove("admin");
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={<div className="p-8"><LoadingBlock /></div>}>
        <Routes>
          <Route path="connexion" element={<LoginPage />} />
          <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="taches" element={<TasksPage />} />
            <Route path="biens" element={<PropertiesPage />} />
            <Route path="biens/:id" element={<PropertyDetailPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="visites" element={<RequireAuth roles={["agent", "commercial"]}><VisitsPage /></RequireAuth>} />
            <Route path="comptes" element={<RequireAuth roles={["dirigeant"]}><UsersPage /></RequireAuth>} />
            <Route path="parametres" element={<RequireAuth roles={["dirigeant"]}><SettingsPage /></RequireAuth>} />
            <Route path="site" element={<RequireAuth roles={["dirigeant"]}><SitePage /></RequireAuth>} />
            <Route path="journal" element={<RequireAuth roles={["dirigeant"]}><ActivityPage /></RequireAuth>} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
