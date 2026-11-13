/* eslint-disable react-refresh/only-export-components */
// 路由配置文件：需要导出 router 对象以及内部使用的 SuspensePage/RequireAuth 组件，
// 按 fast refresh 规则拆分文件收益有限，因此关闭该规则。
import { Suspense, lazy, useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/Frame/MainLayout';
import { AdminLayout } from '@/components/Admin/AdminLayout';
import { PageLoading } from '@/components/Common/Loading';
import { RouteErrorBoundary } from '@/components/Common/RouteErrorBoundary';
import { useAuthStore } from '@/stores/authStore';
import { isContentAdmin, isSuperAdmin } from '@/utils/permission';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const PostDetail = lazy(() => import('@/pages/PostDetail').then((m) => ({ default: m.PostDetail })));
const TagPage = lazy(() => import('@/pages/TagPage').then((m) => ({ default: m.TagPage })));
const About = lazy(() => import('@/pages/About').then((m) => ({ default: m.About })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));
const AdminLogin = lazy(() => import('@/pages/admin/Login').then((m) => ({ default: m.AdminLogin })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminAppearance = lazy(() => import('@/pages/admin/Appearance').then((m) => ({ default: m.AdminAppearance })));
const AdminForbidden = lazy(() => import('@/pages/admin/Forbidden').then((m) => ({ default: m.AdminForbidden })));
const AdminPosts = lazy(() => import('@/pages/admin/Posts').then((m) => ({ default: m.AdminPosts })));
const AdminTags = lazy(() => import('@/pages/admin/Tags').then((m) => ({ default: m.AdminTags })));
const AdminMedia = lazy(() => import('@/pages/admin/Media').then((m) => ({ default: m.AdminMedia })));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })));
const AdminLive2d = lazy(() => import('@/pages/admin/Live2d').then((m) => ({ default: m.AdminLive2d })));
const AdminMusic = lazy(() => import('@/pages/admin/Music').then((m) => ({ default: m.AdminMusic })));
const AdminAdvancedSettings = lazy(() => import('@/pages/admin/AdvancedSettings').then((m) => ({ default: m.AdvancedSettings })));
const AdminComments = lazy(() => import('@/pages/admin/Comments').then((m) => ({ default: m.AdminComments })));
const AdminFriends = lazy(() => import('@/pages/admin/Friends').then((m) => ({ default: m.AdminFriends })));
const AdminAi = lazy(() => import('@/pages/admin/Ai').then((m) => ({ default: m.Ai })));
const AdminMessageWall = lazy(() => import('@/pages/admin/MessageWall').then((m) => ({ default: m.AdminMessageWall })));
const AdminChat = lazy(() => import('@/pages/admin/Chat').then((m) => ({ default: m.AdminChat })));
const AdminThemeSettings = lazy(() => import('@/pages/admin/ThemeSettings').then((m) => ({ default: m.AdminThemeSettings })));
const TermsEditor = lazy(() => import('@/pages/admin/TermsEditor').then((m) => ({ default: m.TermsEditor })));
const Friends = lazy(() => import('@/pages/Friends').then((m) => ({ default: m.Friends })));
const Terms = lazy(() => import('@/pages/Terms').then((m) => ({ default: m.Terms })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const MusicPage = lazy(() => import('@/pages/Music').then((m) => ({ default: m.MusicPage })));
const MessageWall = lazy(() => import('@/pages/MessageWall').then((m) => ({ default: m.default })));
const Chat = lazy(() => import('@/pages/Chat').then((m) => ({ default: m.default })));
const ChatRoom = lazy(() => import('@/pages/ChatRoom').then((m) => ({ default: m.default })));
const Agent = lazy(() => import('@/pages/Agent').then((m) => ({ default: m.default })));
const AgentChat = lazy(() => import('@/pages/AgentChat').then((m) => ({ default: m.default })));

function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const refresh = useAuthStore((state) => state.refresh);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      // 未登录直接跳转登录页
      if (!isAuthenticated || !token || !user) {
        if (!cancelled) {
          setForbidden(false);
          setValid(false);
          setChecking(false);
        }
        return;
      }

      // 已登录但无后台权限（既非管理员也非站主）：显示无权访问
      if (!isContentAdmin(user.role)) {
        if (!cancelled) {
          setForbidden(true);
          setValid(false);
          setChecking(false);
        }
        return;
      }

      // token 距离过期还有 60 秒以上，直接放行
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp > now + 60) {
          if (!cancelled) {
            setForbidden(false);
            setValid(true);
            setChecking(false);
          }
          return;
        }
      } catch {
        if (!cancelled) {
          setForbidden(false);
          setValid(false);
          setChecking(false);
        }
        return;
      }

      // token 已过期或即将过期，尝试静默刷新
      const ok = await refresh();
      if (!cancelled) {
        setForbidden(false);
        setValid(ok);
        setChecking(false);
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token, user, refresh]);

  // 校验过程中显示加载动画，避免白屏
  if (checking) return <PageLoading />;

  // 已登录但无权限：渲染友好提示页，不跳转
  if (forbidden) {
    return (
      <SuspensePage>
        <AdminForbidden />
      </SuspensePage>
    );
  }

  if (!valid) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// 站主专属页面守卫：非 super_admin 一律显示无权访问
