import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Slider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  alpha,
  Fade,
  Grow,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  Delete,
  Compress,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { fetchAdminMedia, fetchAdminMediaDetail, updateAdminMedia } from '@/api/admin';
import { deleteMedia, getMediaUrl, extractMediaId } from '@/api/media';
import { Loading } from '@/components/Common/Loading';
import { LazyImage } from '@/components/Common/LazyImage';
import { useSiteStore } from '@/stores/siteStore';
import type { AdminMedia, AdminMediaBinding, AdminMediaDetail } from '@/api/admin';
import type { SiteConfig } from '@/types';



function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

import { getBase64Size, compressImageSource } from '@/utils/image';

function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((o, key) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function verifyBindings(bindings: AdminMediaBinding[], siteConfig: SiteConfig, mediaId: number): AdminMediaBinding[] {
  return bindings.filter((b) => {
    if (b.type === 'site') {
      const value = getValueByPath(siteConfig, b.key || '');
      if (typeof value === 'string') {
        const configMediaId = extractMediaId(value);
        return configMediaId === mediaId;
      }
      return false;
    }
    if (b.type === 'post') return Boolean(b.id) && Boolean(b.title);
    if (b.type === 'friend') return Boolean(b.id) || Boolean(b.name);
    if (b.type === 'user') return Boolean(b.id) || Boolean(b.name);
    return true;
  });
}

function BindingList({ bindings }: { bindings: AdminMediaBinding[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, AdminMediaBinding[]> = {};
    for (const b of bindings) {
      if (!map[b.type]) map[b.type] = [];
      map[b.type].push(b);
    }
    return map;
  }, [bindings]);

  if (bindings.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        无绑定对象
      </Typography>
    );
  }

  const typeLabel: Record<string, string> = {
    post: '文章',
    user: '用户',
    friend: '友链',
    site: '站点设置',
  };

  return (
    <Stack spacing={1.5}>
      {Object.entries(grouped).map(([type, list]) => (
        <Box key={type}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {typeLabel[type] || type}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {list.map((b, idx) => {
              const label = b.title || b.name || b.key || `ID ${b.id}`;
              return (
                <Chip
                  key={`${type}-${b.id ?? b.key ?? idx}`}
                  label={label}
                  size="small"
                  sx={{ borderRadius: 1 }}
                />
              );
            })}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

export function AdminMedia() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const site = useSiteStore();

  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AdminMediaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminMedia | null>(null);
  const [deleteBindings, setDeleteBindings] = useState<AdminMediaBinding[]>([]);
  const [deleteBindingsLoading, setDeleteBindingsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [compressingId, setCompressingId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Map<number, AdminMediaDetail>>(new Map());

  const [compressOpen, setCompressOpen] = useState(false);
  const [compressTarget, setCompressTarget] = useState<AdminMedia | null>(null);
  const [compressMaxDim, setCompressMaxDim] = useState(1920);
  const [compressMaxSize, setCompressMaxSize] = useState(500);
  const [compressMinQuality, setCompressMinQuality] = useState(0.4);
  const [compressingOptions, setCompressingOptions] = useState(false);

  const verifiedBindings = useMemo(() => {
    if (!detail) return [];
    return verifyBindings(detail.bindings, site.config, detail.id);
  }, [detail, site.config]);

  const loadData = async (targetPage = page + 1, limit = rowsPerPage) => {
    setLoading(true);
    const res = await fetchAdminMedia(targetPage, limit);
    if (res) {
      setMedia(res.list);
      setTotal(res.total);
    } else {
      enqueueSnackbar('加载媒体列表失败', { variant: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(page + 1, rowsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleOpenDetail = async (item: AdminMedia, force = false) => {
    setDetailOpen(true);
    if (!force) {
      const cached = detailCache.get(item.id);
      if (cached) {
        setDetail(cached);
        setDetailLoading(false);
        return;
      }
    }
    setDetailLoading(true);
    const res = await fetchAdminMediaDetail(item.id);
    setDetailLoading(false);
    if (res) {
      setDetail(res);
      setDetailCache((prev) => new Map(prev).set(item.id, res));
    } else {
      enqueueSnackbar('加载媒体详情失败', { variant: 'error' });
      setDetailOpen(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetail(null);
  };

  const handleOpenDelete = async (item: AdminMedia) => {
    setDeleteTarget(item);
    setDeleteBindings([]);
    if (detail && detail.id === item.id) {
      setDeleteBindings(detail.bindings);
      return;
    }
    setDeleteBindingsLoading(true);
    const res = await fetchAdminMediaDetail(item.id);
    setDeleteBindingsLoading(false);
    if (res) {
      setDeleteBindings(res.bindings);
    }
  };

  const handleCloseDelete = () => {
    setDeleteTarget(null);
    setDeleteBindings([]);
  };

  const handleOpenCompress = (item: AdminMedia) => {
    setCompressTarget(item);
    setCompressMaxDim(1920);
    setCompressMaxSize(500);
    setCompressMinQuality(0.4);
    setCompressOpen(true);
  };

  const handleCloseCompress = () => {
    setCompressOpen(false);
    setCompressTarget(null);
  };

  const handleConfirmCompress = async () => {
    if (!compressTarget) return;
    const item = compressTarget;
    setCompressingOptions(true);
    setCompressingId(item.id);
    handleCloseCompress();
    try {
      const src = getMediaUrl(item.id);
      const base64 = await compressImageSource(src, {
        maxSize: compressMaxSize * 1024,
        maxDim: compressMaxDim,
        minQuality: compressMinQuality,
      });
      if (getBase64Size(base64) > compressMaxSize * 1024) {
        enqueueSnackbar('按当前参数压缩后仍超过目标大小，请提高压缩强度后再试', { variant: 'warning' });
        return;
      }
      const res = await updateAdminMedia(item.id, {
        base64,
        mimeType: 'image/jpeg',
        name: item.name.replace(/\.[^.]+$/, '.jpg'),
      });
      if (res.msg) {
        enqueueSnackbar(res.msg, { variant: 'error' });
      } else {
        enqueueSnackbar(
          `压缩成功：${formatBytes(item.size)} → ${formatBytes(res.data?.size || 0)}`,
          { variant: 'success' }
        );
        setDetailCache((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        });
        loadData(page + 1, rowsPerPage);
        if (detail && detail.id === item.id) {
          handleOpenDetail(item, true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '压缩失败';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setCompressingId(null);
      setCompressingOptions(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteMedia(deleteTarget.id);
    setDeleting(false);
    handleCloseDelete();
    if (ok) {
      enqueueSnackbar('媒体已删除', { variant: 'success' });
      loadData(page + 1, rowsPerPage);
      if (detail && detail.id === deleteTarget.id) {
        handleCloseDetail();
      }
    } else {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  };

  const paperShadow = {
    boxShadow: (t: typeof theme) =>
      t.palette.mode === 'light'
        ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
        : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
  };

  const renderPreview = (item: AdminMedia, size: number) => (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
        flexShrink: 0,
      }}
    >
      <LazyImage
        src={getMediaUrl(item.id)}
        alt={item.name}
        objectFit="cover"
        placeholder="skeleton"
        style={{ borderRadius: 0 }}
      />
    </Box>
  );

  const renderMobileList = () => (
    <Grid container spacing={2}>
      {media.map((item) => (
        <Grid item xs={12} sm={6} key={item.id}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 1,
              ...paperShadow,
            }}
          >
            <CardActionArea
              onClick={() => handleOpenDetail(item)}
              sx={{ borderRadius: 1 }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  {renderPreview(item, 72)}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {formatBytes(item.size)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.width && item.height ? `${item.width} × ${item.height}` : '未知尺寸'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); handleOpenCompress(item); }}
                    disabled={compressingId === item.id}
                    sx={{ width: 40, height: 40 }}
                  >
                    {compressingId === item.id ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Compress fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={(e) => { e.stopPropagation(); handleOpenDelete(item); }}
                    sx={{ width: 40, height: 40 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
      {media.length === 0 && (
        <Grid item xs={12}>
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            暂无媒体文件
          </Box>
        </Grid>
      )}
    </Grid>
  );

  const renderDesktopTable = () => (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        ...paperShadow,
      }}
    >
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>预览</TableCell>
              <TableCell>文件名</TableCell>
              <TableCell>大小</TableCell>
              <TableCell>尺寸</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>上传时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {media.map((item) => (
              <TableRow key={item.id} hover sx={{ position: 'relative' }}>
                <TableCell sx={{ width: 80 }}>
                  {renderPreview(item, 56)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                    {item.name}
                  </Typography>
                </TableCell>
                <TableCell>{formatBytes(item.size)}</TableCell>
                <TableCell>
                  {item.width && item.height ? `${item.width} × ${item.height}` : '-'}
                </TableCell>
                <TableCell>{item.mime_type}</TableCell>
                <TableCell>{new Date(item.created_at).toLocaleDateString('zh-CN')}</TableCell>
                <TableCell align="right">
                  <IconButton
                    onClick={(e) => { e.stopPropagation(); handleOpenCompress(item); }}
                    disabled={compressingId === item.id}
                    sx={{ width: 40, height: 40, position: 'relative', zIndex: 1 }}
                  >
                    {compressingId === item.id ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Compress fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={(e) => { e.stopPropagation(); handleOpenDelete(item); }}
                    sx={{ width: 40, height: 40, position: 'relative', zIndex: 1 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
                <ButtonBase
                  onClick={() => handleOpenDetail(item)}
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
              </TableRow>
            ))}
            {media.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无媒体文件
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
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
  );

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, minWidth: 0 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
              媒体管理
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
              查看、压缩和删除媒体文件
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Loading text="加载媒体中..." />
        ) : (
          <Fade in timeout={400}>
            <Box>
              {isMobileAdmin ? renderMobileList() : renderDesktopTable()}
            </Box>
          </Fade>
        )}

        {/* 详情弹窗 */}
        <Dialog
          open={detailOpen}
          onClose={handleCloseDetail}
          fullWidth
          maxWidth="sm"
          TransitionComponent={Grow}
          PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
          BackdropProps={{ 'aria-hidden': false }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>媒体详情</DialogTitle>
          <DialogContent sx={{ minHeight: { xs: 360, sm: 480 } }}>
            {detailLoading || !detail ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: { xs: 320, sm: 420 } }}>
                <CircularProgress />
              </Box>
            ) : (
              <Fade in timeout={400}>
                <Stack spacing={2}>
                  <Box
                    sx={{
                      width: '100%',
                      maxHeight: { xs: '55vh', sm: '65vh' },
                      borderRadius: 1,
                      overflow: 'auto',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                    }}
                  >
                    <LazyImage
                      src={getMediaUrl(detail.id)}
                      alt={detail.name}
                      objectFit="contain"
                      placeholder="skeleton"
                      style={{ height: 'auto', minHeight: 200 }}
                    />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">文件名</Typography>
                  <Typography variant="body2" sx={{ overflowWrap: 'break-word' }}>{detail.name}</Typography>

                  <Typography variant="body2" color="text.secondary">大小</Typography>
                  <Typography variant="body2">{formatBytes(detail.size)}</Typography>

                  <Typography variant="body2" color="text.secondary">尺寸</Typography>
                  <Typography variant="body2">
                    {detail.width && detail.height ? `${detail.width} × ${detail.height}` : '未知'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">类型</Typography>
                  <Typography variant="body2">{detail.mime_type}</Typography>

                  <Typography variant="body2" color="text.secondary">分片</Typography>
                  <Typography variant="body2">{detail.chunk_count > 0 ? `${detail.chunk_count} 片` : '无'}</Typography>

                  <Typography variant="body2" color="text.secondary">上传时间</Typography>
                  <Typography variant="body2">{new Date(detail.created_at).toLocaleString('zh-CN')}</Typography>

                  <Typography variant="body2" color="text.secondary">URL</Typography>
                  <Typography variant="body2" sx={{ overflowWrap: 'break-word' }}>{getMediaUrl(detail.id)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    绑定对象
                  </Typography>
                  <BindingList bindings={verifiedBindings} />
                </Box>
              </Stack>
              </Fade>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
              <Button onClick={handleCloseDetail} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
                关闭
              </Button>
              {detail && (
                <Button
                  variant="outlined"
                  startIcon={compressingId === detail.id ? <CircularProgress size={16} /> : <Compress />}
                  onClick={() => handleOpenCompress(detail as AdminMedia)}
                  disabled={compressingId === detail.id}
                  fullWidth={isMobileAdmin}
                  sx={{ borderRadius: 2 }}
                >
                  {compressingId === detail.id ? '压缩中...' : '压缩'}
                </Button>
              )}
              {detail && (
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<Delete />}
                  onClick={() => {
                    handleCloseDetail();
                    handleOpenDelete(detail as AdminMedia);
                  }}
                  fullWidth={isMobileAdmin}
                  sx={{ borderRadius: 2 }}
                >
                  删除
                </Button>
              )}
            </Box>
          </DialogActions>
        </Dialog>

        {/* 删除确认 */}
        <Dialog
          open={!!deleteTarget}
          onClose={handleCloseDelete}
          fullWidth
          maxWidth="xs"
          TransitionComponent={Grow}
          PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
          BackdropProps={{ 'aria-hidden': false }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>确认删除媒体？</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {deleteTarget?.name}
            </Typography>
            {deleteBindingsLoading ? (
              <Typography variant="body2" color="text.secondary">
                正在检查绑定对象...
              </Typography>
            ) : deleteBindings.length > 0 ? (
              <Typography variant="body2" color="warning.main">
                该媒体已被 {deleteBindings.length} 个对象引用，删除后可能影响已绑定的内容，是否继续？
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                删除后无法恢复，是否继续？
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
              <Button onClick={handleCloseDelete} disabled={deleting} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
                取消
              </Button>
              <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
                {deleting ? '删除中...' : '删除'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* 压缩选项 */}
        <Dialog
          open={compressOpen}
          onClose={handleCloseCompress}
          fullWidth
          maxWidth="xs"
          TransitionComponent={Grow}
          PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
          BackdropProps={{ 'aria-hidden': false }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>压缩图片</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {compressTarget?.name}
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">最大边长</Typography>
                  <Typography variant="body2" fontWeight={600}>{compressMaxDim}px</Typography>
                </Box>
                <Slider
                  value={compressMaxDim}
                  onChange={(_, v) => setCompressMaxDim(v as number)}
                  min={320}
                  max={1920}
                  step={80}
                  marks={[{ value: 320, label: '320' }, { value: 1920, label: '1920' }]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">目标大小</Typography>
                  <Typography variant="body2" fontWeight={600}>{compressMaxSize}KB</Typography>
                </Box>
                <Slider
                  value={compressMaxSize}
                  onChange={(_, v) => setCompressMaxSize(v as number)}
                  min={50}
                  max={1000}
                  step={50}
                  marks={[{ value: 50, label: '50' }, { value: 1000, label: '1M' }]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">最低质量</Typography>
                  <Typography variant="body2" fontWeight={600}>{Math.round(compressMinQuality * 100)}%</Typography>
                </Box>
                <Slider
                  value={compressMinQuality}
                  onChange={(_, v) => setCompressMinQuality(v as number)}
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  marks={[{ value: 0.1, label: '10%' }, { value: 0.9, label: '90%' }]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
              <Button onClick={handleCloseCompress} disabled={compressingOptions} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
                取消
              </Button>
              <Button variant="contained" onClick={handleConfirmCompress} disabled={compressingOptions} fullWidth={isMobileAdmin} sx={{ borderRadius: 2 }}>
                {compressingOptions ? '压缩中...' : '开始压缩'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
