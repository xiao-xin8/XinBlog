import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, Divider, Skeleton, Paper, alpha, Avatar, Fade } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CommentEditor from './CommentEditor';
import CommentList from './CommentList';
import { getComments } from '@/api/comments';
import { getInteractionSettings } from '@/api/interaction';
import { useAuthStore } from '@/stores/authStore';
import type { Comment, InteractionSettings, CommentListResponse } from '@/types/interaction';
interface CommentSectionProps {
  slug: string;
}
const PAGE_SIZE = 20;
const COMMENTS_CACHE_TTL = 2 * 60 * 1000; 
function getCommentsCacheKey(slug: string) {
  return `comments-cache-${slug}`;
}
function readCommentsCache(slug: string): CommentListResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getCommentsCacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || Date.now() - parsed.ts > COMMENTS_CACHE_TTL) {
      localStorage.removeItem(getCommentsCacheKey(slug));
      return null;
    }
    return parsed.data as CommentListResponse;
  } catch {
    return null;
  }
}
function writeCommentsCache(slug: string, data: CommentListResponse) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCommentsCacheKey(slug), JSON.stringify({ data, ts: Date.now() }));
  } catch {
  }
}
function clearCommentsCache(slug: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getCommentsCacheKey(slug));
}
export default function CommentSection({ slug }: CommentSectionProps) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated, user } = useAuthStore();
  const [settings, setSettings] = useState<InteractionSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadSettings = useCallback(async () => {
    const res = await getInteractionSettings();
    if (res.code === 0 && res.data) {
      setSettings(res.data);
    } else {
      enqueueSnackbar(res.msg || '获取互动设置失败', { variant: 'error' });
    }
    setLoadingSettings(false);
  }, [enqueueSnackbar]);
  const loadComments = useCallback(
    async (targetPage: number, append = false) => {
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      const res = await getComments(slug, targetPage, PAGE_SIZE);
      if (res.code === 0 && res.data) {
        setComments((prev) => (append ? [...prev, ...res.data.list] : res.data.list));
        setTotal(res.data.total);
        if (!append) {
          writeCommentsCache(slug, res.data);
        }
      } else if (targetPage === 1) {
        enqueueSnackbar(res.msg || '获取评论失败', { variant: 'error' });
      }
      if (targetPage === 1) setLoading(false);
      else setLoadingMore(false);
    },
    [slug, enqueueSnackbar]
  );
  useEffect(() => {
    loadSettings();
    const cached = readCommentsCache(slug);
    if (cached) {
      setComments(cached.list);
      setTotal(cached.total);
      setPage(cached.page);
      setLoading(false);
    } else {
      loadComments(1);
    }
  }, [loadSettings, loadComments, slug]);
  const handleRefresh = () => {
    clearCommentsCache(slug);
    setPage(1);
    loadComments(1);
  };
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadComments(nextPage, true);
  };
  if (loadingSettings) {
    return (
      <Box sx={{ mt: 4 }}>
        <Skeleton variant="text" width="30%" height={32} />
        <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>
    );
  }
  if (!settings || !settings.commentsEnabled) {
    return null;
  }
  const hasMore = comments.length < total;
  return (
    <Box sx={{ mt: 5 }}>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <ChatBubbleOutlineIcon color="primary" sx={{ fontSize: 22 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          评论
        </Typography>
        <Box
          sx={{
            ml: 0.5,
            px: 1.2,
            py: 0.2,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {total}
        </Box>
      </Box>
      {isAuthenticated ? (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
          <Avatar
            src={user?.avatar || undefined}
            alt={user?.username || '我'}
            sx={{ width: 40, height: 40, flexShrink: 0, mt: 0.5 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CommentEditor slug={slug} onSuccess={handleRefresh} />
          </Box>
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.5, sm: 3 },
            textAlign: 'center',
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
            border: (theme) => `1px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
            登录后留下你的想法
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            加入讨论，与大家一起分享观点
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/admin/login')}
            sx={{
              borderRadius: 1,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            去登录
          </Button>
        </Paper>
      )}
      {loading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      ) : (
        <Fade in timeout={400}>
          <Box>
            <CommentList
              comments={comments}
              slug={slug}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              onDeleted={handleRefresh}
            />
          </Box>
        </Fade>
      )}
    </Box>
  );
}