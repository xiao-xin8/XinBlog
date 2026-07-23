import { useState } from 'react';
import { Box, Typography, Button, alpha, FormControl, Select, MenuItem, useMediaQuery, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BasicSettings } from './BasicSettings';
import { EmailSettings } from './EmailSettings';
import { AdminEmailTemplates } from './EmailTemplates';
import { Users } from './Users';

type SettingsTab = 'basic' | 'email' | 'email-template' | 'users';

export function AdminSettings() {
  const [tab, setTab] = useState<SettingsTab>('basic');
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'basic', label: '基础设置' },
    { id: 'email', label: '邮箱配置' },
    { id: 'email-template', label: '邮件模板' },
    { id: 'users', label: '用户管理' },
  ];

  return (
    <Fade in timeout={400}>
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, overflowWrap: 'break-word' }}>
        用户管理
      </Typography>

      {isMobileAdmin ? (
        <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
          <Select
            value={tab}
            onChange={(e) => setTab(e.target.value as SettingsTab)}
            sx={{
              borderRadius: (t) => t.shape.borderRadius * 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .MuiSelect-select': {
                fontWeight: 600,
                color: 'primary.main',
                py: 1,
                px: 2,
              },
            }}
          >
            {tabs.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <Box
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }}
          sx={{
            mb: 3,
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            pb: 0.5,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              minWidth: 'max-content',
              p: 0.5,
              borderRadius: (theme) => theme.shape.borderRadius * 1.5,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 4,
                width: `calc((100% - 8px) / ${tabs.length})`,
                bgcolor: 'background.paper',
                borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                transition: (theme) =>
                  theme.transitions.create('transform', {
                    easing: theme.transitions.easing.easeInOut,
                    duration: theme.transitions.duration.short,
                  }),
                transform: `translateX(${tabs.findIndex((t) => t.id === tab) * 100}%)`,
              }}
            />
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <Button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    px: { xs: 2, sm: 3 },
                    py: 0.8,
                    borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: 'transparent',
                    fontWeight: 600,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
          </Box>
        </Box>
      )}

      <Fade in timeout={300} key={tab}>
        <Box>
          {tab === 'users' && <Users />}
          {tab === 'basic' && <BasicSettings />}
          {tab === 'email' && <EmailSettings />}
          {tab === 'email-template' && <AdminEmailTemplates />}
        </Box>
      </Fade>
    </Box>
    </Fade>
  );
}
