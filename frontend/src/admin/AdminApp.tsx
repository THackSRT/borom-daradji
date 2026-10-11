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
const RolesPage = lazy(() => import("./pages/RolesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SitePage = lazy(() => import("./pages/SitePage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const InvoiceDetailPage = lazy(() => import("./pages/InvoiceDetailPage"));
const InvoiceEditorPage = lazy(() => import("./pages/InvoiceEditorPage"));
const CashPage = lazy(() => import("./pages/CashPage"));
const LeasesPage = lazy(() => import("./pages/LeasesPage"));
const LeaseFormPage = lazy(() => import("./pages/LeaseFormPage"));
const LeaseDetailPage = lazy(() => import("./pages/LeaseDetailPage"));
const PayoutsPage = lazy(() => import("./pages/PayoutsPage"));
const InspectionPage = lazy(() => import("./pages/InspectionPage"));
const QuotesPage = lazy(() => import("./pages/QuotesPage"));
const QuoteEditorPage = lazy(() => import("./pages/QuoteEditorPage"));
const QuoteDetailPage = lazy(() => import("./pages/QuoteDetailPage"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const WorksitesPage = lazy(() => import("./pages/WorksitesPage"));
const WorksiteDetailPage = lazy(() => import("./pages/WorksiteDetailPage"));

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
            <Route path="biens" element={<RequireAuth permissions={["properties.view"]}><PropertiesPage /></RequireAuth>} />
            <Route path="biens/:id" element={<RequireAuth permissions={["properties.view"]}><PropertyDetailPage /></RequireAuth>} />
            <Route path="clients" element={<RequireAuth permissions={["clients.view"]}><ClientsPage /></RequireAuth>} />
            <Route path="clients/:id" element={<RequireAuth permissions={["clients.view"]}><ClientDetailPage /></RequireAuth>} />
            <Route path="visites" element={<RequireAuth permissions={["visits.view", "visits.manage"]}><VisitsPage /></RequireAuth>} />
            <Route path="factures" element={<RequireAuth permissions={["invoices.view"]}><InvoicesPage /></RequireAuth>} />
            <Route path="factures/nouvelle" element={<RequireAuth permissions={["invoices.manage"]}><InvoiceEditorPage /></RequireAuth>} />
            <Route path="factures/:id" element={<RequireAuth permissions={["invoices.view"]}><InvoiceDetailPage /></RequireAuth>} />
            <Route path="factures/:id/modifier" element={<RequireAuth permissions={["invoices.manage"]}><InvoiceEditorPage /></RequireAuth>} />
            <Route path="baux" element={<RequireAuth permissions={["leases.view"]}><LeasesPage /></RequireAuth>} />
            <Route path="baux/nouveau" element={<RequireAuth permissions={["leases.manage"]}><LeaseFormPage /></RequireAuth>} />
            <Route path="baux/:id" element={<RequireAuth permissions={["leases.view"]}><LeaseDetailPage /></RequireAuth>} />
            <Route path="etats-des-lieux/:id" element={<RequireAuth permissions={["leases.view"]}><InspectionPage /></RequireAuth>} />
            <Route path="devis" element={<RequireAuth permissions={["works.view", "works.quotes"]}><QuotesPage /></RequireAuth>} />
            <Route path="devis/nouveau" element={<RequireAuth permissions={["works.quotes", "works.catalog"]}><QuoteEditorPage /></RequireAuth>} />
            <Route path="devis/:id" element={<RequireAuth permissions={["works.view", "works.quotes"]}><QuoteDetailPage /></RequireAuth>} />
            <Route path="devis/:id/modifier" element={<RequireAuth permissions={["works.quotes", "works.catalog"]}><QuoteEditorPage /></RequireAuth>} />
            <Route path="catalogue" element={<RequireAuth permissions={["works.catalog"]}><CatalogPage /></RequireAuth>} />
            <Route path="chantiers" element={<RequireAuth permissions={["works.view"]}><WorksitesPage /></RequireAuth>} />
            <Route path="chantiers/:id" element={<RequireAuth permissions={["works.view"]}><WorksiteDetailPage /></RequireAuth>} />
            <Route path="reversements" element={<RequireAuth permissions={["payouts.view", "payouts.manage"]}><PayoutsPage /></RequireAuth>} />
            <Route path="caisse" element={<RequireAuth permissions={["payments.create", "payments.view_all", "cash.view_all"]}><CashPage /></RequireAuth>} />
            <Route path="comptes" element={<RequireAuth permissions={["users.view", "users.manage"]}><UsersPage /></RequireAuth>} />
            <Route path="roles" element={<RequireAuth permissions={["roles.manage", "users.view", "users.manage"]}><RolesPage /></RequireAuth>} />
            <Route path="parametres" element={<RequireAuth permissions={["settings.manage"]}><SettingsPage /></RequireAuth>} />
            <Route path="site" element={<RequireAuth permissions={["site.manage"]}><SitePage /></RequireAuth>} />
            <Route path="journal" element={<RequireAuth permissions={["activity.view"]}><ActivityPage /></RequireAuth>} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
