import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PublicRequestPage } from '../features/public/PublicRequestPage';
import { SetupPage } from '../features/setup/SetupPage';
import { PlaceholderPage } from '../components/PlaceholderPage';
import { RequestsPage } from '../features/requests/RequestsPage';
import { RequestDetailPage } from '../features/requests/RequestDetailPage';

const pages: Record<string, [string, string]> = {
  agenda: ['Agenda', 'Eventos, reservas, entregas, devoluciones y tareas en una vista unificada.'],
  events: ['Eventos', 'El centro operativo de personas, espacios, recursos y tareas.'],
  resources: ['Recursos', 'Inventario serializado y por cantidad con historial de movimientos.'],
  locations: ['Espacios', 'Disponibilidad, capacidad y reglas de reserva.'],
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
