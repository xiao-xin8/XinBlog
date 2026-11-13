import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link as LinkIcon } from '@mui/icons-material';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import { isContentAdmin } from '@/utils/permission';
import { useMessageWallEnabled } from '@/hooks/useMessageWallEnabled';
import { useChatEnabled } from '@/hooks/useChatEnabled';
import { builtinNavItems, type BuiltinNavItem } from '@/components/Frame/navItems';

/** 顶部栏使用的导航项：在内置项基础上可携带图标与自定义颜色 */
export interface TopNavItem {
  id: string;
  title: string;
  url: string;
  icon?: ReactNode;
  color?: string;
  openInNewTab?: boolean;
}

/** 内置导航项，按各功能开关过滤（与侧边栏保持一致） */
export function useBuiltinNavItems(): BuiltinNavItem[] {
  const { config } = useSiteStore();
  const { user } = useAuthStore();
  const messageWallEnabled = useMessageWallEnabled();
  const chatEnabled = useChatEnabled();
  // AI 助手入口仅「管理员/站主」可见，与侧边栏一致
  const agentEnabled = config.agentEnabled === true && isContentAdmin(user?.role);

  return useMemo(
    () =>
      builtinNavItems.filter((item) => {
        if (item.path === '/friends' && !config.friends?.enabled) return false;
        if (item.path === '/music' && !config.music?.showPage) return false;
        if (item.path === '/message-wall' && !messageWallEnabled) return false;
        if (item.path === '/chat' && !chatEnabled) return false;
        if (item.path === '/agent' && !agentEnabled) return false;
        return true;
      }),
    [config.friends?.enabled, config.music?.showPage, messageWallEnabled, chatEnabled, agentEnabled]
  );
}

/**
 * 顶部栏导航项：内置项（侧边栏那一套）+ 用户在后台添加的自定义导航项。
 * 自定义项追加在内置项之后。
 */
export function useTopNavItems(): TopNavItem[] {
  const builtin = useBuiltinNavItems();
  const { config } = useSiteStore();
  const custom = config.nav?.items;

  return useMemo(() => {
    const builtinItems: TopNavItem[] = builtin.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.path,
      icon: item.icon,
      openInNewTab: false,
    }));
    const customItems: TopNavItem[] = (custom || []).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      icon: <LinkIcon fontSize="small" />,
      color: item.color,
      openInNewTab: item.openInNewTab,
    }));
    return [...builtinItems, ...customItems];
  }, [builtin, custom]);
}
