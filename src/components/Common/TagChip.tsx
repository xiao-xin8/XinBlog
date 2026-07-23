import { Chip, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { Tag } from '@/types';

interface TagChipProps {
  tag: Tag;
  size?: 'small' | 'medium';
  onClick?: () => void;
}

export function TagChip({ tag, size = 'small', onClick }: TagChipProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    navigate(`/tag/${tag.slug}`);
  };

  return (
    <Chip
      component="button"
      onClick={handleClick}
      clickable
      size={size}
      label={`# ${tag.name}`}
      sx={{
        borderRadius: 1,
        height: 'auto',
        backgroundColor: (theme) =>
          tag.color
            ? alpha(tag.color, theme.palette.mode === 'light' ? 0.12 : 0.2)
            : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.1 : 0.2),
        color: tag.color || 'primary.main',
        fontWeight: 500,
        textDecoration: 'none',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: (theme) =>
            tag.color
              ? alpha(tag.color, theme.palette.mode === 'light' ? 0.22 : 0.3)
              : alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.2 : 0.3),
        },
        '& .MuiChip-label': {
          whiteSpace: 'normal',
          overflowWrap: 'break-word',
          maxWidth: '100%',
        },
      }}
    />
  );
}
