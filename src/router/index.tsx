import { Suspense, lazy, useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/Frame/MainLayout';
import { AdminLayout } from '@/components/Admin/AdminLayout';
import { PageLoading } from '@/components/Common/Loading';
import { RouteErrorBoundary } from '@/components/Common/RouteErrorBoundary';
import { useAuthStore } from '@/stores/authStore';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const PostDetail = lazy(() => import('@/pages/PostDetail').then((m) => ({ default: m.PostDetail })));
const TagPage = lazy(() => import('@/pages/TagPage').then((m) => ({ default: m.TagPage })));
const About = lazy(() => import('@/pages/About').then((m) => ({ default: m.About })));
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })));
const AdminLogin = lazy(() => import('@/pages/admin/Login').then((m) => ({ default: m.AdminLogin })));
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
const AdminThemeSettings = lazy(() => import('@/pages/admin/ThemeSettings').then((m) => ({ default: m.AdminThemeSettings })));
const TermsEditor = lazy(() => import('@/pages/admin/TermsEditor').then((m) => ({ default: m.TermsEditor })));
const Friends = lazy(() => import('@/pages/Friends').then((m) => ({ default: m.Friends })));
const Terms = lazy(() => import('@/pages/Terms').then((m) => ({ default: m.Terms })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const MusicPage = lazy(() => import('@/pages/Music').then((m) => ({ default: m.MusicPage })));
const MessageWall = lazy(() => import('@/pages/MessageWall').then((m) => ({ default: m.default })));

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
      
      if (!isAuthenticated || !token || !user) {
        if (!cancelled) {
          setForbidden(false);
          setValid(false);
          setChecking(false);
        }
        return;
      }

      
      if (user.role !== 'super_admin') {
        if (!cancelled) {
          setForbidden(true);
          setValid(false);
          setChecking(false);
        }
        return;
      }

      
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

  
  if (checking) return <PageLoading />;

  
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
      { path: 'appearance', element: <SuspensePage><AdminAppearance /></SuspensePage> },
      { path: 'live2d', element: <SuspensePage><AdminLive2d /></SuspensePage> },
      { path: 'music', element: <SuspensePage><AdminMusic /></SuspensePage> },
      { path: 'advanced', element: <SuspensePage><AdminAdvancedSettings /></SuspensePage> },
      { path: 'comments', element: <SuspensePage><AdminComments /></SuspensePage> },
      { path: 'message-wall', element: <SuspensePage><AdminMessageWall /></SuspensePage> },
      { path: 'friends', element: <SuspensePage><AdminFriends /></SuspensePage> },
      { path: 'ai', element: <SuspensePage><AdminAi /></SuspensePage> },
      { path: 'themes', element: <SuspensePage><AdminThemeSettings /></SuspensePage> },
      { path: 'terms', element: <SuspensePage><TermsEditor /></SuspensePage> },
      { path: 'users', element: <SuspensePage><AdminSettings /></SuspensePage> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]);
