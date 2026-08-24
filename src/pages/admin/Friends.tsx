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
  Avatar,
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
  TablePagination,
  Link as MuiLink,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  Fade,
  Grow,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add, Close, DeleteOutline, Edit, Image as ImageIcon, Link as LinkIcon, Save } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import { isSuperAdmin } from '@/utils/permission';
import {
  fetchAdminFriends,
  createAdminFriend,
  updateAdminFriend,
  deleteAdminFriend,
  fetchFriendApplications,
  auditFriendApplication,
  deleteFriendApplication,
} from '@/api/friends';
import { uploadMedia, deleteMedia, extractMediaId } from '@/api/media';
import { ColorPicker } from '@/components/Common/ColorPicker';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { FriendLink, FriendsConfig, FriendApplication } from '@/types';

type FriendsTab = 'basic' | 'style' | 'manage' | 'audit';

const TAB_LIST: { value: FriendsTab; label: string }[] = [
  { value: 'basic', label: '基础设置' },
  { value: 'style', label: '样式配置' },
  { value: 'manage', label: '友链管理' },
  { value: 'audit', label: '友链审核' },
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
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    setDeleting(true);
    onChange('');
    if (pendingDeleteMediaId) {
      try {
        await deleteMedia(pendingDeleteMediaId);
        enqueueSnackbar('头像已从媒体库删除', { variant: 'success' });
      } catch {
        enqueueSnackbar('头像已从友链移除，但媒体库删除失败', { variant: 'warning' });
      }
    }
    setDeleting(false);
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


      <ConfirmDialog
        open={deleteDialogOpen}
        title="确认移除头像？"
        content="移除后该图片将从媒体库中删除，是否继续？"
        confirmText="确认移除"
        confirmColor="error"
        loading={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />
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
  const { user } = useAuthStore();
  const isSuper = isSuperAdmin(user?.role);
  
  const visibleTabs = isSuper ? TAB_LIST : TAB_LIST.filter((t) => t.value === 'manage' || t.value === 'audit');
  const [tab, setTab] = useState<FriendsTab>(isSuper ? 'basic' : 'manage');

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

  const [saving, setSaving] = useState(false);

  
  const [enabled, setEnabled] = useState(friendsConfig.enabled);
  const [title, setTitle] = useState(friendsConfig.title);
  const [subtitle, setSubtitle] = useState(friendsConfig.subtitle);
  const [applyEnabled, setApplyEnabled] = useState(!!friendsConfig.applyEnabled);
  const [applyNeedsAudit, setApplyNeedsAudit] = useState(friendsConfig.applyNeedsAudit !== false);

  
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

  
  const [applications, setApplications] = useState<FriendApplication[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appProcessing, setAppProcessing] = useState<Set<number>>(new Set());
  const [remarkDialog, setRemarkDialog] = useState<{ open: boolean; app: FriendApplication | null; remark: string }>({
    open: false,
    app: null,
    remark: '',
  });
  const [appDeleteDialog, setAppDeleteDialog] = useState<{ open: boolean; app: FriendApplication | null; loading: boolean }>({
    open: false,
    app: null,
    loading: false,
  });
  const [appPage, setAppPage] = useState(0);
  const [appRowsPerPage, setAppRowsPerPage] = useState(10);
  const [appTotal, setAppTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<FriendApplication | null>(null);

  useEffect(() => {
    setEnabled(friendsConfig.enabled);
    setTitle(friendsConfig.title);
    setSubtitle(friendsConfig.subtitle);
    setApplyEnabled(!!friendsConfig.applyEnabled);
    setApplyNeedsAudit(friendsConfig.applyNeedsAudit !== false);
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
    
  }, [tab]);

  const basicDirty = useMemo(() => {
    return (
      enabled !== friendsConfig.enabled ||
      title !== friendsConfig.title ||
      subtitle !== friendsConfig.subtitle ||
      applyEnabled !== !!friendsConfig.applyEnabled ||
      applyNeedsAudit !== (friendsConfig.applyNeedsAudit !== false)
    );
  }, [enabled, title, subtitle, applyEnabled, applyNeedsAudit, friendsConfig]);

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
      applyEnabled,
      applyNeedsAudit,
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

  const loadApplications = async (page = appPage, limit = appRowsPerPage) => {
    setAppLoading(true);
    try {
      const data = await fetchFriendApplications(page + 1, limit);
      setApplications(data.list);
      setAppTotal(data.total);
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '获取申请失败', { variant: 'error' });
    } finally {
      setAppLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'audit') return;
    loadApplications(appPage, appRowsPerPage);
    
  }, [tab, appPage, appRowsPerPage]);

  const handleAppChangePage = (_: unknown, newPage: number) => {
    setAppPage(newPage);
  };

  const handleAppChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAppRowsPerPage(parseInt(e.target.value, 10));
    setAppPage(0);
  };

  const handleOpenDetail = (app: FriendApplication) => {
    setDetailApp(app);
    setDetailOpen(true);
  };

  const handleApprove = async (app: FriendApplication) => {
    setAppProcessing((prev) => new Set(prev).add(app.id));
    try {
      await auditFriendApplication(app.id, 'approved');
      enqueueSnackbar('已通过并添加为友链', { variant: 'success' });
      loadApplications();
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '审核失败', { variant: 'error' });
    } finally {
      setAppProcessing((prev) => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  };

  const handleOpenReject = (app: FriendApplication) => {
    setRemarkDialog({ open: true, app, remark: app.remark || '' });
  };

  const handleConfirmReject = async () => {
    const app = remarkDialog.app;
    if (!app) return;
    setAppProcessing((prev) => new Set(prev).add(app.id));
    try {
      await auditFriendApplication(app.id, 'rejected', remarkDialog.remark);
      enqueueSnackbar('已驳回', { variant: 'success' });
      setRemarkDialog({ open: false, app: null, remark: '' });
      loadApplications();
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '驳回失败', { variant: 'error' });
    } finally {
      setAppProcessing((prev) => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  };

  const handleAppDeleteClick = (app: FriendApplication) => {
    setAppDeleteDialog({ open: true, app, loading: false });
  };

  const handleConfirmAppDelete = async () => {
    const app = appDeleteDialog.app;
    if (!app) return;
    setAppDeleteDialog((prev) => ({ ...prev, loading: true }));
    try {
      await deleteFriendApplication(app.id);
      enqueueSnackbar('已删除', { variant: 'success' });
      loadApplications();
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '删除失败', { variant: 'error' });
    } finally {
      setAppDeleteDialog({ open: false, app: null, loading: false });
    }
  };

  const formatAppTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAuditPanel = () => {
    if (appLoading && applications.length === 0) return <Loading />;
    return (
      <>
        {applications.length === 0 ? (
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
              暂无友链申请
            </Typography>

          </Paper>

        ) : (
          <Paper
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
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              {applications.map((app, index) => (
                <Box key={app.id}>
                  {}
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: (t) => (t.palette.mode === 'light' ? '#fff' : 'transparent'),
                      transition: 'box-shadow 0.2s ease',
                      '&:hover': { boxShadow: (t) => `0 6px 20px ${alpha(t.palette.common.black, 0.06)}` },
                      flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    }}
                  >
                    <Avatar src={app.avatar || undefined} alt={app.name || '站点'} variant="rounded" sx={{ width: 44, height: 44, flexShrink: 0 }}>
                      {app.name?.[0] || '?'}
                    </Avatar>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
                          {app.name}
                        </Typography>

                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            flexShrink: 0,
                            color:
                              app.status === 'approved'
                                ? 'success.main'
                                : app.status === 'rejected'
                                ? 'error.main'
                                : 'warning.main',
                          }}
                        >
                          {app.status === 'approved' ? '已通过' : app.status === 'rejected' ? '已驳回' : '待审核'}
                        </Typography>

                      </Stack>

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {formatAppTime(app.createdAt)}
                        {app.email ? ` · ${app.email}` : ''}
                      </Typography>

                      {app.url && (
                        <MuiLink
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          sx={{
                            mt: 0.5,
                            display: 'inline-block',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'primary.main',
                          }}
                        >
                          {app.url}
                        </MuiLink>

                      )}
                      {}
                      {app.description ? (
                        <MuiLink
                          component="button"
                          type="button"
                          underline="hover"
                          onClick={() => handleOpenDetail(app)}
                          sx={{
                            mt: 0.5,
                            textAlign: 'left',
                            color: 'text.secondary',
                            fontSize: '0.785rem',
                            lineHeight: 1.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {app.description}
                        </MuiLink>

                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          无说明
                        </Typography>

                      )}
                      {app.status === 'rejected' && app.remark && (
                        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                          驳回原因：{app.remark}
                        </Typography>

                      )}
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => handleOpenDetail(app)}
                          sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
                        >
                          详情
                        </Button>

                        {app.status === 'pending' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={appProcessing.has(app.id)}
                            onClick={() => handleApprove(app)}
                            startIcon={appProcessing.has(app.id) ? <CircularProgress size={13} color="inherit" /> : undefined}
                            sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
                          >
                            通过
                          </Button>

                        )}
                        {app.status === 'pending' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={appProcessing.has(app.id)}
                            onClick={() => handleOpenReject(app)}
                            sx={{ textTransform: 'none', borderRadius: 1, minWidth: 64 }}
                          >
                            驳回
                          </Button>

                        )}
                        {isSuper && (<IconButton size="small" color="error" onClick={() => handleAppDeleteClick(app)}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>)}

                      </Stack>

                    </Box>

                  </Box>

                  {index < applications.length - 1 && <Divider sx={{ my: 1 }} />}
                </Box>

              ))}
            </Box>

            <TablePagination
              component="div"
              count={appTotal}
              page={appPage}
              onPageChange={handleAppChangePage}
              rowsPerPage={appRowsPerPage}
              onRowsPerPageChange={handleAppChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 20, 50]}
              labelRowsPerPage="每页"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                '& .MuiTablePagination-toolbar': {
                  flexWrap: 'wrap',
                  gap: 1,
                  py: 1,
                },
              }}
            />
          </Paper>

        )}
        {}
        <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md" TransitionComponent={Grow}>
          <DialogTitle>申请详情</DialogTitle>

          <DialogContent dividers sx={{ minHeight: '45vh', maxHeight: '70vh', overflowY: 'auto' }}>
            {detailApp && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar src={detailApp.avatar || undefined} alt={detailApp.name || '站点'} variant="rounded" sx={{ width: 56, height: 56 }}>
                    {detailApp.name?.[0] || '?'}
                  </Avatar>

                  <Box>
                    <Typography variant="h6">{detailApp.name}</Typography>

                    <Typography variant="caption" color="text.secondary">
                      {formatAppTime(detailApp.createdAt)}
                    </Typography>

                  </Box>

                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: detailApp.status === 'approved' ? 'success.main' : detailApp.status === 'rejected' ? 'error.main' : 'warning.main',
                  }}
                >
                  {detailApp.status === 'approved' ? '已通过' : detailApp.status === 'rejected' ? '已驳回' : '待审核'}
                </Typography>

                {detailApp.url && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      站点链接
                    </Typography>

                    <MuiLink href={detailApp.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ wordBreak: 'break-all', color: 'primary.main' }}>
                      {detailApp.url}
                    </MuiLink>

                  </Box>

                )}
                {detailApp.email && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      联系方式
                    </Typography>

                    <Typography variant="body2">{detailApp.email}</Typography>

                  </Box>

                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    站点说明
                  </Typography>

                  {detailApp.description ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {detailApp.description}
                    </Typography>

                  ) : (
                    <Typography variant="body2" color="text.secondary">无说明</Typography>

                  )}
                </Box>

                {}
                {detailApp.url && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      站点预览
                    </Typography>

                    <Paper
                      variant="outlined"
                      sx={{
                        height: { xs: 200, sm: 320 },
                        overflow: 'hidden',
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        display: 'flex',
                      }}
                    >
                      <iframe
                        src={detailApp.url}
                        title={`${detailApp.name} 预览`}
                        style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
                        sandbox="allow-scripts allow-same-origin"
                        loading="lazy"
                      />
                    </Paper>

                  </Box>

                )}
              </Stack>

            )}
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setDetailOpen(false)}>关闭</Button>

          </DialogActions>

        </Dialog>

      </>

    );
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
          {visibleTabs.map((item) => (
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
              width: `calc((100% - 8px) / ${visibleTabs.length})`,
              bgcolor: 'background.paper',
              borderRadius: 6,
              boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
              transition: (theme) =>
                theme.transitions.create('transform', {
                  easing: theme.transitions.easing.easeInOut,
                  duration: theme.transitions.duration.short,
                }),
              transform: `translateX(${visibleTabs.findIndex((t) => t.value === tab) * 100}%)`,
            }}
          />
          {visibleTabs.map((item) => (
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
        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          友链申请
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={applyEnabled}
              onChange={(e) => setApplyEnabled(e.target.checked)}
            />
          }
          label="开放友链申请"
        />
        <FormControlLabel
          control={
            <Switch
              checked={applyNeedsAudit}
              onChange={(e) => setApplyNeedsAudit(e.target.checked)}
            />
          }
          label="申请需审核后展示"
        />
        <Typography variant="caption" color="text.secondary">
          关闭「需审核后展示」时，访客提交的申请将直接生效为友链并立即展示。
        </Typography>

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

                      {isSuper && (
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(friend)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>

                      )}
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

                      {isSuper && (
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(friend)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>

                      )}
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
      {tab === 'audit' && renderAuditPanel()}

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

      <Dialog
        open={remarkDialog.open}
        onClose={() => !appProcessing.has(remarkDialog.app?.id ?? -1) && setRemarkDialog({ open: false, app: null, remark: '' })}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        BackdropProps={{ 'aria-hidden': false }}
      >
        <DialogTitle>驳回申请</DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="驳回说明（选填）"
            value={remarkDialog.remark}
            onChange={(e) => setRemarkDialog((prev) => ({ ...prev, remark: e.target.value }))}
            sx={{ mt: 1 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
          <Button onClick={() => setRemarkDialog({ open: false, app: null, remark: '' })} color="inherit" disabled={appProcessing.has(remarkDialog.app?.id ?? -1)}>
            取消
          </Button>

          <Button variant="contained" color="warning" onClick={handleConfirmReject} disabled={appProcessing.has(remarkDialog.app?.id ?? -1)}>
            确认驳回
          </Button>

        </DialogActions>

      </Dialog>


      <ConfirmDialog
        open={appDeleteDialog.open}
        title="确认删除申请？"
        content={appDeleteDialog.app ? `确定要删除「${appDeleteDialog.app.name}」的友链申请吗？删除后将无法恢复。` : ''}
        confirmText="确认删除"
        confirmColor="error"
        loading={appDeleteDialog.loading}
        onClose={() => setAppDeleteDialog({ open: false, app: null, loading: false })}
        onConfirm={handleConfirmAppDelete}
      />
    </Box>

    </Fade>

  );
}
