import { Fade, Box, Typography, FormControl, Select, MenuItem, ButtonBase, alpha } from '@mui/material';
import { useAppearanceEditor, tabList } from './appearance/useAppearanceEditor';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ThemePanel } from './appearance/panels/ThemePanel';
import { HeroPanel } from './appearance/panels/HeroPanel';
import { AboutPanel } from './appearance/panels/AboutPanel';
import { LayoutPanel } from './appearance/panels/LayoutPanel';
import { FontPanel } from './appearance/panels/FontPanel';
import { CursorPanel } from './appearance/panels/CursorPanel';
import { BasicPanel } from './appearance/panels/BasicPanel';

export function AdminAppearance() {
  const editor = useAppearanceEditor();
  const { tab, setTab, isMobileAdmin, isDirty, saving, applyAll } = editor;

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          外观设置
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          自定义站点配色、首页英雄区、关于页面、鼠标、文章布局和基础信息。
        </Typography>

        {isMobileAdmin ? (
          <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as typeof tab)}
              sx={{
                borderRadius: 6,
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
              {tabList.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
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
            sx={{ mb: 3, maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}
          >
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                minWidth: 'max-content',
                p: 0.5,
                borderRadius: 6,
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
                  borderRadius: 6,
                  boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  transform: `translateX(${tabList.findIndex((t) => t.value === tab) * 100}%)`,
                }}
              />
              {tabList.map((item) => (
                <ButtonBase
                  key={item.value}
                  type="button"
                  onClick={() => setTab(item.value)}
                  sx={{
                    flex: 1,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 1,
                    px: { xs: 1.5, sm: 2 },
                    minWidth: { xs: 72, sm: 90 },
                    borderRadius: 6,
                    color: tab === item.value ? 'primary.main' : 'text.secondary',
                    fontWeight: tab === item.value ? 700 : 500,
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    textTransform: 'none',
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    '&:hover': { bgcolor: 'transparent' },
                    '& .MuiTouchRipple-root': { borderRadius: 6 },
                  }}
                >
                  {item.label}
                </ButtonBase>
              ))}
            </Box>
          </Box>
        )}

        {tab === 'basic' && <BasicPanel editor={editor} />}
        {tab === 'hero' && <HeroPanel editor={editor} />}
        {tab === 'about' && <AboutPanel editor={editor} />}
        {tab === 'cursor' && <CursorPanel editor={editor} />}
        {tab === 'layout' && <LayoutPanel editor={editor} />}
        {tab === 'theme' && <ThemePanel editor={editor} />}
        {tab === 'font' && <FontPanel editor={editor} />}

        <FloatingSaveButton show={isDirty} saving={saving} onClick={applyAll} label="保存外观设置" />
      </Box>
    </Fade>
  );
}
