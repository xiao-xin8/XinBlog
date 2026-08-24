import { ButtonBase, styled } from '@mui/material';
import type { ButtonBaseProps } from '@mui/material';
import { darken, lighten } from '@mui/material';
import type { ReactNode } from 'react';


export const DRAWER_TRANSITION_MS = 225;

export const DrawerHeaderContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'space-between',
  flexShrink: 0,
}));

export interface NavItem {
  title: string;
  path: string;
  icon: ReactNode;
  
  superOnly?: boolean;
}

interface StyledNavButtonProps extends ButtonBaseProps {
  active?: boolean;
  to?: string;
}

export const StyledNavButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== 'active',
})<StyledNavButtonProps>(({ theme, active }) => ({
  borderRadius: '90px',
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  width: '100%',
  height: 36,
  padding: '4px 12px',
  paddingLeft: 14,
  textDecoration: 'none',
  transition:
    'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
  backgroundColor: active
    ? `${
        theme.palette.mode === 'light'
          ? lighten(theme.palette.primary.main, 0.7)
          : darken(theme.palette.primary.main, 0.7)
      } !important`
    : 'transparent',
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '& *': {
    textDecoration: 'none',
  },
}));
