import {
  Box,
  Typography,
  Paper,
  Stack,
  Switch,
  FormControlLabel,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Favorite,
  Waves,
  BubbleChart,
  TextFields,
  Celebration,
  Star,
  AutoAwesome,
} from '@mui/icons-material';
import type { AppearanceEditor } from '../useAppearanceEditor';
import type { ClickEffectType, ClickEffectColorMode, ClickEffectIntensity } from '@/types';
import { ClickEffectPreview } from '@/components/ClickEffect/ClickEffectPreview';
const EFFECT_OPTIONS: { value: ClickEffectType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'heart', label: '爱心', icon: <Favorite />, desc: '点击处升起漂浮爱心' },
  { value: 'ripple', label: '涟漪', icon: <Waves />, desc: '扩散的圆环水波纹' },
  { value: 'bubble', label: '气泡', icon: <BubbleChart />, desc: '晶莹剔透上升气泡' },
  { value: 'text', label: '文字', icon: <TextFields />, desc: '自定义文字向上飘浮' },
  { value: 'firework', label: '烟花', icon: <Celebration />, desc: '粒子向四周绽放' },
  { value: 'star', label: '星星', icon: <Star />, desc: '旋转的小星星四散' },
  { value: 'confetti', label: '彩纸', icon: <AutoAwesome />, desc: '彩色纸屑飞舞飘落' },
];
const COLOR_OPTIONS: { value: ClickEffectColorMode; label: string }[] = [
  { value: 'theme', label: '主题色' },
  { value: 'random', label: '随机马卡龙' },
  { value: 'custom', label: '自定义' },
];
const INTENSITY_OPTIONS: { value: ClickEffectIntensity; label: string }[] = [
  { value: 'low', label: '稀疏' },
  { value: 'medium', label: '适中' },
  { value: 'high', label: '密集' },
];
export function ClickEffectPanel({ editor }: { editor: AppearanceEditor }) {
  const theme = useTheme();
  const {
    clickEffectEnabled,
    setClickEffectEnabled,
    clickEffectType,
    setClickEffectType,
    clickEffectColorMode,
    setClickEffectColorMode,
    clickEffectCustomColor,
    setClickEffectCustomColor,
    clickEffectTextList,
    setClickEffectTextList,
    clickEffectIntensity,
    setClickEffectIntensity,
  } = editor;
  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              点击特效
            </Typography>
            <Typography variant="body2" color="text.secondary">
              在页面任意位置点击时触发趣味动画
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={clickEffectEnabled}
                onChange={(e) => setClickEffectEnabled(e.target.checked)}
              />
            }
            label={clickEffectEnabled ? '已开启' : '已关闭'}
          />
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          效果样式
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          {EFFECT_OPTIONS.map((opt) => {
            const active = clickEffectType === opt.value;
            return (
              <Button
                key={opt.value}
                variant={active ? 'contained' : 'outlined'}
                onClick={() => setClickEffectType(opt.value)}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'primary.main' : 'background.paper',
                  color: active ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: active ? 'primary.dark' : (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {opt.icon}
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, lineHeight: 1.2 }}>
                      {opt.desc}
                    </Typography>
                  </Box>
                </Stack>
              </Button>
            );
          })}
        </Box>
      </Paper>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          颜色模式
        </Typography>
        <ToggleButtonGroup
          value={clickEffectColorMode}
          exclusive
          onChange={(_, v) => v && setClickEffectColorMode(v)}
          sx={{
            '& .MuiToggleButton-root': {
              borderRadius: '9999px !important',
              px: 3,
              py: 1,
              textTransform: 'none',
              border: '1px solid',
              borderColor: 'divider',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              },
            },
          }}
        >
          {COLOR_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {clickEffectColorMode === 'custom' && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              label="自定义颜色"
              value={clickEffectCustomColor}
              onChange={(e) => setClickEffectCustomColor(e.target.value)}
              placeholder="#5b7cfa"
              size="small"
              sx={{ width: 160 }}
            />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: clickEffectCustomColor || theme.palette.primary.main,
                border: '2px solid',
                borderColor: 'divider',
              }}
            />
          </Box>
        )}
      </Paper>
      {clickEffectType === 'text' && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            漂浮文字
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            每行一个，点击时按顺序循环显示
          </Typography>
          <TextField
            multiline
            rows={5}
            fullWidth
            value={clickEffectTextList}
            onChange={(e) => setClickEffectTextList(e.target.value)}
            placeholder="富强&#10;民主&#10;文明"
          />
        </Paper>
      )}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          粒子密度
        </Typography>
        <ToggleButtonGroup
          value={clickEffectIntensity}
          exclusive
          onChange={(_, v) => v && setClickEffectIntensity(v)}
          sx={{
            '& .MuiToggleButton-root': {
              borderRadius: '9999px !important',
              px: 3,
              py: 1,
              textTransform: 'none',
              border: '1px solid',
              borderColor: 'divider',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              },
            },
          }}
        >
          {INTENSITY_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          border: '2px dashed',
          borderColor: 'primary.main',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          实时预览
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          点击下方区域即可按当前设置预览（保存后全站生效）
        </Typography>
        <ClickEffectPreview
          config={{
            enabled: clickEffectEnabled,
            type: clickEffectType,
            colorMode: clickEffectColorMode,
            customColor: clickEffectCustomColor,
            textList: clickEffectTextList.split(/\n/).map((t) => t.trim()).filter(Boolean),
            intensity: clickEffectIntensity,
          }}
          themeColor={theme.palette.primary.main}
        />
      </Paper>
    </Stack>
  );
}