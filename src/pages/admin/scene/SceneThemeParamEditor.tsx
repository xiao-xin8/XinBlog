import { Box, FormControlLabel, Slider, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, alpha } from '@mui/material';
import { ColorPicker } from '@/components/Common/ColorPicker';
import type { SceneThemeConfig, ThemeParamSchema } from '@/types';

interface SceneThemeParamEditorProps {
  schema: ThemeParamSchema[];
  config: SceneThemeConfig;
  onChange: (patch: Partial<SceneThemeConfig>) => void;
}

export function SceneThemeParamEditor({ schema, config, onChange }: SceneThemeParamEditorProps) {
  const params = config.params || {};

  const updateParam = (key: string, value: unknown) => {
    onChange({
      params: { ...params, [key]: value },
    });
  };

  if (schema.length === 0) {
    return (
      <Typography color="text.secondary">该场景主题暂无可调参数。</Typography>

    );
  }

  return (
    <Stack spacing={3}>
      {schema.map((item) => {
        const value = params[item.key];

        if (item.type === 'number') {
          const numeric = typeof value === 'number' ? value : (item.min ?? 0);
          return (
            <Box key={item.key}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {item.label} {numeric}
                {item.key.toLowerCase().includes('duration') || item.key.toLowerCase().includes('speed')
                  ? ''
                  : item.key.toLowerCase().includes('opacity')
                    ? ''
                    : 'px'}
              </Typography>

              <Slider
                value={numeric}
                onChange={(_, v) => updateParam(item.key, v as number)}
                min={item.min ?? 0}
                max={item.max ?? 100}
                step={item.step ?? 1}
                valueLabelDisplay="auto"
              />
            </Box>

          );
        }

        if (item.type === 'boolean') {
          return (
            <FormControlLabel
              key={item.key}
              control={
                <Switch
                  checked={!!value}
                  onChange={(e) => updateParam(item.key, e.target.checked)}
                />
              }
              label={item.label}
            />
          );
        }

        if (item.type === 'select') {
          return (
            <Box key={item.key}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {item.label}
              </Typography>

              <ToggleButtonGroup
                value={String(value ?? '')}
                exclusive
                onChange={(_, v) => v !== null && updateParam(item.key, v)}
                size="small"
                sx={{
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  p: 0.5,
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 'none',
                    borderRadius: (t) => t.shape.borderRadius * 1.5,
                    px: 2.5,
                    py: 0.6,
                    typography: 'body2',
                    fontWeight: 600,
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      bgcolor: 'background.paper',
                      color: 'primary.main',
                      boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
                    },
                  },
                }}
              >
                {(item.options || []).map((opt) => (
                  <ToggleButton key={opt.value} value={opt.value}>
                    {opt.label}
                  </ToggleButton>

                ))}
              </ToggleButtonGroup>

            </Box>

          );
        }

        if (item.type === 'color') {
          return (
            <Box key={item.key}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {item.label}
              </Typography>

              <ColorPicker
                value={String(value || '#000000')}
                onChange={(v) => updateParam(item.key, v)}
              />
            </Box>

          );
        }

        return null;
      })}
    </Stack>

  );
}
