import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grow,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
  Fade,
} from '@mui/material';
import { Add, ArrowDownward, ArrowUpward, DeleteOutline, Edit, OpenInNew, Save } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useSiteStore } from '@/stores/siteStore';
import { ColorPicker } from '@/components/Common/ColorPicker';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { Loading } from '@/components/Common/Loading';
import type { NavConfig, NavItemConfig } from '@/types';

function generateNavId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isExternalUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed}`;
}

interface NavItemFormData {
  title: string;
  url: string;
  color: string;
  openInNewTab: boolean;
}

const emptyForm: NavItemFormData = {
  title: '',
  url: '',
  color: '',
  openInNewTab: false,
};

function NavEditDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: NavItemConfig | null;
  onClose: () => void;
  onSave: (data: NavItemFormData) => void;
}) {
  const [form, setForm] = useState<NavItemFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NavItemFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(
        item
          ? {
              title: item.title,
              url: item.url,
              color: item.color || '',
              openInNewTab: item.openInNewTab || false,
            }
          : { ...emptyForm }
      );
      setErrors({});
    }
  }, [open, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Partial<Record<keyof NavItemFormData, string>> = {};
    if (!form.title.trim()) nextErrors.title = '请输入导航名称';
    if (!form.url.trim()) nextErrors.url = '请输入跳转地址';
    if (form.url.trim() && !/^\//.test(form.url.trim()) && !isExternalUrl(form.url.trim())) {
      nextErrors.url = '地址需以 / 开头或 http(s):// 开头';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSave({ ...form, url: normalizeUrl(form.url) });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Grow}
      PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700 }}>{item ? '编辑导航' : '新增导航'}</DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 0.5 }}>
            <TextField
              label="导航名称"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              fullWidth
              required
              error={Boolean(errors.title)}
              helperText={errors.title}
            />
            <TextField
              label="跳转地址"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              fullWidth
              required
              placeholder="/about 或 https://example.com"
              error={Boolean(errors.url)}
              helperText={errors.url || '站内地址以 / 开头，外部地址以 http(s):// 开头'}
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                文字颜色（留空使用默认主题色）
              </Typography>

              <ColorPicker value={form.color || ''} onChange={(v) => setForm((f) => ({ ...f, color: v }))} />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={form.openInNewTab}
                  onChange={(e) => setForm((f) => ({ ...f, openInNewTab: e.target.checked }))}
                />
              }
              label="在新标签页打开"
            />
          </Stack>

        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} color="inherit">
            取消
          </Button>

          <Button type="submit" variant="contained" startIcon={<Save />}>
            保存
          </Button>

        </DialogActions>

      </form>

    </Dialog>

  );
}

export function NavSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const site = useSiteStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NavItemConfig[]>([]);
  const [initialItems, setInitialItems] = useState<NavItemConfig[]>([]);
  const [editItem, setEditItem] = useState<NavItemConfig | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: NavItemConfig | null }>({
    open: false,
    item: null,
  });

  useEffect(() => {
    const navItems = site.config.nav?.items || [];
    const cloned = navItems.map((i) => ({ ...i }));
    setItems(cloned);
    setInitialItems(cloned);
    setLoading(false);
  }, [site.config.nav?.items]);

  const isDirty = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(initialItems);
  }, [items, initialItems]);

  const handleAdd = () => {
    setEditItem(null);
    setEditOpen(true);
  };

  const handleEdit = (item: NavItemConfig) => {
    setEditItem(item);
    setEditOpen(true);
  };

  const handleSaveItem = (form: NavItemFormData) => {
    if (editItem) {
      setItems((prev) =>
        prev.map((i) => (i.id === editItem.id ? { ...form, id: editItem.id } : i))
      );
    } else {
      setItems((prev) => [...prev, { ...form, id: generateNavId() }]);
    }
    setEditOpen(false);
    setEditItem(null);
  };

  const handleDelete = (item: NavItemConfig) => {
    setDeleteDialog({ open: true, item });
  };

  const confirmDelete = () => {
    if (!deleteDialog.item) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteDialog.item!.id));
    setDeleteDialog({ open: false, item: null });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const next: NavConfig = { items };
    const ok = await site.saveConfig({ nav: next });
    setSaving(false);
    if (ok) {
      setInitialItems(items.map((i) => ({ ...i })));
      enqueueSnackbar('导航设置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  if (loading) return <Loading />;

  return (
    <Fade in timeout={400}>
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
          导航设置
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          自定义顶部导航栏显示的链接，可设置名称、跳转地址、颜色及是否新标签页打开。
        </Typography>


        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<Add />} onClick={handleAdd} sx={{ textTransform: 'none' }}>
            新增导航
          </Button>

        </Box>


        <Stack spacing={2}>
          {items.length === 0 && (
            <Box
              sx={{
                py: 6,
                textAlign: 'center',
                color: 'text.secondary',
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography>暂无自定义导航，点击上方按钮添加</Typography>

            </Box>

          )}

          {items.map((item, index) => (
            <Card
              key={item.id}
              variant="outlined"
              sx={{
                borderRadius: 1,
                '&:hover': { boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}` },
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: { xs: 2, sm: 2.5 },
                  '&:last-child': { pb: { xs: 2, sm: 2.5 } },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: item.color || 'text.primary' }}>
                      {item.title}
                    </Typography>

                    {item.openInNewTab && (
                      <OpenInNew fontSize="small" sx={{ color: 'text.secondary', fontSize: 14 }} />
                    )}
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
                    {item.url}
                  </Typography>

                </Box>


                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label="上移"
                  >
                    <ArrowUpward fontSize="small" />
                  </IconButton>

                  <IconButton
                    size="small"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="下移"
                  >
                    <ArrowDownward fontSize="small" />
                  </IconButton>

                  <IconButton size="small" onClick={() => handleEdit(item)} aria-label="编辑">
                    <Edit fontSize="small" />
                  </IconButton>

                  <IconButton size="small" onClick={() => handleDelete(item)} aria-label="删除" color="error">
                    <DeleteOutline fontSize="small" />
                  </IconButton>

                </Box>

              </CardContent>

            </Card>

          ))}
        </Stack>


        <NavEditDialog
          open={editOpen}
          item={editItem}
          onClose={() => {
            setEditOpen(false);
            setEditItem(null);
          }}
          onSave={handleSaveItem}
        />

        <ConfirmDialog
          open={deleteDialog.open}
          title="删除导航"
          content={`确定删除导航「${deleteDialog.item?.title || ''}」吗？`}
          confirmText="删除"
          confirmColor="error"
          onClose={() => setDeleteDialog({ open: false, item: null })}
          onConfirm={confirmDelete}
        />

        <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存导航" />
      </Paper>

    </Fade>

  );
}
