import { useState } from 'react';
import {
  CalendarMonth,
  Dashboard,
  Event,
  ExpandMore,
  Handyman,
  Inventory2,
  Menu,
  MoreHoriz,
  Notifications,
  Place,
  RequestPage,
  ShoppingCart,
} from '@mui/icons-material';
import {
  AppBar,
  Badge,
  Box,
  BottomNavigation,
  BottomNavigationAction,
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

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
            value="central"
            IconComponent={ExpandMore}
            sx={{ minWidth: 180, ml: 1 }}
            aria-label="Organización"
          >
            <MenuItem value="central">Congregación Central</MenuItem>
          </Select>
          <Box flex={1} />
          <IconButton aria-label="3 notificaciones">
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>
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
