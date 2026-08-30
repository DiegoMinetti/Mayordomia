import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#214E46' },
    secondary: { main: '#B86B3E' },
    background: { default: '#F7F5EF', paper: '#FFFFFF' },
    error: { main: '#B33A3A' },
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 750 },
    h2: { fontSize: '1.35rem', fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 650 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #E6E1D7', boxShadow: '0 5px 18px rgba(33,78,70,.05)' },
      },
    },
  },
});
