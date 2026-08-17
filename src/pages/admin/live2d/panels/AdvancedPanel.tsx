import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import type { Live2dEditor } from '../useLive2dEditor';

interface AdvancedPanelProps {
  editor: Live2dEditor;
}

export function AdvancedPanel({ editor }: AdvancedPanelProps) {
  const { logLevel, setLogLevel, customCdn, setCustomCdn } = editor;

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
        高级选项
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormControl fullWidth>
          <InputLabel>日志级别</InputLabel>
          <Select
            value={logLevel}
            label="日志级别"
            onChange={(e) => setLogLevel(e.target.value as 'error' | 'warn' | 'info' | 'trace')}
          >
            <MenuItem value="error">错误</MenuItem>
            <MenuItem value="warn">警告</MenuItem>
            <MenuItem value="info">信息</MenuItem>
            <MenuItem value="trace">详细</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="自定义模型 CDN 地址"
          placeholder="留空则使用官方 CDN"
          value={customCdn}
          onChange={(e) => setCustomCdn(e.target.value)}
          fullWidth
          helperText="填写后，模型将从该地址加载（覆盖官方 CDN）。在“本站点优先”模式下，本地模型缺失时也会回退到这里。"
        />
      </Box>
    </Paper>
  );
}
