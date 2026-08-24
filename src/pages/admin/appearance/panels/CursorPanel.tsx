import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Slider,
  ButtonBase,
  alpha,
} from '@mui/material';
import { Check, Close, Add, DeleteOutlined, Storefront, Refresh, Mouse } from '@mui/icons-material';
import type { UserCursor } from '@/types';
import type { AppearanceEditor } from '../useAppearanceEditor';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';

function CursorStoreDialog({ editor }: { editor: AppearanceEditor }) {
  const { cursorStoreOpen, setCursorStoreOpen, cursorStoreLoading, storeCursors, userCursors, cursorActionLoading, handleAddCursor, handleOpenCursorStore } = editor;

  return (
    <Dialog
      open={cursorStoreOpen}
      onClose={() => setCursorStoreOpen(false)}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: '90vw' },
          height: { xs: '100vh', sm: '90vh' },
          maxWidth: { xs: '100vw', sm: '90vw' },
          maxHeight: { xs: '100vh', sm: '90vh' },
          borderRadius: { xs: 0, sm: 2 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 2,
        }}
      >
        鼠标商店
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton onClick={() => handleOpenCursorStore(true)} disabled={cursorStoreLoading}>
            <Refresh />
          </IconButton>

          <IconButton onClick={() => setCursorStoreOpen(false)}>
            <Close />
          </IconButton>

        </Box>

      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, overflowY: 'auto' }}>
        {cursorStoreLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>

        ) : storeCursors.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography>暂无可用鼠标</Typography>

          </Box>

        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
              gap: 2,
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            {storeCursors.map((cursor) => {
              const added = userCursors.some((c) => c.id === cursor.id);
              return (
                <Paper
                  key={cursor.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    height: '100%',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '2px solid',
                    borderColor: added ? 'primary.main' : 'transparent',
                    bgcolor: (theme) =>
                      added
                        ? alpha(theme.palette.primary.main, 0.06)
                        : alpha(theme.palette.primary.main, 0.02),
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '15 / 4',
                      borderRadius: 1,
                      mb: 1.5,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: `url("${cursor.preview}"), auto !important`,
                    }}
                  >
                    <Mouse sx={{ fontSize: 40, color: 'text.secondary' }} />
                  </Box>

                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    {cursor.name}
                  </Typography>

                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                    {cursor.files.length} 个光标文件
                  </Typography>

                  <Box sx={{ flex: 1 }} />
                  <Button
                    variant={added ? 'outlined' : 'contained'}
                    size="small"
                    fullWidth
                    startIcon={added ? <Check /> : <Add />}
                    disabled={added || cursorActionLoading}
                    onClick={() => handleAddCursor(cursor)}
                    sx={{ borderRadius: 1 }}
                  >
                    {added ? '已添加' : '添加'}
                  </Button>

                </Paper>

              );
            })}
          </Box>

        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => setCursorStoreOpen(false)} sx={{ borderRadius: 1 }}>
          关闭
        </Button>

      </DialogActions>

    </Dialog>

  );
}

function CursorConfirmDialog({ editor }: { editor: AppearanceEditor }) {
  const { cursorConfirmDialog, setCursorConfirmDialog, handleConfirmCursorAction, cursorActionLoading } = editor;
  const { open, type, cursor } = cursorConfirmDialog;
  const isAdd = type === 'add';
  const title = isAdd ? '确认添加鼠标？' : '确认移除鼠标？';
  const content = isAdd
    ? `确定要将“${cursor?.name}”添加到你的鼠标库吗？`
    : `确定要移除“${cursor?.name}”吗？移除后该鼠标将从你的鼠标库中消失。`;
  const confirmText = isAdd ? '确认添加' : '确认删除';

  return (
    <ConfirmDialog
      open={open}
      title={title}
      content={content}
      confirmText={confirmText}
      confirmColor={isAdd ? 'primary' : 'error'}
      loading={cursorActionLoading}
      onClose={() => setCursorConfirmDialog((prev) => ({ ...prev, open: false }))}
      onConfirm={handleConfirmCursorAction}
    />
  );
}

