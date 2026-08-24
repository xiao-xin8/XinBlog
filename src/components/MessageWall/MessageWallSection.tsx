import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, Skeleton, Fade, alpha, Button, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import StyleIcon from '@mui/icons-material/Style';
import TimelineIcon from '@mui/icons-material/Timeline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MessageWallEditor from './MessageWallEditor';
import MessageWallManager from './MessageWallManager';
import DanmakuStyle from './styles/DanmakuStyle';
import FlipCardStyle from './styles/FlipCardStyle';
import TimeTunnelStyle from './styles/TimeTunnelStyle';
import { getMessageWallSettings } from '@/api/messages';
import { useAuthStore } from '@/stores/authStore';
import type { MessageWallSettings, MessageWallStyle } from '@/types/interaction';

const STYLE_ICONS: Record<MessageWallStyle, React.ReactNode> = {
  danmaku: <SubscriptionsIcon sx={{ fontSize: 18 }} />,
  flipcard: <StyleIcon sx={{ fontSize: 18 }} />,
  timetunnel: <TimelineIcon sx={{ fontSize: 18 }} />,
};

const STYLE_LABELS: Record<MessageWallStyle, string> = {
  danmaku: '弹幕',
  flipcard: '翻牌',
  timetunnel: '时空隧道',
};

export default function MessageWallSection() {
  const theme = useTheme();
  const { isAuthenticated } = useAuthStore();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [settings, setSettings] = useState<MessageWallSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [style, setStyle] = useState<MessageWallStyle>('danmaku');
  const [editorOpen, setEditorOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSettings = useCallback(async () => {
    const res = await getMessageWallSettings();
    if (res.code === 0 && res.data) {
      setSettings(res.data);
      setStyle(res.data.defaultStyle || 'danmaku');
    }
    setLoadingSettings(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleStyleChange = (_: React.MouseEvent<HTMLElement>, newStyle: MessageWallStyle | null) => {
    if (newStyle) setStyle(newStyle);
  };

  if (loadingSettings) {
    return (
      <Box sx={{ mt: 4 }}>
        <Skeleton variant="text" width="30%" height={32} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>

    );
  }

  if (!settings || !settings.enabled) {
    return null;
  }

  return (
    <Fade in timeout={400}>
      <Box>
        {}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 1,
            p: { xs: 2, sm: 3 },
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)}, ${alpha(
                theme.palette.primary.main,
                0.02
              )} 45%, ${alpha(theme.palette.secondary.main, 0.05)})`,
          }}
        >
          {}
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              filter: 'blur(24px)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -80,
              left: -50,
              width: 200,
              height: 200,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
              filter: 'blur(28px)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <ChatBubbleOutlineIcon color="primary" sx={{ fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                留言墙
              </Typography>

            </Box>


            {}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'center' : 'flex-end',
                mb: 2,
              }}
            >
              <ToggleButtonGroup
                value={style}
                exclusive
                onChange={handleStyleChange}
                size="small"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  p: 0.3,
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                    px: 1.5,
                    py: 0.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'text.secondary',
                    gap: 0.5,
                    '&.Mui-selected': {
                      bgcolor: 'background.paper',
                      color: 'primary.main',
                      boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                    },
                    '&:hover': { bgcolor: 'transparent' },
                  },
                }}
              >
                {(Object.entries(STYLE_LABELS) as [MessageWallStyle, string][]).map(([key, label]) => (
                  <ToggleButton key={key} value={key}>
                    {STYLE_ICONS[key]}
                    {!isMobile && label}
                  </ToggleButton>

                ))}
              </ToggleButtonGroup>

            </Box>


            {}
            <Fade in timeout={300} key={style}>
              <Box>
                {style === 'danmaku' && (
                  <DanmakuStyle
                    key={`danmaku-${refreshKey}-${settings.danmakuRepeatSec}`}
                    trackCount={settings.danmakuTrackCount ?? 12}
                    speedMin={settings.danmakuSpeedMin ?? 8}
                    speedMax={settings.danmakuSpeedMax ?? 11}
                    intervalMin={settings.danmakuIntervalMin ?? 6}
                    intervalMax={settings.danmakuIntervalMax ?? 10}
                    repeatSec={settings.danmakuRepeatSec ?? 45}
                  />
                )}
                {style === 'flipcard' && <FlipCardStyle key={`flipcard-${refreshKey}`} />}
                {style === 'timetunnel' && <TimeTunnelStyle key={`timetunnel-${refreshKey}`} />}
              </Box>

            </Fade>


            {}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                mt: 3,
                pt: 2.5,
                borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                flexWrap: 'wrap',
              }}
            >
              {isAuthenticated && (
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<PersonOutlineIcon />}
                  onClick={() => setManagerOpen(true)}
                  sx={{
                    borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
                    px: 3,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  我的留言
                </Button>

              )}
              <Button
                variant="contained"
                size="medium"
                startIcon={<AddIcon />}
                onClick={() => setEditorOpen(true)}
                sx={{
                  borderRadius: (theme) => `max(8px, ${theme.shape.borderRadius}px - 4px)`,
                  px: 3,
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                新增留言
              </Button>

            </Box>

          </Box>

        </Box>


        {}
        <MessageWallEditor
          open={editorOpen}
          allowAnonymous={settings.allowAnonymous}
          isAuthenticated={isAuthenticated}
          onClose={() => setEditorOpen(false)}
          onSuccess={handleRefresh}
        />

        {}
        {isAuthenticated && (
          <MessageWallManager
            open={managerOpen}
            onClose={() => setManagerOpen(false)}
            onChanged={handleRefresh}
          />
        )}
      </Box>

    </Fade>

  );
}
