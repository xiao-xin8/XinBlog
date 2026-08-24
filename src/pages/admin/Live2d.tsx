import {
  Box,
  Typography,
  Button,
  alpha,
  FormControl,
  Select,
  MenuItem,
  useMediaQuery,
  Fade,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLive2dEditor, tabList } from './live2d/useLive2dEditor';
import { BasicPanel } from './live2d/panels/BasicPanel';
import { ToolsPanel } from './live2d/panels/ToolsPanel';
import { AdvancedPanel } from './live2d/panels/AdvancedPanel';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';

export function AdminLive2d() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const editor = useLive2dEditor();

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, overflowWrap: 'break-word' }}>
            看板娘设置
          </Typography>

        </Box>


        {isMobileAdmin ? (
          <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
            <Select
              value={editor.tab}
              onChange={(e) => editor.setTab(e.target.value as typeof editor.tab)}
              sx={{
                borderRadius: (t) => t.shape.borderRadius * 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-select': {
                  fontWeight: 600,
                  color: 'primary.main',
                  py: 1,
                  px: 2,
                },
              }}
            >
              {tabList.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>

              ))}
            </Select>

          </FormControl>

        ) : (
          <Box
            onWheel={(e) => {
              const el = e.currentTarget;
              if (el.scrollWidth <= el.clientWidth) return;
              e.preventDefault();
              el.scrollLeft += e.deltaY;
            }}
            sx={{
              mb: 3,
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 0.5,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                minWidth: 'max-content',
                p: 0.5,
                borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: 4,
                  width: `calc((100% - 8px) / ${tabList.length})`,
                  bgcolor: 'background.paper',
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  transform: `translateX(${tabList.findIndex((t) => t.value === editor.tab) * 100}%)`,
                }}
              />
              {tabList.map((t) => {
                const active = editor.tab === t.value;
                return (
                  <Button
                    key={t.value}
                    onClick={() => editor.setTab(t.value)}
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      px: { xs: 2, sm: 3 },
                      py: 0.8,
                      borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: 'transparent',
                      fontWeight: 600,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: 'transparent' },
                    }}
                  >
                    {t.label}
                  </Button>

                );
              })}
            </Box>

          </Box>

        )}

        <Fade in timeout={300} key={editor.tab}>
          <Box>
            {editor.tab === 'basic' && <BasicPanel editor={editor} />}
            {editor.tab === 'tools' && <ToolsPanel editor={editor} />}
            {editor.tab === 'advanced' && <AdvancedPanel editor={editor} />}
          </Box>

        </Fade>


        <FloatingSaveButton
          show={editor.isDirty}
          saving={editor.saving}
          onClick={editor.save}
          label="保存设置"
        />

        <Box
          sx={{
            mt: 4,
            p: { xs: 2, sm: 3 },
            borderRadius: 1,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
            border: (t) => `1px dashed ${alpha(t.palette.primary.main, 0.2)}`,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            本功能基于开源项目 live2d-widget（
            <a
              href="https://github.com/stevenjoezhang/live2d-widget"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.palette.primary.main }}
            >
              stevenjoezhang/live2d-widget
            </a>

            ）与模型接口 fghrsh/live2d_api 实现。Live2D 模型、纹理及相关资源版权归各自作者所有，本站仅做集成与展示。
          </Typography>

        </Box>

      </Box>

    </Fade>

  );
}
