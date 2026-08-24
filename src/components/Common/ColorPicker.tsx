import { useState } from 'react';
import {
  Box,
  ButtonBase,
  Popover,
  Slider,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';

const presetColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#f472b6', '#fb7185', '#78716c', '#1f2937',
];

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { r: 0, g: 0, b: 0 };
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r: Number.isNaN(r) ? 0 : r, g: Number.isNaN(g) ? 0 : g, b: Number.isNaN(b) ? 0 : b };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function isValidHex(hex: string) {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function ColorPicker({ value, onChange, disabled, label }: ColorPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [localHex, setLocalHex] = useState(value);
  const open = Boolean(anchorEl);

  const rgb = hexToRgb(value);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    setLocalHex(value);
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const applyHex = (hex: string) => {
    const normalized = hex.startsWith('#') ? hex : `#${hex}`;
    if (isValidHex(normalized)) {
      onChange(normalized.toLowerCase());
    }
    setLocalHex(normalized.toLowerCase());
  };

  const updateChannel = (channel: 'r' | 'g' | 'b', newValue: number) => {
    const next = { ...rgb, [channel]: newValue };
    onChange(rgbToHex(next.r, next.g, next.b));
  };

  return (
    <>
      <ButtonBase
        onClick={handleOpen}
        disabled={disabled}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: 0,
          maxWidth: '100%',
          verticalAlign: 'middle',
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: 1,
            backgroundColor: value,
            border: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        />
        {label && (
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, overflowWrap: 'break-word', minWidth: 0 }}>
            {label}
          </Typography>

        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', flexShrink: 0 }}>
          {value}
        </Typography>

      </ButtonBase>


      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' } }
        transformOrigin={{ vertical: 'top', horizontal: 'left' } }
        PaperProps={{
          sx: {
            p: { xs: 1.5, sm: 2 },
            borderRadius: 1,
            width: 280,
            maxWidth: { xs: 'calc(100vw - 32px)', sm: 280 },
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`
                : `0 8px 32px ${alpha(theme.palette.common.black, 0.4)}`,
          },
        }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              width: '100%',
              height: 48,
              borderRadius: 1,
              backgroundColor: value,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.75 }}>
            {presetColors.map((color) => (
              <ButtonBase
                key={color}
                onClick={() => onChange(color)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 1,
                  backgroundColor: color,
                  border: '2px solid',
                  borderColor: value === color ? 'text.primary' : 'transparent',
                  '&:hover': { transform: 'scale(1.1)' },
                  transition: 'transform 0.15s ease',
                }}
              />
            ))}
          </Box>


          <TextField
            label="HEX"
            value={localHex}
            onChange={(e) => applyHex(e.target.value)}
            size="small"
            fullWidth
            inputProps={{ maxLength: 7 }}
          />

          {(['r', 'g', 'b'] as const).map((channel) => (
            <Box key={channel}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  {channel}
                </Typography>

                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {rgb[channel]}
                </Typography>

              </Box>

              <Slider
                value={rgb[channel]}
                onChange={(_, v) => updateChannel(channel, v as number)}
                min={0}
                max={255}
                size="small"
                sx={{
                  color:
                    channel === 'r'
                      ? '#ef4444'
                      : channel === 'g'
                      ? '#10b981'
                      : '#3b82f6',
                }}
              />
            </Box>

          ))}
        </Stack>

      </Popover>

    </>

  );
}
