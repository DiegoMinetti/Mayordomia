import { ArrowForward, Event, TaskAlt } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { attention, modules } from '../../app/demoData';

export function DashboardPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography color="primary" fontWeight={700}>
          Domingo, 30 de agosto
        </Typography>
        <Typography variant="h1">Buen día, Diego</Typography>
        <Typography color="text.secondary">Esto requiere atención ahora.</Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h2">Requiere atención</Typography>
                <Chip label={attention.length} color="error" size="small" />
              </Stack>
              <Stack mt={2}>
                {attention.map((item) => (
                  <Button
                    key={item.title}
                    component={Link}
                    to={item.path}
                    color="inherit"
                    sx={{ justifyContent: 'space-between', py: 1.5, borderTop: '1px solid #eee' }}
                    endIcon={<ArrowForward />}
                  >
                    <Box textAlign="left">
                      <Chip
                        label={item.level}
                        color={item.level === 'CRITICAL' ? 'error' : 'warning'}
                        size="small"
                      />
                      <Typography fontWeight={700}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.detail}
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack gap={2}>
            <Card>
              <CardContent>
                <Event color="primary" />
                <Typography variant="h2">Hoy</Typography>
                <Typography mt={1}>19:00 · Reunión principal</Typography>
                <Typography color="text.secondary">Salón principal · Sede Centro</Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <TaskAlt color="secondary" />
                <Typography variant="h2">Mis tareas</Typography>
                <Typography mt={1}>3 pendientes · 1 para hoy</Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
      <Box>
        <Typography variant="h2" mb={2}>
          Centro operativo
        </Typography>
        <Grid container spacing={2}>
          {modules.map(([name, desc, path]) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={name}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={Link} to={path} sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography fontWeight={750} fontSize="1.05rem">
                      {name}
                    </Typography>
                    <Typography color="text.secondary" mt={0.5}>
                      {desc}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}
