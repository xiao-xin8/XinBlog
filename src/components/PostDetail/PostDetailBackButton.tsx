import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';

interface PostDetailBackButtonProps {
  label?: string;
}

export function PostDetailBackButton({ label = '返回上一级' }: PostDetailBackButtonProps) {
  const navigate = useNavigate();

  return (
    <Box
      component="button"
      onClick={() => navigate(-1)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        mb: 3,
        px: 2,
        py: 1,
        borderRadius: '999px',
        border: 'none',
        fontSize: '0.875rem',
        fontWeight: 700,
        color: 'text.secondary',
        bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
        backdropFilter: 'blur(12px)',
        boxShadow: (t) =>
          t.palette.mode === 'light'
            ? '0 1px 4px rgba(0,0,0,0.06)'
            : '0 1px 4px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          color: 'primary.main',
          transform: 'translateX(-2px)',
        },
        '&:active': {
          transform: 'scale(0.96)',
        },
      }}
    >
      <Box
        component="svg"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={{
          transition: 'transform 0.3s ease',
          '.group:hover &': { transform: 'translateX(-3px)' },
        }}
      >
        <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </Box>
      {label}
    </Box>
  );
}
