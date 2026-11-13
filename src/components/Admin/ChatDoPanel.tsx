import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  alpha,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Delete, Refresh, Storage, Menu as MenuIcon, Image as ImageIcon, Forum } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  fetchAdminChatDoOverview,
  fetchAdminChatMedia,
  deleteAdminChatMedia,
  buildChatMediaUrl,
  PUBLIC_CHAT_ROOM_KEY,
  PUBLIC_CHAT_ROOM_NAME,
  ALL_USERS_CHAT_ROOM_KEY,
  ALL_USERS_CHAT_ROOM_NAME,
  type AdminChatDoRoom,
  type AdminChatDoItem,
} from '@/api/chat';
import { Loading } from '@/components/Common/Loading';
import { LazyImage } from '@/components/Common/LazyImage';

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function roomDisplayName(room: AdminChatDoRoom): string {
  if (room.roomKey === PUBLIC_CHAT_ROOM_KEY) return PUBLIC_CHAT_ROOM_NAME;
  if (room.roomKey === ALL_USERS_CHAT_ROOM_KEY) return ALL_USERS_CHAT_ROOM_NAME;
  return room.name || room.roomKey;
}

// 聊天室管理 → 「聊天数据」Tab。左侧房间栏 + 右侧该房间的图片详情，圆角沿用后台统一的 borderRadius: 1。
export default function ChatDoPanel() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();

  const [rooms, setRooms] = useState<AdminChatDoRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [items, setItems] = useState<AdminChatDoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoadingRooms(true);
    const res = await fetchAdminChatDoOverview();
    setLoadingRooms(false);
    if (!res) {
      enqueueSnackbar('加载聊天数据概览失败', { variant: 'error' });
      return;
    }
    setRooms(res);
    setSelectedKey((prev) => (prev && res.some((r) => r.roomKey === prev) ? prev : res.length > 0 ? res[0].roomKey : null));
  };

  const loadMedia = async (roomKey: string) => {
    setLoadingItems(true);
    setItems([]);
    const res = await fetchAdminChatMedia(roomKey);
    setLoadingItems(false);
    if (!res) {
      enqueueSnackbar('加载图片列表失败', { variant: 'error' });
      return;
    }
    setItems(res);
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedKey) loadMedia(selectedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const handleDelete = async (id: string) => {
    if (!selectedKey) return;
    setDeletingId(id);
    const ok = await deleteAdminChatMedia(selectedKey, id);
    setDeletingId(null);
    if (ok) {
      enqueueSnackbar('图片已删除', { variant: 'success' });
      loadMedia(selectedKey);
      loadOverview();
    } else {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  };

  const selected = rooms.find((r) => r.roomKey === selectedKey);

  // 公共房间项：桌面内嵌栏与移动端抽屉共用
  const renderRoomItem = (room: AdminChatDoRoom) => {
    const active = selectedKey === room.roomKey;
    return (
      <Box
        key={room.roomKey}
        onClick={() => {
          if (room.error || active) return;
          setSelectedKey(room.roomKey);
          setMobileOpen(false);
        }}
        sx={{
          px: 2,
          py: 1.75,
          flexShrink: 0,
          minWidth: { xs: 200, md: 'auto' },
          cursor: room.error ? 'not-allowed' : 'pointer',
          borderLeft: '3px solid',
          borderLeftColor: active ? 'primary.main' : 'transparent',
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.08) : 'transparent',
          opacity: room.error ? 0.6 : 1,
          '&:hover': room.error ? {} : { bgcolor: (t) => alpha(t.palette.primary.main, 0.05) },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: active ? 700 : 600, color: active ? 'primary.main' : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {roomDisplayName(room)}
          </Typography>
          {room.error && <Chip label="异常" size="small" color="error" sx={{ height: 18, fontSize: '0.7rem' }} />}
        </Box>
        {!room.error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5, color: 'text.secondary' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Forum sx={{ fontSize: 12, opacity: 0.8 }} />
              <Typography variant="caption">{room.messageCount ?? '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ImageIcon sx={{ fontSize: 12, opacity: 0.8 }} />
              <Typography variant="caption">{room.mediaCount ?? '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Storage sx={{ fontSize: 12, opacity: 0.8 }} />
              <Typography variant="caption">{formatBytes(room.mediaBytes)}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      {/* 面板头部：标题 + 刷新 */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, boxShadow: (t) => (t.palette.mode === 'light' ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}` : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: 'primary.main', flexShrink: 0 }}>
            <Storage />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              聊天房存储数据
            </Typography>
            <Typography variant="caption" color="text.secondary">
              各聊天房 DO 的消息量与聊天图片，可浏览并删除单张图片。
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={loadOverview} disabled={loadingRooms} sx={{ color: 'text.secondary', flexShrink: 0 }}>
          {loadingRooms ? <CircularProgress size={20} /> : <Refresh />}
        </IconButton>
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 1, overflow: 'hidden', display: 'flex', minHeight: { md: 520 }, boxShadow: (t) => (t.palette.mode === 'light' ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}` : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`) }}>
        {/* 桌面端：左侧内嵌房间栏 */}
        {!isMobile && (
          <Box sx={{ width: 280, flexShrink: 0, overflowY: 'auto', maxHeight: 520, borderRight: '1px solid', borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.02) }}>
            {loadingRooms ? (
              <Box sx={{ p: 2 }}>
                <Loading text="加载中..." />
              </Box>
            ) : rooms.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="caption">暂无房间数据</Typography>
              </Box>
            ) : (
              rooms.map(renderRoomItem)
            )}
          </Box>
        )}

        {/* 右：选中房间的图片详情 */}
        <Box sx={{ flex: 1, minWidth: 0, p: 2.5 }}>
          {isMobile && (
            <Button
              variant="outlined"
              startIcon={<MenuIcon />}
              onClick={() => setMobileOpen(true)}
              sx={{ mb: 2, textTransform: 'none', borderRadius: 1 }}
            >
              选择聊天房
            </Button>
          )}
          {!selectedKey ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <Typography variant="body2">请选择一个聊天房查看其存储的图片</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <ImageIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {roomDisplayName(selected || { roomKey: selectedKey })}
                </Typography>
                <Chip size="small" label={selectedKey} sx={{ maxWidth: 160 }} />
                <Typography variant="body2" color="text.secondary">
                  图片共 {items.length} 张
                </Typography>
              </Box>
              {loadingItems ? (
                <Loading text="加载图片中..." />
              ) : items.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                  <Typography variant="body2">该房间暂无聊天图片</Typography>
                </Box>
              ) : (
                <Grid container spacing={1.5}>
                  {items.map((item) => (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={item.id}>
                      <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: (t) => alpha(t.palette.primary.main, 0.06), aspectRatio: '1 / 1' }}>
                        <LazyImage
                          src={buildChatMediaUrl(selectedKey, item.id)}
                          alt={item.id}
                          objectFit="cover"
                          placeholder="skeleton"
                          style={{ width: '100%', height: '100%' }}
                        />
                        <Tooltip title="删除图片">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: (t) => alpha(t.palette.common.black, 0.45), color: '#fff', '&:hover': { bgcolor: 'error.main' } }}
                          >
                            {deletingId === item.id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 0.5, py: 0.25, bgcolor: (t) => alpha(t.palette.common.black, 0.45) }}>
                          <Typography variant="caption" sx={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatBytes(item.bytes)}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </Box>
      </Paper>

      {/* 移动端：抽屉式房间列表。层级放低，保证它盖不住管理后台全局侧边栏 */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        anchor="left"
        sx={{
          display: { xs: 'block', md: 'none' },
          zIndex: (t) => t.zIndex.drawer - 200,
        }}
        PaperProps={{ sx: { width: 300, bgcolor: 'background.default' } }}
      >
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            选择聊天房
          </Typography>
        </Box>
        <Box>
          {loadingRooms ? (
            <Box sx={{ p: 2 }}>
              <Loading text="加载中..." />
            </Box>
          ) : rooms.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="caption">暂无房间数据</Typography>
            </Box>
          ) : (
            rooms.map(renderRoomItem)
          )}
        </Box>
      </Drawer>
    </Box>
  );
}