import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Grow,
} from '@mui/material';
import { Close, Image as ImageIcon } from '@mui/icons-material';
import { extractMediaId, deleteMedia } from '@/api/media';
import { useSnackbar } from 'notistack';

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxSize: number;
  hint?: string;
  acceptUrl?: boolean;
  showSizeSelect?: boolean;
  isMobileAdmin: boolean;
  onUpload: (file: File, targetSize: number, setter: (url: string) => void, label: string) => Promise<void>;
}


export function ImageField({
  label,
  value,
  onChange,
  maxSize,
  hint,
  acceptUrl,
  showSizeSelect = true,
  isMobileAdmin,
  onUpload,
}: ImageFieldProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [targetSize, setTargetSize] = useState(maxSize);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteMediaId, setPendingDeleteMediaId] = useState<number | null>(null);

  const sizeOptions = useMemo(() => {
    const options: number[] = [];
    for (let s = 100 * 1024; s <= maxSize; s += 100 * 1024) {
      options.push(s);
    }
    return options;
  }, [maxSize]);

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
        enqueueSnackbar('图片已从媒体库删除', { variant: 'success' });
      } catch {
        enqueueSnackbar('图片已从设置移除，但媒体库删除失败', { variant: 'warning' });
      }
    }
    setDeleteDialogOpen(false);
    setPendingDeleteMediaId(null);
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        {label}
      </Typography>
      {value ? (
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 1 }}>
          <Box
            component="img"
            src={value}
            alt={label}
            sx={{ width: { xs: 96, sm: 120 }, height: { xs: 96, sm: 120 }, objectFit: 'cover', borderRadius: 1 }}
          />
          <IconButton
            onClick={handleClear}
            sx={{ position: 'absolute', top: -8, right: -8, width: { xs: 36, sm: 32 }, height: { xs: 36, sm: 32 }, bgcolor: 'background.paper', boxShadow: 1 }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="outlined"
          component="label"
          size="small"
          startIcon={uploading ? <CircularProgress size={16} /> : <ImageIcon />}
          disabled={uploading}
          sx={{ flexShrink: 0 }}
        >
          {uploading ? '上传中...' : '上传图片'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              await onUpload(file, targetSize, onChange, label);
              setUploading(false);
              e.target.value = '';
            }}
          />
        </Button>
        {showSizeSelect && (
          <FormControl size="small" sx={{ minWidth: 120, flexShrink: 0 }}>
            <InputLabel id={`${label}-size-label`}>压缩目标</InputLabel>
            <Select
              labelId={`${label}-size-label`}
              value={targetSize}
              label="压缩目标"
              onChange={(e) => setTargetSize(Number(e.target.value))}
              disabled={uploading}
            >
              {sizeOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s >= 1024 ? `${Math.round(s / 1024)}KB` : `${s}B`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {acceptUrl && (
          <TextField
            size="small"
            placeholder="或输入图片 URL"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
          />
        )}
      </Box>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Grow}
        PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
        BackdropProps={{ 'aria-hidden': false }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>确认移除{label}？</DialogTitle>
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
