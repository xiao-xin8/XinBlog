import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import type { Live2dEditor } from '../useLive2dEditor';

interface BasicPanelProps {
  editor: Live2dEditor;
}

export function BasicPanel({ editor }: BasicPanelProps) {
  const {
    enabled,
    setEnabled,
    mobileEnabled,
    setMobileEnabled,
    position,
    setPosition,
    width,
    setWidth,
    height,
    setHeight,
    mobileWidth,
    setMobileWidth,
    mobileHeight,
    setMobileHeight,
    drag,
    setDrag,
    showToggleAfterQuit,
    setShowToggleAfterQuit,
    modelSource,
    setModelSource,
  } = editor;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, overflowWrap: 'break-word' }}>
        基础设置
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          }
          label="启用看板娘"
        />

        <FormControlLabel
          control={
            <Switch
              checked={mobileEnabled}
              onChange={(e) => setMobileEnabled(e.target.checked)}
            />
          }
          label="移动端显示"
        />

        <FormControl fullWidth>
          <InputLabel>显示位置</InputLabel>
          <Select
            value={position}
            label="显示位置"
            onChange={(e) => setPosition(e.target.value as 'left' | 'right')}
          >
            <MenuItem value="right">右下角</MenuItem>
            <MenuItem value="left">左下角</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>模型资源来源</InputLabel>
          <Select
            value={modelSource}
            label="模型资源来源"
            onChange={(e) => setModelSource(e.target.value as 'local' | 'cdn')}
          >
            <MenuItem value="local">优先从本站点加载（缺失时回退官方 CDN）</MenuItem>
            <MenuItem value="cdn">直接从官方 CDN 加载</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="宽度（像素）"
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            fullWidth
          />
          <TextField
            label="高度（像素）"
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            fullWidth
          />
        </Box>

        {mobileEnabled && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="移动端宽度（像素）"
              type="number"
              value={mobileWidth}
              onChange={(e) => setMobileWidth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              fullWidth
            />
            <TextField
              label="移动端高度（像素）"
              type="number"
              value={mobileHeight}
              onChange={(e) => setMobileHeight(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              fullWidth
            />
          </Box>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={drag}
              onChange={(e) => setDrag(e.target.checked)}
            />
          }
          label="允许拖动"
        />

        <FormControlLabel
          control={
            <Switch
              checked={showToggleAfterQuit}
              onChange={(e) => setShowToggleAfterQuit(e.target.checked)}
            />
          }
          label="关闭后显示重新唤起按钮"
        />
      </Box>
    </Paper>
  );
}
