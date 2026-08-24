import { Box, FormControlLabel, Slider, Stack, Switch, Typography } from '@mui/material';
import type { PostDetailThemeConfig, ThemeParamSchema } from '@/types';

interface PostDetailThemeParamEditorProps {
  schema: ThemeParamSchema[];
  config: PostDetailThemeConfig;
  onChange: (patch: Partial<PostDetailThemeConfig>) => void;
}

export function PostDetailThemeParamEditor({ schema, config, onChange }: PostDetailThemeParamEditorProps) {
  const params = config.params || {};

  const updateParam = (key: string, value: unknown) => {
    onChange({
      params: { ...params, [key]: value },
      [key]: value,
    });
  };

  if (schema.length === 0) {
    return <Typography color="text.secondary">该主题暂无可调参数。</Typography>;

  }

  return (
    <Stack spacing={3}>
      {schema.map((item) => {
        const topValue = (config as unknown as Record<string, unknown>)[item.key];
        const paramValue = params[item.key];
        const value = paramValue !== undefined ? paramValue : topValue;

        if (item.type === 'number') {
          const numeric = typeof value === 'number' ? value : (item.min ?? 0);
          const unit = item.key.toLowerCase().includes('opacity') ? '' : 'px';
          return (
            <Box key={item.key}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {item.label} {numeric}{unit}
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

        return null;
      })}
    </Stack>

  );
}
