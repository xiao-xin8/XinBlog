import { useMemo } from 'react';
import { Box, Typography, Button, Paper, alpha, Fade } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CommentItem from './CommentItem';
import type { Comment } from '@/types/interaction';

interface CommentListProps {
  comments: Comment[];
  slug: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDeleted: () => void;
  onReplied: () => void;
}

export default function CommentList({
  comments,
  slug,
  hasMore,
  loadingMore,
  onLoadMore,
  onDeleted,
  onReplied,
}: CommentListProps) {
  const grouped = useMemo(() => {
    const parents = comments.filter((c) => !c.parentId);
    const children = comments.filter((c) => c.parentId);
    return parents.map((parent) => ({
      ...parent,
      replies: children.filter((c) => c.parentId === parent.id),
    }));
  }, [comments]);

  if (comments.length === 0) {
    return (
      <Fade in timeout={400}>
        <Paper
          elevation={0}
          sx={{
            textAlign: 'center',
            py: 5,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
            border: (theme) => `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <ChatBubbleOutlineIcon
            sx={{
              fontSize: 40,
              color: (theme) => alpha(theme.palette.primary.main, 0.35),
              mb: 1,
            }}
          />
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
            还没有评论
          </Typography>

          <Typography variant="body2" color="text.secondary">
            来说点什么，开启这段对话吧
          </Typography>

        </Paper>

      </Fade>

    );
  }

  return (
    <Box>
      {grouped.map((parent) => (
        <Box key={parent.id}>
          {}
          <CommentItem comment={parent} slug={slug} onDeleted={onDeleted} onReplied={onReplied} />
          {}
          {parent.replies.length > 0 && (
            <Box
              sx={{
                ml: { xs: 2, sm: 4 },
                pl: { xs: 2, sm: 2.5 },
                borderLeft: (theme) => `2px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                mb: 1,
              }}
            >
              {parent.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} slug={slug} onDeleted={onDeleted} onReplied={onReplied} />
              ))}
            </Box>

          )}
        </Box>

      ))}
      {hasMore && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            size="small"
            onClick={onLoadMore}
            disabled={loadingMore}
            variant="outlined"
            endIcon={<ExpandMoreIcon />}
            sx={{
              borderRadius: 1,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </Button>

        </Box>

      )}
    </Box>

  );
}