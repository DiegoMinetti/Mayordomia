import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PublicRequestPage } from '../features/public/PublicRequestPage';
import { SetupPage } from '../features/setup/SetupPage';
import { PlaceholderPage } from '../components/PlaceholderPage';
import { RequestsPage } from '../features/requests/RequestsPage';
import { RequestDetailPage } from '../features/requests/RequestDetailPage';
import { ResourcesPage } from '../features/resources/ResourcesPage';
import { ResourceDetailPage } from '../features/resources/ResourceDetailPage';
import { LocationsPage } from '../features/locations/LocationsPage';
import { LocationDetailPage } from '../features/locations/LocationDetailPage';
import { EventsPage } from '../features/events/EventsPage';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { AgendaPage } from '../features/agenda/AgendaPage';
import { OperationsPage } from '../features/operations/OperationsPage';
import { DeliveryDetailPage } from '../features/operations/DeliveryDetailPage';
import { NewDeliveryPage } from '../features/operations/NewDeliveryPage';
import { MaintenancePage } from '../features/maintenance/MaintenancePage';
import { MaintenanceDetailPage } from '../features/maintenance/MaintenanceDetailPage';
import { PurchasesPage } from '../features/purchases/PurchasesPage';
import { PurchaseRequestDetailPage } from '../features/purchases/PurchaseRequestDetailPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';

const pages: Record<string, [string, string]> = {
  settings: ['Configuración', 'Organización, sedes, áreas, usuarios e integraciones.'],
};
export function App() {
  return (
    <Routes>
      <Route path="/solicitar" element={<PublicRequestPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="resources/:id" element={<ResourceDetailPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="locations/:id" element={<LocationDetailPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="operations/new" element={<NewDeliveryPage />} />
        <Route path="operations/:id" element={<DeliveryDetailPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="maintenance/:id" element={<MaintenanceDetailPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="purchases/:id" element={<PurchaseRequestDetailPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        {Object.entries(pages).map(([path, [title, desc]]) => (
          <Route
            key={path}
            path={path}
            element={<PlaceholderPage title={title} description={desc} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
