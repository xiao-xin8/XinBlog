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
import { useMusicEditor, tabList } from './music/useMusicEditor';
import { MusicBasicPanel } from './music/MusicBasicPanel';
import { MusicPreviewPanel } from './music/MusicPreviewPanel';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';

export function AdminMusic() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const editor = useMusicEditor();

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, overflowWrap: 'break-word' }}>
            音乐播放器
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
                borderRadius: (t) => t.shape.borderRadius * 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
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
                  borderRadius: (t) => t.shape.borderRadius * 1.5,
                  boxShadow: (t) => `0 2px 10px ${alpha(t.palette.common.black, 0.08)}`,
                  transition: (t) =>
                    t.transitions.create('transform', {
                      easing: t.transitions.easing.easeInOut,
                      duration: t.transitions.duration.short,
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
                      borderRadius: (t) => t.shape.borderRadius * 1.5,
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
            {editor.tab === 'basic' && <MusicBasicPanel editor={editor} />}
            {editor.tab === 'preview' && <MusicPreviewPanel editor={editor} />}
          </Box>
        </Fade>

        <FloatingSaveButton
          show={editor.isDirty}
          saving={editor.saving}
          onClick={editor.save}
          label="保存设置"
        />
      </Box>
    </Fade>
  );
}
