import { memo, useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grow,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { AgentDialog } from '@/hooks/useAgentChat';

interface AgentConversationListProps {
  dialogs: AgentDialog[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<boolean>;
  onRename: (id: string, title: string) => void;
}

interface MenuState {
  mouseX: number;
  mouseY: number;
  id: string;
}

const LONG_PRESS_MS = 500;

function lastPreview(d: AgentDialog): string {
  const last = d.messages[d.messages.length - 1];
  if (!last) return '开始新的对话';
  if (!last.content) return last.role === 'user' ? last.content : '正在思考…';
  return last.content.replace(/\s+/g, ' ').slice(0, 40);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// 重命名对话框（复用项目 MUI 弹窗风格，与 ConfirmDialog 一致的圆角）
function RenameDialog({
  open,
  title,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [value, setValue] = useState(title);

  useEffect(() => {
    if (open) setValue(title);
  }, [open, title]);

  const trimmed = value.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      TransitionComponent={Grow}
      PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>重命名对话</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="请输入对话名称"
          inputProps={{ maxLength: 60 }}
          size="small"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (trimmed) onConfirm(trimmed);
            }
          }}
        />
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
          <Button onClick={onClose} color="inherit" fullWidth={isMobile} sx={{ textTransform: 'none', borderRadius: 2 }}>
            取消
          </Button>
          <Button
            onClick={() => trimmed && onConfirm(trimmed)}
            variant="contained"
            disabled={!trimmed}
            fullWidth={isMobile}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            保存
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

/**
 * 对话列表（AI 助手 /agent 列表页）。
 * - 单击项目进入该对话。
 * - 删除/重命名不再放可见按钮：以「右键（桌面）」或「长按（触屏）」唤出上下文菜单，拦截右键默认菜单。
 * - 删除需经 ConfirmDialog（项目弹窗组件）二次确认。
 */
export function AgentConversationList({ dialogs, onSelect, onCreate, onDelete, onRename }: AgentConversationListProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renameTarget, setRenameTarget] = useState<AgentDialog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentDialog | null>(null);
  // 删除等待与失败态：确认后转圈等待云端返回，成功才移除；失败保留并提示
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(false);
    const ok = await onDelete(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setDeleteTarget(null);
    } else {
      setDeleteError(true);
    }
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openContextMenu = (e: React.MouseEvent, d: AgentDialog) => {
    e.preventDefault();
    clearLongPress();
    setMenu({ mouseX: e.clientX - 2, mouseY: e.clientY - 6, id: d.id });
  };

  // 触屏长按唤出菜单；e.pointerType 为 mouse 时交给右键处理，避免长按鼠标误触
  const handlePointerDown = (e: React.PointerEvent, d: AgentDialog) => {
    if (e.pointerType === 'mouse') return;
    suppressClickRef.current = false;
    clearLongPress();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      setMenu({ mouseX: rect.left, mouseY: rect.bottom + 6, id: d.id });
    }, LONG_PRESS_MS);
  };

  const handleClick = (d: AgentDialog) => {
    clearLongPress();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(d.id);
  };

  const closeMenu = () => setMenu(null);

  const startRename = () => {
    const target = menu ? dialogs.find((d) => d.id === menu.id) : null;
    closeMenu();
    if (target) setRenameTarget(target);
  };

  const startDelete = () => {
    const target = menu ? dialogs.find((d) => d.id === menu.id) : null;
    closeMenu();
    if (target) setDeleteTarget(target);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 头部 */}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <SmartToyIcon color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
            我的对话
          </Typography>
          <Chip size="small" color="primary" label={dialogs.length} variant="outlined" sx={{ flexShrink: 0 }} />
        </Box>
        <IconButton
          size="small"
          color="primary"
          title="新建对话"
          onClick={onCreate}
          sx={{
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.18) },
          }}
        >
          <AddIcon sx={{ fontSize: 22 }} />
        </IconButton>
      </Box>
      <Divider />

      {/* 列表 */}
      {dialogs.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 6 }}>
          <SmartToyIcon sx={{ fontSize: 44, opacity: 0.25 }} />
          <Typography variant="body2" color="text.secondary">
            还没有对话，点击右上角新建一个吧
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {dialogs.map((d) => {
            const preview = lastPreview(d);
            return (
              <ListItemButton
                key={d.id}
                onClick={() => handleClick(d)}
                onContextMenu={(e) => openContextMenu(e, d)}
                onPointerDown={(e) => handlePointerDown(e, d)}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.7),
                  border: (t) => `1px solid ${alpha(t.palette.divider, 0.7)}`,
                  boxShadow: 'none',
                  transition: 'transform .15s ease, box-shadow .2s ease, border-color .2s ease, background-color .2s ease',
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                    borderColor: (t) => alpha(t.palette.primary.main, 0.35),
                    boxShadow: (t) => `0 4px 16px ${alpha(t.palette.primary.main, 0.1)}`,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {/* 会话图标：明显突出 */}
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: (t) =>
                      `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.16)}, ${alpha(t.palette.secondary.main, 0.12)})`,
                    color: 'primary.main',
                  }}
                >
                  <SmartToyIcon sx={{ fontSize: 26 }} />
                </Box>

                <ListItemText
                  sx={{ minWidth: 0, flex: 1 }}
                  primary={d.title}
                  secondary={preview}
                  primaryTypographyProps={{
                    variant: 'subtitle2',
                    fontWeight: 700,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    noWrap: true,
                    color: 'text.secondary',
                    mt: 0.25,
                  }}
                />

                <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                    {formatTime(d.updatedAt)}
                  </Typography>
                  {/* 消息数徽标 */}
                  <Box
                    sx={{
                      minWidth: 20,
                      height: 20,
                      px: 0.75,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                      color: 'primary.main',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1 }}>
                      {d.messages.length}
                    </Typography>
                  </Box>
                </Box>
              </ListItemButton>
            );
          })}
        </Box>
      )}

      {/* 右键/长按上下文菜单 */}
      <Menu
        open={menu !== null}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.mouseY, left: menu.mouseX } : undefined}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160 } } }}
      >
        <MenuItem onClick={startRename} sx={{ py: 0.75 }}>
          <ListItemIcon>
            <DriveFileRenameOutlineIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          重命名
        </MenuItem>
        <MenuItem onClick={startDelete} sx={{ py: 0.75, color: 'error.main' }}>
          <ListItemIcon>
            <DeleteOutlineIcon sx={{ fontSize: 20, color: 'error.main' }} />
          </ListItemIcon>
          删除
        </MenuItem>
      </Menu>

      {/* 重命名 */}
      <RenameDialog
        open={renameTarget !== null}
        title={renameTarget?.title ?? ''}
        onClose={() => setRenameTarget(null)}
        onConfirm={(value) => {
          if (renameTarget) onRename(renameTarget.id, value);
          setRenameTarget(null);
        }}
      />

      {/* 删除确认：loading 期间转圈等待云端删除，成功才移除列表；失败留在原地提示 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除对话"
        content={
          <>
            确定要删除「{deleteTarget?.title}」吗？删除后无法恢复。
            {deleteError && (
              <Typography component="span" color="error" sx={{ display: 'block', mt: 1 }}>
                删除失败，请稍后重试。
              </Typography>
            )}
          </>
        }
        confirmText="删除"
        confirmColor="error"
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
}

export const MemoAgentConversationList = memo(AgentConversationList);