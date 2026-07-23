import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  Fade,
  Grow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add, Close, DeleteOutline, Edit, Image as ImageIcon, Link as LinkIcon, Save } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore } from '@/stores/siteStore';
import {
  fetchAdminFriends,
  createAdminFriend,
  updateAdminFriend,
  deleteAdminFriend,
} from '@/api/friends';
import { uploadMedia, deleteMedia, extractMediaId } from '@/api/media';
import { ColorPicker } from '@/components/Common/ColorPicker';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { FriendLink, FriendsConfig } from '@/types';

type FriendsTab = 'basic' | 'style' | 'manage';

const TAB_LIST: { value: FriendsTab; label: string }[] = [
  { value: 'basic', label: '基础设置' },
  { value: 'style', label: '样式配置' },
  { value: 'manage', label: '友链管理' },
];

const MAX_AVATAR_SIZE = 30 * 1024;

import { getBase64Size, compressImage } from '@/utils/image';

function AvatarField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteMediaId, setPendingDeleteMediaId] = useState<number | null>(null);

  const handleUpload = async (file: File) => {
    try {
      const base64 = await compressImage(file, MAX_AVATAR_SIZE, 400);
      if (getBase64Size(base64) > MAX_AVATAR_SIZE) {
        enqueueSnackbar('头像压缩后仍超过 30KB', { variant: 'error' });
        return;
      }
      setUploading(true);
      const media = await uploadMedia(file.name, base64);
      onChange(media.url);
      enqueueSnackbar('头像上传成功', { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '头像处理失败';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    const mediaId = extractMediaId(value);
    if (mediaId) {
      setPendingDeleteMediaId(mediaId);
      setDeleteDialogOpen(true);
    } else {
      onChange('');
    }
  };

  const handleConfirmDelete = async () => {
    onChange('');
    if (pendingDeleteMediaId) {
      try {
        await deleteMedia(pendingDeleteMediaId);
        enqueueSnackbar('头像已从媒体库删除', { variant: 'success' });
      } catch {
        enqueueSnackbar('头像已从友链移除，但媒体库删除失败', { variant: 'warning' });
      }
    }
    setDeleteDialogOpen(false);
    setPendingDeleteMediaId(null);
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        头像
      </Typography>
      {value ? (
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 1 }}>
          <Box
            component="img"
            src={value}
            alt="头像预览"
            sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }}
          />
          <IconButton
            onClick={handleClear}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 28,
              height: 28,
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <Button
          variant="outlined"
          component="label"
          size="small"
          startIcon={uploading ? null : <ImageIcon />}
          disabled={uploading}
          sx={{ flexShrink: 0 }}
        >
          {uploading ? '上传中...' : '上传头像'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleUpload(file);
              e.target.value = '';
            }}
          />
        </Button>
        <TextField
          size="small"
          placeholder="或输入图片 URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        上传头像将自动压缩到 30KB 以内，也可引用自定义 URL
      </Typography>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Grow}
        PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
        BackdropProps={{ 'aria-hidden': false }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>确认移除头像？</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            移除后该图片将从媒体库中删除，是否继续？
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
            <Button onClick={() => setDeleteDialogOpen(false)} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
              取消
            </Button>
            <Button color="error" variant="contained" onClick={handleConfirmDelete} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
              确认移除
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function FriendEditDialog({
  open,
  friend,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  friend: FriendLink | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Omit<FriendLink, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (open) {
      setName(friend?.name || '');
      setUrl(friend?.url || '');
      setDescription(friend?.description || '');
      setAvatar(friend?.avatar || '');
      setSortOrder(String(friend?.sortOrder ?? 0));
    }
  }, [open, friend]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      url: url.trim(),
      description: description.trim(),
      avatar: avatar.trim(),
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionComponent={Grow} BackdropProps={{ 'aria-hidden': false }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{friend ? '编辑友链' : '新增友链'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 0.5 }}>
            <TextField
              label="站点名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="站点链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              fullWidth
              required
              placeholder="https://example.com"
              InputProps={{
                startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <TextField
              label="描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="一句话介绍"
            />
            <TextField
              label="排序权重"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              fullWidth
              helperText="数字越大越靠前"
            />
            <AvatarField value={avatar} onChange={setAvatar} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} color="inherit" disabled={saving}>
            取消
          </Button>
          <Button type="submit" variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function AdminFriends() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const site = useSiteStore();

  const friendsConfig: FriendsConfig = useMemo(
    () =>
      site.config.friends || {
        enabled: false,
        title: '友链',
        subtitle: '',
        cardStyle: 'standard',
        cardColor: '',
        avatarShape: 'rounded',
        showDescription: true,
      },
    [site.config.friends]
  );

  const [tab, setTab] = useState<FriendsTab>('basic');
  const [saving, setSaving] = useState(false);

  
  const [enabled, setEnabled] = useState(friendsConfig.enabled);
  const [title, setTitle] = useState(friendsConfig.title);
  const [subtitle, setSubtitle] = useState(friendsConfig.subtitle);

  
  const [cardStyle, setCardStyle] = useState(friendsConfig.cardStyle);
  const [cardColor, setCardColor] = useState(friendsConfig.cardColor);
  const [avatarShape, setAvatarShape] = useState(friendsConfig.avatarShape);
  const [showDescription, setShowDescription] = useState(friendsConfig.showDescription);

  
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFriend, setEditFriend] = useState<FriendLink | null>(null);
  const [friendSaving, setFriendSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; friend: FriendLink | null; loading: boolean }>({
    open: false,
    friend: null,
    loading: false,
  });

  useEffect(() => {
    setEnabled(friendsConfig.enabled);
    setTitle(friendsConfig.title);
    setSubtitle(friendsConfig.subtitle);
    setCardStyle(friendsConfig.cardStyle);
    setCardColor(friendsConfig.cardColor);
    setAvatarShape(friendsConfig.avatarShape);
    setShowDescription(friendsConfig.showDescription);
  }, [friendsConfig]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminFriends();
      setFriends(data.list);
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '获取友链失败', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'manage') return;
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const basicDirty = useMemo(() => {
    return (
      enabled !== friendsConfig.enabled ||
      title !== friendsConfig.title ||
      subtitle !== friendsConfig.subtitle
    );
  }, [enabled, title, subtitle, friendsConfig]);

  const styleDirty = useMemo(() => {
    return (
      cardStyle !== friendsConfig.cardStyle ||
      cardColor !== friendsConfig.cardColor ||
      avatarShape !== friendsConfig.avatarShape ||
      showDescription !== friendsConfig.showDescription
    );
  }, [cardStyle, cardColor, avatarShape, showDescription, friendsConfig]);

  const saveBasic = async () => {
    await saveConfig({
      ...friendsConfig,
      enabled,
      title,
      subtitle,
    });
  };

  const saveStyle = async () => {
    await saveConfig({
      ...friendsConfig,
      cardStyle,
      cardColor,
      avatarShape,
      showDescription,
    });
  };

  const saveConfig = async (next: FriendsConfig) => {
    setSaving(true);
    const ok = await site.saveConfig({ friends: next });
    setSaving(false);
    if (ok) {
      enqueueSnackbar('保存成功', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  const handleOpenAdd = () => {
    setEditFriend(null);
    setEditOpen(true);
  };

  const handleOpenEdit = (friend: FriendLink) => {
    setEditFriend(friend);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
  };

  const handleSaveFriend = async (data: Omit<FriendLink, 'id' | 'createdAt' | 'updatedAt'>) => {
    setFriendSaving(true);
    try {
      if (editFriend) {
        await updateAdminFriend(editFriend.id, data);
        enqueueSnackbar('友链已更新', { variant: 'success' });
      } else {
        await createAdminFriend(data);
        enqueueSnackbar('友链已创建', { variant: 'success' });
      }
      setEditOpen(false);
      loadFriends();
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '保存失败', { variant: 'error' });
    } finally {
      setFriendSaving(false);
    }
  };

  const handleDeleteClick = (friend: FriendLink) => {
    setDeleteDialog({ open: true, friend, loading: false });
  };

  const handleConfirmDelete = async () => {
    const friend = deleteDialog.friend;
    if (!friend) return;
    setDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await deleteAdminFriend(friend.id);
      enqueueSnackbar('删除成功', { variant: 'success' });
      loadFriends();
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '删除失败', { variant: 'error' });
    } finally {
      setDeleteDialog({ open: false, friend: null, loading: false });
    }
  };

  const renderTabs = () =>
    isMobileAdmin ? (
      <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
        <Select
          value={tab}
          onChange={(e) => setTab(e.target.value as FriendsTab)}
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
              onClick={() => setTab(item.value)}
              sx={{
                flex: 1,
                zIndex: 1,
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
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: 'transparent' },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Box>
    );

  const renderBasicPanel = () => (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Stack spacing={3}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          }
          label="开启友链功能"
        />
        <TextField label="页面标题" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
        <TextField
          label="页面副标题"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          fullWidth
          multiline
          rows={2}
        />
        <FloatingSaveButton show={basicDirty} saving={saving} onClick={saveBasic} label="保存基础设置" />
      </Stack>
    </Paper>
  );

  const renderStylePanel = () => (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Stack spacing={3}>
        <FormControl fullWidth>
          <InputLabel>卡片样式</InputLabel>
          <Select
            value={cardStyle}
            label="卡片样式"
            onChange={(e) => setCardStyle(e.target.value as 'standard' | 'compact')}
          >
            <MenuItem value="standard">标准卡片</MenuItem>
            <MenuItem value="compact">紧凑卡片</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>头像形状</InputLabel>
          <Select
            value={avatarShape}
            label="头像形状"
            onChange={(e) => setAvatarShape(e.target.value as 'circle' | 'rounded')}
          >
            <MenuItem value="circle">圆形</MenuItem>
            <MenuItem value="rounded">圆角</MenuItem>
          </Select>
        </FormControl>
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            卡片强调色
          </Typography>
          <ColorPicker value={cardColor} onChange={setCardColor} />
          <Typography variant="caption" color="text.secondary">
            留空则跟随主题主色
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={showDescription}
              onChange={(e) => setShowDescription(e.target.checked)}
            />
          }
          label="显示站点描述"
        />
        <FloatingSaveButton show={styleDirty} saving={saving} onClick={saveStyle} label="保存样式设置" />
      </Stack>
    </Paper>
  );

  const renderManagePanel = () => {
    if (loading && friends.length === 0) return <Loading />;

    return (
      <>
        <Box sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenAdd}>
            新增友链
          </Button>
        </Box>

        {friends.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 1,
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                  : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              暂无友链，点击上方按钮添加
            </Typography>
          </Paper>
        ) : isMobileAdmin ? (
          <Grid container spacing={2}>
            {friends.map((friend) => (
              <Grid item xs={12} sm={6} key={friend.id}>
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
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, minWidth: 0 }}>
                      {friend.avatar ? (
                        <Box
                          component="img"
                          src={friend.avatar}
                          alt={friend.name}
                          sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 700,
                          }}
                        >
                          {friend.name.charAt(0)}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ overflowWrap: 'break-word', fontWeight: 700 }}>
                          {friend.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word', display: 'block' }}>
                          {friend.url}
                        </Typography>
                      </Box>
                    </Box>
                    {friend.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, overflowWrap: 'break-word' }}>
                        {friend.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleOpenEdit(friend)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(friend)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                  : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>站点</TableCell>
                  <TableCell>链接</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>排序</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {friends.map((friend) => (
                  <TableRow key={friend.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        {friend.avatar ? (
                          <Box
                            component="img"
                            src={friend.avatar}
                            alt={friend.name}
                            sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                            }}
                          >
                            {friend.name.charAt(0)}
                          </Box>
                        )}
                        <Typography variant="body2" sx={{ overflowWrap: 'break-word', minWidth: 0, fontWeight: 600 }}>
                          {friend.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ overflowWrap: 'break-word', minWidth: 0, color: 'text.secondary' }}>
                        {friend.url}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ overflowWrap: 'break-word', minWidth: 0, color: 'text.secondary' }}>
                        {friend.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{friend.sortOrder ?? 0}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenEdit(friend)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(friend)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </>
    );
  };

  return (
    <Fade in timeout={400}>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        友链管理
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        配置友链页面开关、样式与友链列表。
      </Typography>

      {renderTabs()}

      {tab === 'basic' && renderBasicPanel()}
      {tab === 'style' && renderStylePanel()}
      {tab === 'manage' && renderManagePanel()}

      <FriendEditDialog
        open={editOpen}
        friend={editFriend}
        saving={friendSaving}
        onClose={handleCloseEdit}
        onSave={handleSaveFriend}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title="确认删除友链？"
        content={deleteDialog.friend ? `确定要删除友链「${deleteDialog.friend.name}」吗？删除后将无法恢复。` : ''}
        confirmText="确认删除"
        confirmColor="error"
        loading={deleteDialog.loading}
        onClose={() => setDeleteDialog({ open: false, friend: null, loading: false })}
        onConfirm={handleConfirmDelete}
      />
    </Box>
    </Fade>
  );
}
