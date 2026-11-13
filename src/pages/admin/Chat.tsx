import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControlLabel,
  Switch,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Button,
  useMediaQuery,
  alpha,
  Fade,
  Chip,
  IconButton,
  Skeleton,
  Pagination,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { getAdminChatSettings, updateChatSettings, getAdminChatRooms, deleteChatRoom } from '@/api/chat';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { RoomDialog } from '@/components/Admin/RoomDialog';
import ChatDoPanel from '@/components/Admin/ChatDoPanel';
import SettingsIcon from '@mui/icons-material/Settings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import StorageIcon from '@mui/icons-material/Storage';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import type { ChatSettings, CustomChatRoom } from '@/types/interaction';

type Tab = 'settings' | 'rooms' | 'do';

const TAB_LIST: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'settings', label: '基础设置', icon: <SettingsIcon sx={{ fontSize: 18 }} /> },
  { value: 'rooms', label: '房间管理', icon: <MeetingRoomIcon sx={{ fontSize: 18 }} /> },
  { value: 'do', label: '聊天数据', icon: <StorageIcon sx={{ fontSize: 18 }} /> },
];

const defaultSettings: ChatSettings = {
  enabled: false,
  publicRoomEnabled: true,
  allUsersRoomEnabled: true,
};

export function AdminChat() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [tab, setTab] = useState<Tab>('settings');

  const [settings, setSettings] = useState<ChatSettings>(defaultSettings);
  const [initialSettings, setInitialSettings] = useState<ChatSettings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 自定义房间列表
  const [rooms, setRooms] = useState<CustomChatRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsTotal, setRoomsTotal] = useState(0);
  const [roomsPage, setRoomsPage] = useState(1);
  const roomPageSize = 10;
  // 房间编辑弹窗 / 删除确认
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<CustomChatRoom | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<CustomChatRoom | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRooms = useCallback(async (page = 1) => {
    setRoomsLoading(true);
    const res = await getAdminChatRooms(page, roomPageSize);
    if (res.code === 0 && res.data) {
      setRooms(res.data.list || []);
      setRoomsTotal(res.data.total || 0);
    } else {
      enqueueSnackbar(res.msg || '获取房间列表失败', { variant: 'error' });
    }
    setRoomsLoading(false);
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadRooms(1);
  }, [loadRooms]);

  const handleOpenCreate = () => {
    setEditingRoom(null);
    setRoomDialogOpen(true);
  };

  const handleOpenEdit = (room: CustomChatRoom) => {
    setEditingRoom(room);
    setRoomDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingRoom) return;
    setDeleting(true);
    const res = await deleteChatRoom(deletingRoom.room_key);
    if (res.code === 0) {
      enqueueSnackbar('房间已删除', { variant: 'success' });
      setDeletingRoom(null);
      // 若当前页删空则回退一页
      const targetPage = rooms.length <= 1 && roomsPage > 1 ? roomsPage - 1 : roomsPage;
      setRoomsPage(targetPage);
      await loadRooms(targetPage);
    } else {
      enqueueSnackbar(res.msg || '删除失败', { variant: 'error' });
      setDeletingRoom(null);
    }
    setDeleting(false);
  };

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    const res = await getAdminChatSettings();
    if (res.code === 0 && res.data) {
      setSettings(res.data);
      setInitialSettings(res.data);
    } else {
      enqueueSnackbar(res.msg || '获取设置失败', { variant: 'error' });
    }
    setSettingsLoading(false);
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const settingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings]
  );

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await updateChatSettings(settings);
    if (res.code === 0) {
      if (res.data) {
        setSettings(res.data);
        setInitialSettings(res.data);
      }
      enqueueSnackbar('保存成功', { variant: 'success' });
    } else {
      enqueueSnackbar(res.msg || '保存失败', { variant: 'error' });
    }
    setSaving(false);
  };

  const paperShadow = {
    boxShadow: (t: typeof theme) =>
      t.palette.mode === 'light'
        ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
        : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
  };

  const renderSettings = () => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        overflow: 'hidden',
        ...paperShadow,
      }}
    >
      {settingsLoading ? (
        <Loading text="加载设置中..." />
      ) : (
        <Fade in timeout={400}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                  />
                }
                label="开启聊天室功能"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 0.5 }}>
                控制主页侧边栏是否显示「聊天室」入口
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.publicRoomEnabled}
                    onChange={(e) => setSettings((s) => ({ ...s, publicRoomEnabled: e.target.checked }))}
                  />
                }
                label="开放公共聊天房"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 0.5 }}>
                关闭后，未登录访客进入聊天室将看到「暂未开放」提示
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.allUsersRoomEnabled}
                    onChange={(e) => setSettings((s) => ({ ...s, allUsersRoomEnabled: e.target.checked }))}
                  />
                }
                label="开放全体聊天房"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 0.5 }}>
                仅登录用户的聊天房；关闭后未登录访客无法进入，登录用户同样不可用
              </Typography>
            </Box>
            <FloatingSaveButton show={settingsDirty} saving={saving} onClick={handleSaveSettings} label="保存" />
          </Box>
        </Fade>
      )}
    </Paper>
  );

  const renderRooms = () => (
    <Fade in timeout={400}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 面板头部：标题 + 创建按钮 */}
        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 1, ...paperShadow }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                <MeetingRoomIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  专属聊天房
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  按成员授权的自定义房间：可设置封面、简介与最大进入人数。
                </Typography>
              </Box>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ textTransform: 'none' }}>
              创建房间
            </Button>
          </Box>
        </Paper>

        {/* 房间列表 */}
        <Paper elevation={0} sx={{ borderRadius: 1, overflow: 'hidden', ...paperShadow }}>
          {roomsLoading ? (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Skeleton variant="rectangular" height={56} />
              <Skeleton variant="rectangular" height={56} />
            </Box>
          ) : rooms.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                还没有专属聊天房，点击右上角「创建房间」开始吧
              </Typography>
            </Box>
          ) : (
            <>
              {rooms.map((room) => (
                <Box key={room.room_key}>
                  <Divider sx={rooms[0] === room ? undefined : {}} />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2.5,
                      '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 104,
                        height: 60,
                        borderRadius: 1,
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                        background: (t) =>
                          t.palette.mode === 'light'
                            ? 'linear-gradient(135deg, rgba(58,90,153,0.16), rgba(99,123,255,0.12))'
                            : 'linear-gradient(135deg, rgba(58,90,153,0.30), rgba(99,123,255,0.24))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: (t) => t.palette.primary.main,
                      }}
                    >
                      {room.cover ? (
                        <Box component="img" src={room.cover} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <MeetingRoomIcon sx={{ fontSize: 26, opacity: 0.8 }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {room.name}
                        </Typography>
                        <Chip
                          size="small"
                          color={room.enabled ? 'success' : 'default'}
                          label={room.enabled ? '已启用' : '已停用'}
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                        {room.description || '暂无简介'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={`成员 ${room.member_count ?? 0}`} />
                        <Chip size="small" variant="outlined" color={room.max_users > 0 ? 'secondary' : 'default'} label={room.max_users > 0 ? `上限 ${room.max_users}` : '不限人数'} />
                        <Typography variant="caption" color="text.secondary">
                          {room.room_key}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Button size="small" onClick={() => handleOpenEdit(room)} sx={{ textTransform: 'none' }}>
                        编辑
                      </Button>
                      <IconButton size="small" color="error" onClick={() => setDeletingRoom(room)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              ))}
            </>
          )}
          {roomsTotal > roomPageSize && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={Math.ceil(roomsTotal / roomPageSize)}
                page={roomsPage}
                color="primary"
                onChange={(_, p) => {
                  setRoomsPage(p);
                  loadRooms(p);
                }}
              />
            </Box>
          )}
        </Paper>

        {/* 房间编辑/创建弹窗 */}
        <RoomDialog
          open={roomDialogOpen}
          editing={editingRoom}
          onClose={() => setRoomDialogOpen(false)}
          onSaved={() => {
            setRoomDialogOpen(false);
            loadRooms(roomsPage);
          }}
        />

        {/* 删除确认 */}
        <ConfirmDialog
          open={!!deletingRoom}
          title="删除专属聊天房？"
          content={
            deletingRoom ? (
              <span>
                确认删除「{deletingRoom.name}」？该房间及其成员关系将被永久移除，房间内的聊天记录由聊天服务另行管理，不可恢复。
              </span>
            ) : null
          }
          confirmText="删除"
          confirmColor="error"
          loading={deleting}
          onClose={() => !deleting && setDeletingRoom(null)}
          onConfirm={handleDelete}
        />
      </Box>
    </Fade>
  );

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          聊天室管理
        </Typography>

        {isMobileAdmin ? (
          <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
              sx={{
                borderRadius: 1,
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
              {TAB_LIST.map((item) => (
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
                  width: `calc((100% - 8px) / ${TAB_LIST.length})`,
                  bgcolor: 'background.paper',
                  borderRadius: 6,
                  boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  transform: `translateX(${TAB_LIST.findIndex((t) => t.value === tab) * 100}%)`,
                }}
              />
              {TAB_LIST.map((item) => (
                <Button
                  key={item.value}
                  startIcon={item.icon}
                  onClick={() => setTab(item.value)}
                  sx={{
                    flex: 1,
                    zIndex: 1,
                    py: 1,
                    px: { xs: 1.5, sm: 2 },
                    minWidth: { xs: 96, sm: 120 },
                    borderRadius: 6,
                    color: tab === item.value ? 'primary.main' : 'text.secondary',
                    fontWeight: tab === item.value ? 700 : 500,
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    textTransform: 'none',
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        <Fade in timeout={300} key={tab}>
          <Box>
            {tab === 'settings' && renderSettings()}
            {tab === 'rooms' && renderRooms()}
            {tab === 'do' && <ChatDoPanel />}
          </Box>
        </Fade>
      </Box>
    </Fade>
  );
}