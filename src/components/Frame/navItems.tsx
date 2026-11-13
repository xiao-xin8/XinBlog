import type { ReactNode } from 'react';
import {
  AccountCircle,
  ChatBubble,
  Forum,
  Home,
  Info,
  LocalOffer,
  MusicNote,
  People,
  SmartToy,
} from '@mui/icons-material';

/**
 * 内置导航项：侧边栏与顶部栏共用同一份数据源。
 * 注意：`path` 为站内路径，各功能开关的过滤逻辑见 useBuiltinNavItems。
 */
export interface BuiltinNavItem {
  id: string;
  title: string;
  path: string;
  icon: ReactNode;
}

export const builtinNavItems: BuiltinNavItem[] = [
  { id: 'nav-home', title: '首页', path: '/', icon: <Home fontSize="small" /> },
  { id: 'nav-tags', title: '标签', path: '/tag/all', icon: <LocalOffer fontSize="small" /> },
  { id: 'nav-message-wall', title: '留言墙', path: '/message-wall', icon: <Forum fontSize="small" /> },
  { id: 'nav-chat', title: '聊天室', path: '/chat', icon: <ChatBubble fontSize="small" /> },
  { id: 'nav-friends', title: '友链', path: '/friends', icon: <People fontSize="small" /> },
  { id: 'nav-about', title: '关于', path: '/about', icon: <Info fontSize="small" /> },
  { id: 'nav-profile', title: '个人中心', path: '/profile', icon: <AccountCircle fontSize="small" /> },
  { id: 'nav-music', title: '音乐', path: '/music', icon: <MusicNote fontSize="small" /> },
  { id: 'nav-agent', title: 'AI 助手', path: '/agent', icon: <SmartToy fontSize="small" /> },
];
