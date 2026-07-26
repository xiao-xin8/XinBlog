import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme,
  useMediaQuery,
  Fade,
  Grow,
  CircularProgress,
} from '@mui/material';
import { Delete, Edit, Add, Save } from '@mui/icons-material';
import { fetchAdminTags, createAdminTag, updateAdminTag, deleteAdminTag } from '@/api/admin';
import { peekCache } from '@/api/client';
import { Loading } from '@/components/Common/Loading';
import { ColorPicker } from '@/components/Common/ColorPicker';
import type { AdminTag, PagedResult } from '@/api/admin';
import { useSnackbar } from 'notistack';

const emptyForm = {
  name: '',
  slug: '',
  color: '#5b7cfa',
};

export function AdminTags() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const tagsCache = peekCache<PagedResult<AdminTag>>('/api/v1/admin/tags');
  const [tags, setTags] = useState<AdminTag[]>(tagsCache.data?.list || []);
  const [loading, setLoading] = useState(!tagsCache.hit);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(tagsCache.data?.total || 0);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTags = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const result = await fetchAdminTags(page + 1, rowsPerPage);
    setTags(result?.list || []);
    setTotal(result?.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    loadTags(!tagsCache.hit);
    
  }, [page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setOpen(true);
  };

  const handleOpenEdit = (tag: AdminTag) => {
    setEditingId(tag.id);
    setForm({
      name: tag.name,
      slug: tag.slug,
      color: tag.color || '#5b7cfa',
    });
    setFormError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('标签名必填');
      return;
    }
    setFormError('');
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      color: form.color,
    };

    let result;
    if (editingId) {
      result = await updateAdminTag(editingId, payload);
    } else {
      result = await createAdminTag(payload);
    }

    setSaving(false);

    if (result.msg) {
      setFormError(result.msg);
      enqueueSnackbar(result.msg, { variant: 'error' });
      return;
    }

    enqueueSnackbar(editingId ? '标签已更新' : '标签已创建', { variant: 'success' });
    setOpen(false);
    await loadTags();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteAdminTag(deleteId);
    setDeleting(false);
    if (result.msg) {
      enqueueSnackbar(result.msg, { variant: 'error' });
    } else {
      enqueueSnackbar('标签已删除', { variant: 'success' });
    }
    setDeleteId(null);
    await loadTags();
  };

  return (
    <Fade in timeout={400}>
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
            标签管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
            管理文章标签，便于分类和检索
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreate}
          sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1, sm: 1 } }}
        >
          新建
        </Button>
      </Box>

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
        {loading ? (
          <Loading text="加载标签中..." />
        ) : (
          <Fade in timeout={400}>
            {isMobileAdmin ? (
          <Grid container spacing={2}>
            {tags.map((tag) => (
              <Grid item xs={12} sm={6} key={tag.id}>
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
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          backgroundColor: tag.color || '#ccc',
                          border: '1px solid',
                          borderColor: 'divider',
                          flexShrink: 0,
                        }}
                      />
                      <Chip
                        label={tag.name}
                        size="small"
                        sx={{
                          borderRadius: 1,
                          backgroundColor: tag.color || undefined,
                          color: tag.color ? (theme) => theme.palette.getContrastText(tag.color || theme.palette.primary.main) : undefined,
                          fontWeight: 600,
                          maxWidth: '100%',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, overflowWrap: 'break-word' }}>
                      {tag.slug}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
                        {tag.post_count || 0} 篇文章
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          onClick={() => handleOpenEdit(tag)}
                          sx={{ width: 44, height: 44 }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => setDeleteId(tag.id)}
                          sx={{ width: 44, height: 44 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {tags.length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  暂无标签，点击右上角新建
                </Box>
              </Grid>
            )}
          </Grid>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>标签名</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>颜色</TableCell>
                  <TableCell>文章数</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id} hover>
                    <TableCell>
                      <Chip
                        label={tag.name}
                        size="small"
                        sx={{
                          borderRadius: 1,
                          backgroundColor: tag.color || undefined,
                          color: tag.color ? (theme) => theme.palette.getContrastText(tag.color || theme.palette.primary.main) : undefined,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {tag.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: 1,
                            backgroundColor: tag.color || '#ccc',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {tag.color || '默认'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{tag.post_count || 0}</TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => handleOpenEdit(tag)} sx={{ width: 40, height: 40 }}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleteId(tag.id)} sx={{ width: 40, height: 40 }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {tags.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      暂无标签，点击右上角新建
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        </Fade>
      )}
      {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
            sx={{
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                gap: 1,
                py: 1,
              },
            }}
          />
        )}
      </Paper>

      {}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth TransitionComponent={Grow} BackdropProps={{ 'aria-hidden': false }}>
        <DialogTitle>{editingId ? '编辑标签' : '新建标签'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError && (
              <Typography color="error" variant="body2">
                {formError}
              </Typography>
            )}
            <TextField
              label="标签名"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              fullWidth
              placeholder="留空将自动生成"
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                颜色
              </Typography>
              <ColorPicker value={form.color} onChange={(color) => setForm((prev) => ({ ...prev, color }))} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} disabled={saving}>取消</Button>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : editingId ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} fullWidth maxWidth="xs" TransitionComponent={Grow} BackdropProps={{ 'aria-hidden': false }}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography variant="body2">删除后无法恢复，是否继续？</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' } }}>
            <Button onClick={() => setDeleteId(null)} disabled={deleting} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
              取消
            </Button>
              <Button color="error" variant="contained" startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Delete />} onClick={handleDelete} disabled={deleting} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
              {deleting ? '删除中...' : '删除'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
    </Fade>
  );
}