function CursorCard({
  cursor,
  selected,
  disabled,
  onActivate,
  onRemove,
}: {
  cursor: UserCursor;
  selected: boolean;
  disabled: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  return (
    <ButtonBase
      onClick={onActivate}
      sx={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'block',
        textAlign: 'left',
        borderRadius: 1,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 1,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          border: '2px solid',
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: (theme) =>
            selected
              ? alpha(theme.palette.primary.main, 0.08)
              : alpha(theme.palette.primary.main, 0.02),
          position: 'relative',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
        }}
      >
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <Check sx={{ fontSize: 14 }} />
          </Box>

        )}
        <IconButton
          size="small"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'background.paper',
            boxShadow: 1,
            width: 24,
            height: 24,
          }}
        >
          <DeleteOutlined sx={{ fontSize: 16, color: 'error.main' }} />
        </IconButton>

        <Box
          sx={{
            width: '100%',
            aspectRatio: '15 / 4',
            borderRadius: 1,
            mb: 1.5,
            bgcolor: 'action.hover',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: `url("${cursor.preview}"), auto !important`,
          }}
        >
          <Mouse sx={{ fontSize: 40, color: 'text.secondary' }} />
        </Box>

        <Typography variant="subtitle2" fontWeight={700}>
          {cursor.name}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {selected ? '当前使用' : '点击启用'}
        </Typography>

      </Paper>

    </ButtonBase>

  );
}

export function CursorPanel({ editor }: { editor: AppearanceEditor }) {
  const {
    userCursors,
    activeCursorId,
    cursorActionLoading,
    handleResetSystemCursor,
    handleOpenCursorStore,
    cursorSize,
    setCursorSize,
    previewCursorUrl,
  } = editor;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            我的鼠标
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {activeCursorId && (
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                disabled={cursorActionLoading}
                onClick={handleResetSystemCursor}
                sx={{ borderRadius: 1 }}
              >
                恢复系统默认
              </Button>

            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<Storefront />}
              onClick={() => {
                handleOpenCursorStore();
              }}
              sx={{ borderRadius: 1 }}
            >
              进入鼠标商店
            </Button>

          </Box>

        </Box>


        <Alert severity="info" sx={{ borderRadius: 1 }}>
          鼠标资源下载需要一定时间，若更新有延时请稍等片刻。
        </Alert>


        {userCursors.length === 0 ? (
          <Box
            sx={{
              p: 4,
              borderRadius: 1,
              textAlign: 'center',
              bgcolor: 'action.hover',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1" sx={{ mb: 1 }}>
              还没有添加鼠标
            </Typography>

            <Typography variant="body2" sx={{ mb: 2 }}>
              去鼠标商店挑选一款喜欢的鼠标吧
            </Typography>

            <Button
              variant="outlined"
              size="small"
              startIcon={<Storefront />}
              onClick={() => {
                handleOpenCursorStore();
              }}
              sx={{ borderRadius: 1 }}
            >
              进入鼠标商店
            </Button>

          </Box>

        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 2,
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            {userCursors.map((cursor) => {
              const selected = activeCursorId === cursor.id;
              return (
                <CursorCard
                  key={cursor.id}
                  cursor={cursor}
                  selected={selected}
                  disabled={cursorActionLoading}
                  onActivate={() => editor.handleActivateCursor(cursor.id)}
                  onRemove={() => editor.handleRemoveCursor(cursor.id)}
                />
              );
            })}
          </Box>

        )}

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              光标大小
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {cursorSize}px
            </Typography>

          </Box>

          <Slider
            value={cursorSize}
            onChange={(_, v) => setCursorSize(v as number)}
            min={16}
            max={64}
            step={2}
            marks={[
              { value: 16, label: '16' },
              { value: 32, label: '32' },
              { value: 48, label: '48' },
              { value: 64, label: '64' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>


        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            实时预览
          </Typography>

          <Box
            sx={{
              width: '100%',
              height: 80,
              borderRadius: 1,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: previewCursorUrl ? `url("${previewCursorUrl}"), auto !important` : 'auto',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              将鼠标移入此区域查看效果
            </Typography>

          </Box>

        </Box>

      </Stack>


      <CursorStoreDialog editor={editor} />
      <CursorConfirmDialog editor={editor} />
    </Paper>

  );
}
