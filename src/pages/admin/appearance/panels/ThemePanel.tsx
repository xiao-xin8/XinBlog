import { Box, Typography, Paper, Grid, ButtonBase, Button, Slider, ToggleButton, ToggleButtonGroup, alpha } from '@mui/material';
import { Check } from '@mui/icons-material';
import { themePresets } from '@/types/theme';
import { ColorPicker } from '@/components/Common/ColorPicker';
import type { AppearanceEditor } from '../useAppearanceEditor';

export function ThemePanel({ editor }: { editor: AppearanceEditor }) {
  const { useCustom, presetId, resetToPreset, setUseCustom, colors, handleColorChange, borderRadius, setBorderRadius, activeColors } = editor;

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          预设模板
        </Typography>
        <Grid container spacing={2}>
          {themePresets.map((preset) => {
            const isSelected = !useCustom && presetId === preset.id;
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={preset.id}>
                <ButtonBase
                  onClick={() => resetToPreset(preset.id)}
                  sx={{
                    width: '100%',
                    display: 'block',
                    textAlign: 'left',
                    borderRadius: 1,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: isSelected ? preset.colors.primary : 'transparent',
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? alpha(preset.colors.primary, 0.06)
                          : alpha(preset.colors.primary, 0.1),
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 16px ${preset.colors.primary}30`,
                      },
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: preset.colors.primary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                        }}
                      >
                        <Check sx={{ fontSize: 14 }} />
                      </Box>
                    )}
                    <Box
                      sx={{
                        width: '100%',
                        height: 60,
                        borderRadius: 1,
                        mb: 1.5,
                        background: preset.solid
                          ? preset.colors.primary
                          : `linear-gradient(135deg, ${preset.colors.primary} 0%, ${preset.colors.secondary} 100%)`,
                      }}
                    />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {preset.nameEn}
                    </Typography>
                  </Paper>
                </ButtonBase>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            自定义颜色
          </Typography>
          <ToggleButtonGroup
            value={useCustom ? 'custom' : 'preset'}
            exclusive
            onChange={(_, value) => value && setUseCustom(value === 'custom')}
            size="small"
          >
            <ToggleButton value="preset">使用预设</ToggleButton>
            <ToggleButton value="custom">自定义</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Grid container spacing={3}>
          {([
            { key: 'primary', label: '主色' },
            { key: 'primaryLight', label: '主色（浅）' },
            { key: 'primaryDark', label: '主色（深）' },
            { key: 'secondary', label: '副色' },
            { key: 'secondaryLight', label: '副色（浅）' },
            { key: 'secondaryDark', label: '副色（深）' },
          ] as { key: keyof import('@/types/theme').ThemeColorConfig; label: string }[]).map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.key}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {item.label}
              </Typography>
              <ColorPicker
                value={colors[item.key]}
                onChange={(v) => handleColorChange(item.key, v)}
                disabled={!useCustom}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          全局圆角
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={borderRadius}
            onChange={(_, value) => setBorderRadius(value as number)}
            min={0}
            max={32}
            step={2}
            marks={[
              { value: 0, label: '0' },
              { value: 8, label: '8' },
              { value: 16, label: '16' },
              { value: 24, label: '24' },
              { value: 32, label: '32' },
            ]}
            valueLabelDisplay="auto"
            sx={{
              '& .MuiSlider-markLabel': {
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
              },
            }}
          />
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 1,
          mb: 3,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          效果预览
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            sx={{
              borderRadius: `${borderRadius}px`,
              backgroundColor: activeColors.primary,
              '&:hover': { backgroundColor: activeColors.primaryDark },
            }}
          >
            主按钮
          </Button>
          <Button
            variant="outlined"
            sx={{
              borderRadius: `${borderRadius}px`,
              borderColor: activeColors.primary,
              color: activeColors.primary,
            }}
          >
            边框按钮
          </Button>
          <Box
            sx={{
              px: 2,
              py: 1,
              borderRadius: `${borderRadius}px`,
              backgroundColor: alpha(activeColors.primary, 0.1),
              color: activeColors.primary,
              fontWeight: 600,
            }}
          >
            标签样式
          </Box>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: `${borderRadius}px`,
              backgroundColor: activeColors.primary,
            }}
          />
        </Box>
      </Paper>
    </>
  );
}
