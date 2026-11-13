import { useEffect } from 'react';
import { Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AdminFrameModalProps {
  open: boolean;
  /** 后台页面地址（同源），例如 /admin/posts?compose=1 或 /admin/posts?edit=<id> */
  src: string;
  onClose: () => void;
  /** 后台保存成功后（通过 postMessage 通知）触发，用于在前台刷新 */
  onSaved?: () => void;
  title?: string;
}

/**
 * 前台「就地管理」弹窗：用占屏 ~95% 的 iframe 把后台页面直接载到当前页，
 * 关掉即回到前台，避免跳转到后台再回来。仅作展示容器，权限由调用方把控。
 * 后台保存后调用 window.parent.postMessage({ type: 'admin-frame-saved' }, '*') 通知此处刷新。
 */
export function AdminFrameModal({ open, src, onClose, onSaved, title }: AdminFrameModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'admin-frame-saved') {
        onSaved?.();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open, onSaved]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '95vw',
          height: '95vh',
          maxWidth: 'none',
          maxHeight: 'none',
          m: 0,
          p: 0,
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      <IconButton
        onClick={onClose}
        aria-label="关闭"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          bgcolor: 'background.paper',
          boxShadow: 1,
        }}
      >
        <CloseIcon />
      </IconButton>
      {open && (
        <DialogContent sx={{ p: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
          <iframe
            src={src}
            title={title ?? '管理后台'}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
