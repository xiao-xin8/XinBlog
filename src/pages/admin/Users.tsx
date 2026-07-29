import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  alpha,
  Box,
  ButtonBase,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Fade,
  Grow,
  CircularProgress,
} from '@mui/material';
import { Edit, Delete, Save } from '@mui/icons-material';
import { fetchAdminUsers, updateAdminUser, deleteAdminUser, type AdminUser } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/Common/Loading';
import { useSnackbar } from 'notistack';
export function Users() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminUser>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    const data = await fetchAdminUsers(page + 1, rowsPerPage);
    if (data) {
      setUsers(data.list);
      setTotal(data.total);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };
  const handleOpenEdit = (user: AdminUser) => {
    if (!isSuperAdmin) return;
    setEditUser(user);
    setEditForm({
      username: user.username,
      email: user.email || '',
      role: user.role,
      status: user.status,
    });
  };
  const handleCloseEdit = () => {
    setEditUser(null);
    setEditForm({});
  };
  const handleOpenDelete = (user: AdminUser) => {
    setDeleteUser(user);
  };
  const handleCloseDelete = () => {
    setDeleteUser(null);
  };
  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    setDeleteSaving(true);
    const { msg } = await deleteAdminUser(deleteUser.id);
    setDeleteSaving(false);
    if (msg) {
      enqueueSnackbar(msg, { variant: 'error' });
    } else {
      enqueueSnackbar('用户已删除', { variant: 'success' });
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setTotal((prev) => Math.max(0, prev - 1));
      handleCloseDelete();
      handleCloseEdit();
    }
  };
  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    const patch: Partial<AdminUser> = {};
    if (editForm.username !== undefined && editForm.username !== editUser.username) {
      patch.username = editForm.username;
    }
    if (editForm.email !== undefined && editForm.email !== editUser.email) {
      patch.email = editForm.email || null;
    }
    if (editForm.role !== undefined && editForm.role !== editUser.role) {
      patch.role = editForm.role;
    }
    if (editForm.status !== undefined && editForm.status !== editUser.status) {
      patch.status = editForm.status ? 1 : 0;
    }
    if (Object.keys(patch).length === 0) {
      setEditSaving(false);
      handleCloseEdit();
      return;
    }
    const ok = await updateAdminUser(editUser.id, patch);
    setEditSaving(false);
    if (ok) {
      enqueueSnackbar('用户信息已保存', { variant: 'success' });
      setUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...u, ...patch } : u))
      );
      handleCloseEdit();
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };
  if (loading && users.length === 0) return <Loading />;
  return (
    <Fade in timeout={400}>
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
      {isMobileAdmin ? (
          <Grid container spacing={2}>
            {users.map((user) => (
            <Grid item xs={12} sm={6} key={user.id}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                  '&:hover': isSuperAdmin
                    ? {
                        boxShadow: (theme) =>
                          theme.palette.mode === 'light'
                            ? `0 6px 24px ${alpha(theme.palette.primary.main, 0.12)}`
                            : `0 6px 24px ${alpha(theme.palette.common.black, 0.35)}`,
                      }
                    : undefined,
                }}
              >
                <CardActionArea
                  onClick={() => handleOpenEdit(user)}
                  disabled={!isSuperAdmin}
                  sx={{ borderRadius: 1 }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ overflowWrap: 'break-word', minWidth: 0 }}>
                        {user.username}
                      </Typography>
                      {isSuperAdmin && <Edit fontSize="small" color="action" />}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, overflowWrap: 'break-word' }}>
                      {user.email || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'break-word' }}>
                      注册于 {new Date(user.created_at).toLocaleString('zh-CN')}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
          {users.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                暂无用户
              </Box>
            </Grid>
          )}
        </Grid>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>用户名</TableCell>
                <TableCell>邮箱</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>注册时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  hover
                  sx={{ position: 'relative', cursor: isSuperAdmin ? 'pointer' : 'default' }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ overflowWrap: 'break-word', minWidth: 0 }}>
                        {user.username}
                      </Typography>
                      {isSuperAdmin && <Edit fontSize="small" color="action" />}
                    </Box>
                  </TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '访客'}</TableCell>
                  <TableCell>{user.status === 1 ? '正常' : '禁用'}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                  {isSuperAdmin && (
                    <ButtonBase
                      onClick={() => handleOpenEdit(user)}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 0,
                        borderRadius: 0,
                        '&:hover': { bgcolor: 'transparent' },
                      }}
                    />
                  )}
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      暂无用户
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
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
      <Dialog open={!!editUser} onClose={handleCloseEdit} fullWidth maxWidth="sm" TransitionComponent={Grow} BackdropProps={{ 'aria-hidden': false }}>
        <DialogTitle>编辑用户信息</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 3, pt: 1 }}>
            <TextField
              label="用户名"
              value={editForm.username || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
              fullWidth
            />
            <TextField
              label="邮箱"
              type="email"
              value={editForm.email || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>角色</InputLabel>
              <Select
                value={editForm.role || 'guest'}
                label="角色"
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as string }))}
              >
                <MenuItem value="guest">访客</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="super_admin">超级管理员</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <Switch
                checked={!!editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.checked ? 1 : 0 }))}
              />
              <Typography variant="body2" sx={{ overflowWrap: 'break-word' }}>{editForm.status ? '账户正常' : '账户禁用'}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            color="error"
            startIcon={<Delete />}
            onClick={() => editUser && handleOpenDelete(editUser)}
            disabled={editSaving || String(editUser?.id) === currentUser?.id}
          >
            删除
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleCloseEdit} disabled={editSaving}>
              取消
            </Button>
            <Button variant="contained" startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? '保存中...' : '保存'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      <Dialog open={!!deleteUser} onClose={handleCloseDelete} fullWidth maxWidth="xs" TransitionComponent={Grow} BackdropProps={{ 'aria-hidden': false }}>
        <DialogTitle>确认删除用户</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            确定要删除用户 <strong>{deleteUser?.username}</strong> 吗？
            该用户的点赞、评论、登录令牌等关联数据将一并删除，此操作不可恢复。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
          <Button onClick={handleCloseDelete} disabled={deleteSaving}>
            取消
          </Button>
          <Button color="error" variant="contained" startIcon={deleteSaving ? <CircularProgress size={16} color="inherit" /> : <Delete />} onClick={handleConfirmDelete} disabled={deleteSaving}>
            {deleteSaving ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
    </Fade>
  );
}