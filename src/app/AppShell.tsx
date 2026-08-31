import { useState } from 'react';
import {
  CalendarMonth,
  Dashboard,
  Event,
  ExpandMore,
  Handyman,
  Inventory2,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Menu,
  MoreHoriz,
  Place,
  RequestPage,
  ShoppingCart,
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../integrations/auth';
import { useCurrentOrg } from '../integrations/org';
import { NotificationBell } from '../features/notifications/NotificationBell';

const nav = [
  { to: '/', label: 'Inicio', icon: Dashboard },
  { to: '/agenda', label: 'Agenda', icon: CalendarMonth },
  { to: '/requests', label: 'Solicitudes', icon: RequestPage },
  { to: '/events', label: 'Eventos', icon: Event },
  { to: '/resources', label: 'Recursos', icon: Inventory2 },
  { to: '/locations', label: 'Espacios', icon: Place },
  { to: '/maintenance', label: 'Mantenimiento', icon: Handyman },
  { to: '/purchases', label: 'Compras', icon: ShoppingCart },
];
const drawerWidth = 248;
export function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, signIn, signOut, error } = useAuth();
  const { organizationId, setOrganizationId, available: availableOrgs } = useCurrentOrg();
  const drawer = (
    <Box>
      <Toolbar>
        <Stack>
          <Typography fontWeight={800} color="primary" fontSize="1.3rem">
            Mayordomía
          </Typography>
          <Typography variant="caption">Organización para servir</Typography>
        </Stack>
      </Toolbar>
      <List>
        {nav.map((item) => (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={loc.pathname === item.to}
            onClick={() => setOpen(false)}
          >
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid #e5e0d7',
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar>
          <IconButton
            sx={{ display: { md: 'none' } }}
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu />
          </IconButton>
          <Select
            size="small"
            value={organizationId ?? ''}
            IconComponent={ExpandMore}
            onChange={(e) => setOrganizationId(String(e.target.value))}
            sx={{ minWidth: 180, ml: 1 }}
            aria-label="Organización"
            disabled={!isAuthenticated || availableOrgs.length === 0}
            displayEmpty
          >
            {availableOrgs.length === 0 ? (
              <MenuItem value="" disabled>
                {isAuthenticated ? 'Sin organizaciones' : 'Iniciá sesión'}
              </MenuItem>
            ) : (
              availableOrgs.map((org) => (
                <MenuItem key={org.organizationId} value={org.organizationId}>
                  {org.name}
                </MenuItem>
              ))
            )}
          </Select>
          <Box flex={1} />
          {isAuthenticated && user ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
              <Chip
                avatar={<Avatar src={user.picture} alt={user.name ?? user.email} />}
                label={user.name ?? user.email}
                variant="outlined"
                size="small"
              />
              <Tooltip title="Cerrar sesión">
                <IconButton onClick={() => void signOut()} aria-label="Cerrar sesión">
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : (
            <Tooltip
              title={
                error?.code === 'NOT_CONFIGURED'
                  ? 'Configurá VITE_GOOGLE_CLIENT_ID para habilitar el login'
                  : 'Iniciar sesión con Google'
              }
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LoginIcon />}
                  onClick={() => void signIn()}
                  disabled={isLoading || error?.code === 'NOT_CONFIGURED'}
                  sx={{ mr: 1 }}
                >
                  Iniciar sesión
                </Button>
              </span>
            </Tooltip>
          )}
          <NotificationBell />
        </Toolbar>
      </AppBar>
      <Box component="nav">
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || open}
          onClose={() => setOpen(false)}
          slotProps={{ paper: { sx: { width: drawerWidth } } }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        id="main"
        sx={{
          flex: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3 },
          mt: 8,
          mb: { xs: 8, md: 0 },
          maxWidth: 1440,
        }}
      >
        <Outlet />
      </Box>
      {!desktop && (
        <BottomNavigation
          showLabels
          value={nav.findIndex((n) => n.to === loc.pathname)}
          onChange={(_, i) => (i < 4 ? navigate(nav[i].to) : setOpen(true))}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderTop: '1px solid #ddd',
          }}
        >
          <BottomNavigationAction label="Inicio" icon={<Dashboard />} />
          <BottomNavigationAction label="Agenda" icon={<CalendarMonth />} />
          <BottomNavigationAction label="Solicitudes" icon={<RequestPage />} />
          <BottomNavigationAction label="Eventos" icon={<Event />} />
          <BottomNavigationAction label="Más" icon={<MoreHoriz />} />
        </BottomNavigation>
      )}
    </Box>
  );
}
