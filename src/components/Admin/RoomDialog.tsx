import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grow,
  TextField,
  Typography,
  Checkbox,
  List,
  ListItemButton,
  CircularProgress,
  InputAdornment,
  IconButton,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search, Close, Image as ImageIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { uploadMedia } from '@/api/media';
import { compressImage, getBase64Size } from '@/utils/image';
import {
  searchRoomUsers,
  getAdminChatRoomMembers,
  createChatRoom,
  updateChatRoom,
} from '@/api/chat';
import type { CustomChatRoom, RoomUserOption } from '@/types/interaction';

// 封面压缩上限（KB）
const MAX_COVER_SIZE = 300 * 1024;

export interface RoomEditorValue {
  name: string;
  description: string;
  cover: string;
  max_users: number;
  members: number[];
  enabled: boolean;
}

export interface RoomDialogProps {
  open: boolean;
  /** 传入则为编辑已有房间，否则为新建 */
  editing?: CustomChatRoom | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyValue: RoomEditorValue = {
  name: '',
  description: '',
  cover: '',
  max_users: 0,
  members: [],
  enabled: true,
};

export function RoomDialog({ open, editing = null, onClose, onSaved }: RoomDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();

  const [value, setValue] = useState<RoomEditorValue>(emptyValue);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // 成员选择器状态
  const [keyword, setKeyword] = useState('');
  const [users, setUsers] = useState<RoomUserOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(0);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const loadUsers = useCallback(
    async (kw: string, pg: number, append = false) => {
      const tag = ++searchRef.current;
      setSearching(true);
      try {
        const res = await searchRoomUsers(kw, pg, pageSize);
        if (tag !== searchRef.current) return;
        if (res.code === 0 && res.data) {
          setUsers((prev) => (append ? [...prev, ...res.data.list] : res.data.list));
          setTotal(res.data.total);
        } else {
          enqueueSnackbar(res.msg || '加载用户失败', { variant: 'error' });
        }
      } finally {
        if (tag === searchRef.current) setSearching(false);
      }
    },
    [enqueueSnackbar]
  );

  // 打开时初始化
  useEffect(() => {
    if (!open) return;
    setValue(
      editing
        ? {
            name: editing.name,
            description: editing.description || '',
            cover: editing.cover || '',
            max_users: editing.max_users || 0,
            members: [],
            enabled: !!editing.enabled,
          }
        : { ...emptyValue }
    );
    setKeyword('');
    setPage(1);
    setUsers([]);
    setTotal(0);
    setMembersLoaded(false);
    searchRef.current += 1;
    if (editing) {
      // 编辑：回显现有成员
      getAdminChatRoomMembers(editing.room_key)
        .then((res) => {
          if (res.code === 0 && res.data?.list) {
            setValue((v) => ({ ...v, members: res.data.list.map((m) => m.id) }));
          }
          setMembersLoaded(true);
        })
        .catch(() => setMembersLoaded(true));
    } else {
      setMembersLoaded(true);
    }
    loadUsers('', 1);
  }, [open, editing, loadUsers]);

  // 重置滚动防止抖动：不给 users 用无限滚动，改分页"加载更多"
  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadUsers(keyword, next, true);
  };

  // 仅当文字变化时重置到第一页；分页加载走 loadMore
  const handleSearchChange = (kw: string) => {
    setKeyword(kw);
    setPage(1);
    loadUsers(kw, 1);
  };

  const toggleMember = (id: number) => {
    setValue((v) => ({
      ...v,
      members: v.members.includes(id) ? v.members.filter((m) => m !== id) : [...v.members, id],
    }));
  };