function RequireSuper({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!user || !isSuperAdmin(user.role)) {
    return (
      <SuspensePage>
        <AdminForbidden />
      </SuspensePage>
    );
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <MainLayout>
        <Outlet />
      </MainLayout>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <SuspensePage><Home /></SuspensePage> },
      { path: 'post/:slug', element: <SuspensePage><PostDetail /></SuspensePage> },
      { path: 'tag/:slug', element: <SuspensePage><TagPage /></SuspensePage> },
      { path: 'about', element: <SuspensePage><About /></SuspensePage> },
      { path: 'friends', element: <SuspensePage><Friends /></SuspensePage> },
      { path: 'profile', element: <SuspensePage><Profile /></SuspensePage> },
      { path: 'music', element: <SuspensePage><MusicPage /></SuspensePage> },
      { path: 'message-wall', element: <SuspensePage><MessageWall /></SuspensePage> },
      { path: 'chat', element: <SuspensePage><Chat /></SuspensePage> },
      { path: 'chat/:roomKey', element: <SuspensePage><ChatRoom /></SuspensePage> },
      { path: 'agent', element: <RequireAuth><SuspensePage><Agent /></SuspensePage></RequireAuth> },
      { path: 'agent/:dialogId', element: <RequireAuth><SuspensePage><AgentChat /></SuspensePage></RequireAuth> },
      { path: 'agreement', element: <SuspensePage><Terms /></SuspensePage> },
      { path: 'privacy', element: <SuspensePage><Terms /></SuspensePage> },
      { path: '404', element: <SuspensePage><NotFound /></SuspensePage> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
  {
    path: '/admin/login',
    element: <SuspensePage><AdminLogin /></SuspensePage>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/forgot-password',
    element: <SuspensePage><ForgotPassword /></SuspensePage>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <SuspensePage><AdminDashboard /></SuspensePage> },
      { path: 'posts', element: <SuspensePage><AdminPosts /></SuspensePage> },
      { path: 'tags', element: <SuspensePage><AdminTags /></SuspensePage> },
      { path: 'media', element: <SuspensePage><AdminMedia /></SuspensePage> },
      { path: 'appearance', element: <SuspensePage><RequireSuper><AdminAppearance /></RequireSuper></SuspensePage> },
      { path: 'live2d', element: <SuspensePage><RequireSuper><AdminLive2d /></RequireSuper></SuspensePage> },
      { path: 'music', element: <SuspensePage><RequireSuper><AdminMusic /></RequireSuper></SuspensePage> },
      { path: 'advanced', element: <SuspensePage><RequireSuper><AdminAdvancedSettings /></RequireSuper></SuspensePage> },
      { path: 'comments', element: <SuspensePage><AdminComments /></SuspensePage> },
      { path: 'message-wall', element: <SuspensePage><AdminMessageWall /></SuspensePage> },
      { path: 'chat', element: <SuspensePage><RequireSuper><AdminChat /></RequireSuper></SuspensePage> },
      { path: 'friends', element: <SuspensePage><AdminFriends /></SuspensePage> },
      { path: 'ai', element: <SuspensePage><RequireSuper><AdminAi /></RequireSuper></SuspensePage> },
      { path: 'themes', element: <SuspensePage><RequireSuper><AdminThemeSettings /></RequireSuper></SuspensePage> },
      { path: 'terms', element: <SuspensePage><RequireSuper><TermsEditor /></RequireSuper></SuspensePage> },
      { path: 'users', element: <SuspensePage><RequireSuper><AdminSettings /></RequireSuper></SuspensePage> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);
