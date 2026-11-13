import { useCallback } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AgentConversationList } from '@/components/Agent/AgentConversationList';
import { useAgentDialogs } from '@/hooks/useAgentChat';
import { useSiteStore } from '@/stores/siteStore';
import { AdminFrameFab } from '@/components/Admin/AdminFrameFab';

/**
 * AI 助手对话列表页。
 * 整个页面即对话列表（作为页面背景填满），每条对话是一张明显的卡片。
 * 采用与聊天室一致的两级结构：
 *   - /agent            对话列表
 *   - /agent/:dialogId  具体对话（沉浸式，左上角返回）
 * 删除/重命名通过列表项的右键或长按唤出菜单操作。
 */
export default function Agent() {
  const navigate = useNavigate();
  const site = useSiteStore();
  const { dialogs, createDialog, renameDialog, deleteDialog } = useAgentDialogs(false);

  const handleCreate = useCallback(() => {
    const id = createDialog();
    navigate(`/agent/${id}`);
  }, [createDialog, navigate]);

  const handleSelect = useCallback((id: string) => navigate(`/agent/${id}`), [navigate]);

  if (!site.loaded) {
    return (
      <Box sx={{ height: '100%', p: 3 }}>
        <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2, mb: 1.5 }} />
        <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2, mb: 1.5 }} />
        <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (site.config.agentEnabled !== true) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          AI 助手功能暂未开放，请先在后台开启后刷新。
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%' }}>
      <AgentConversationList
        dialogs={dialogs}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={deleteDialog}
        onRename={renameDialog}
      />
      {/* 管理员「管理AI」：右下角悬浮按钮，iframe 弹窗直接载后台（仅站主） */}
      <AdminFrameFab adminPath="/admin/ai?embed=1" label="管理AI" icon={<SmartToy />} requireSuper />
    </Box>
  );
}