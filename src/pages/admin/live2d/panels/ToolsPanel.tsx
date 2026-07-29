import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  Paper,
  Typography,
  alpha,
} from '@mui/material';
import type { Live2dEditor } from '../useLive2dEditor';
interface ToolsPanelProps {
  editor: Live2dEditor;
}
export function ToolsPanel({ editor }: ToolsPanelProps) {
  const { allTools, isToolEnabled, toggleTool } = editor;
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
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'break-word' }}>
        工具按钮
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        勾选需要在看板娘工具栏中显示的功能按钮
      </Typography>
      <Grid container spacing={2}>
        {allTools.map((tool) => {
          const checked = isToolEnabled(tool.key);
          return (
            <Grid item xs={12} sm={6} md={4} key={tool.key}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <CardActionArea onClick={() => toggleTool(tool.key)}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleTool(tool.key)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0 }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap>
                          {tool.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tool.description}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Box sx={{ mt: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={allTools.every((t) => isToolEnabled(t.key))}
              indeterminate={
                allTools.some((t) => isToolEnabled(t.key)) &&
                !allTools.every((t) => isToolEnabled(t.key))
              }
              onChange={(e) => {
                if (e.target.checked) {
                  editor.setTools(allTools.map((t) => t.key));
                } else {
                  editor.setTools([]);
                }
              }}
            />
          }
          label="全选"
        />
      </Box>
    </Paper>
  );
}