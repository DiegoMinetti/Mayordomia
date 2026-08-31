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

const pages: Record<string, [string, string]> = {
  agenda: ['Agenda', 'Eventos, reservas, entregas, devoluciones y tareas en una vista unificada.'],
  events: ['Eventos', 'El centro operativo de personas, espacios, recursos y tareas.'],
  maintenance: ['Mantenimiento', 'Fallas, reparaciones e inspecciones preventivas.'],
  purchases: ['Compras', 'Necesidades, cotizaciones, scoring explicable y decisiones trazables.'],
  settings: ['Configuración', 'Organización, sedes, áreas, usuarios e integraciones.'],
};
export function App() {
  return (
    <Routes>
      <Route path="/solicitar" element={<PublicRequestPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="resources/:id" element={<ResourceDetailPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="locations/:id" element={<LocationDetailPage />} />
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
