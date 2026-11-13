import { useState } from 'react';
import { Fab, Tooltip } from '@mui/material';
import { useAuthStore } from '@/stores/authStore';
import { isContentAdmin, isSuperAdmin } from '@/utils/permission';
import { AdminFrameModal } from './AdminFrameModal';

interface AdminFrameFabProps {
  /** 后台页面地址（同源），通常带 &embed=1 让后台隐藏侧边栏，例如 /admin/posts?compose=1&embed=1 */
  adminPath: string;
  /** 悬浮提示文字 */
  label: string;
  icon: React.ReactNode;
  /** 是否要求站主权限（默认管理员即可） */
  requireSuper?: boolean;
  /** 后台保存成功后触发，用于在前台刷新 */
  onSaved?: () => void;
  /** 同一页面多个 FAB 垂直堆叠时的底部偏移（px），默认 0 */
  bottomOffset?: number;
}

/**
 * 前台「就地管理」统一入口：右下角悬浮按钮，点击用 iframe 弹窗把后台对应页面载到当前页。
 * 仅管理员（或站主）可见，普通用户完全无感。所有按钮统一落在右下角，样式一致。
 */
export function AdminFrameFab({
  adminPath,
  label,
  icon,
  requireSuper,
  onSaved,
  bottomOffset = 0,
}: AdminFrameFabProps) {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = requireSuper ? isSuperAdmin(role) : isContentAdmin(role);
  const [open, setOpen] = useState(false);

  if (!allowed) return null;

  return (
    <>
      <Tooltip title={label} placement="left">
        <Fab
          color="primary"
          aria-label={label}
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', right: 24, bottom: 24 + bottomOffset, zIndex: (theme) => theme.zIndex.speedDial }}
        >
          {icon}
        </Fab>
      </Tooltip>
      <AdminFrameModal
        open={open}
        src={adminPath}
        onClose={() => setOpen(false)}
        onSaved={onSaved}
        title={label}
      />
    </>
  );
}
