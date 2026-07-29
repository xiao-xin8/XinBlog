import { useTheme, useMediaQuery } from '@mui/material';
export function useMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}