  const handleCoverUpload = async (file: File) => {
    try {
      const base64 = await compressImage(file, MAX_COVER_SIZE, 1280);
      if (getBase64Size(base64) > MAX_COVER_SIZE) {
        enqueueSnackbar('封面压缩后仍超过 300KB，请更换图片', { variant: 'error' });
        return;
      }
      setUploadingCover(true);
      const media = await uploadMedia(file.name, base64, { width: 1280 });
      setValue((v) => ({ ...v, cover: media.url }));
      enqueueSnackbar('封面上传成功', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : '封面上传失败', { variant: 'error' });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    const name = value.name.trim();
    if (!name) {
      enqueueSnackbar('请填写房间名称', { variant: 'warning' });
      return;
    }
    setSaving(true);
    const payload = {
      name,
      description: value.description.trim(),
      cover: value.cover.trim(),
      max_users: value.max_users,
      members: value.members,
    };
    try {
      const res = editing
        ? await updateChatRoom(editing.room_key, { ...payload, enabled: value.enabled })
        : await createChatRoom(payload);
      if (res.code === 0) {
        enqueueSnackbar(editing ? '房间已更新' : '房间创建成功', { variant: 'success' });
        onSaved();
      } else {
        enqueueSnackbar(res.msg || '保存失败', { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Grow}
      PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{editing ? '编辑房间' : '创建房间'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="房间名称"
          required
          size="small"
          fullWidth
          value={value.name}
          onChange={(e) => setValue((v) => ({ ...v, name: e.target.value.slice(0, 24) }))}
          inputProps={{ maxLength: 24 }}
        />
        <TextField
          label="房间简介"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={value.description}
          onChange={(e) => setValue((v) => ({ ...v, description: e.target.value.slice(0, 200) }))}
          inputProps={{ maxLength: 200 }}
        />

        {/* 封面 */}
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            封面图
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 152,
                height: 82,
                borderRadius: 1,
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative',
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              {value.cover ? (
                <Box
                  component="img"
                  src={value.cover}
                  alt="封面预览"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'action.hover',
                    color: 'text.disabled',
                    fontSize: 12,
                  }}
                >
                  未设置
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                component="label"
                size="small"
                startIcon={uploadingCover ? <CircularProgress size={16} /> : <ImageIcon />}
                disabled={uploadingCover}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
              >
                {uploadingCover ? '上传中...' : '上传封面'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleCoverUpload(file);
                    e.target.value = '';
                  }}
                />
              </Button>
              <TextField
                size="small"
                placeholder="或输入图片 URL（留空则使用默认封面）"
                value={value.cover}
                onChange={(e) => setValue((v) => ({ ...v, cover: e.target.value }))}
              />
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            不设置封面时将自动使用默认封面兜底
          </Typography>
        </Box>

        <TextField
          label="最大进入人数（0 表示不限制）"
          size="small"
          type="number"
          fullWidth
          value={value.max_users}
          onChange={(e) => {
            const n = Math.max(0, Math.min(500, Number(e.target.value) || 0));
            setValue((v) => ({ ...v, max_users: n }));
          }}
          InputProps={{ inputProps: { min: 0, max: 500 } }}
        />

        {/* 成员选择 */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              成员（已选 {value.members.length} 人）
            </Typography>
            {value.members.length > 0 && (
              <Button size="small" color="inherit" onClick={() => setValue((v) => ({ ...v, members: [] }))} sx={{ textTransform: 'none' }}>
                清空
              </Button>
            )}
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="搜索用户名"
            value={keyword}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: keyword ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearchChange('')}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <Box
            sx={{
              mt: 1,
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 1,
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            <List dense disablePadding>
              {users.map((u) => {
                const checked = value.members.includes(u.id);
                return (
                  <ListItemButton key={u.id} onClick={() => toggleMember(u.id)}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                      {u.username}
                    </Typography>
                    <Checkbox edge="end" checked={checked} onChange={() => toggleMember(u.id)} onClick={(e) => e.stopPropagation()} />
                  </ListItemButton>
                );
              })}
            </List>
            {searching && page === 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
            {!searching && users.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                没有匹配的用户
              </Typography>
            )}
          </Box>
          {!searching && total > users.length && (
            <Button size="small" onClick={loadMore} sx={{ mt: 1, textTransform: 'none' }}>
              加载更多（{users.length}/{total}）
            </Button>
          )}
        </Box>

        {editing && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              启用该房间
            </Typography>
            {value.enabled ? <Typography variant="caption" color="success.main">已启用</Typography> : <Typography variant="caption" color="error">已停用</Typography>}
            <Button size="small" variant="outlined" color={value.enabled ? 'error' : 'success'} onClick={() => setValue((v) => ({ ...v, enabled: !v.enabled }))} sx={{ textTransform: 'none' }}>
              {value.enabled ? '停用' : '启用'}
            </Button>
          </Box>
        )}

        {membersLoaded && value.members.length === 0 && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            尚未选择成员，创建后仅你自己可进入该房间。
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            width: isMobile ? '100%' : 'auto',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} color="inherit" disabled={saving} fullWidth={isMobile} sx={{ textTransform: 'none', borderRadius: 2 }}>
            取消
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving} fullWidth={isMobile} startIcon={saving ? <CircularProgress size={16} /> : undefined} sx={{ textTransform: 'none', borderRadius: 2 }}>
            {saving ? '保存中...' : editing ? '保存修改' : '创建房间'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}