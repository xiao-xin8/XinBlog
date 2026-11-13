import { Box } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import MessageWallSection from '@/components/MessageWall/MessageWallSection';
import { AdminFrameFab } from '@/components/Admin/AdminFrameFab';

export default function MessageWall() {
  return (
    <Box sx={{ mx: { xs: -2, md: 0 }, px: { xs: 0.5, sm: '7px' }, py: { xs: 1, sm: 1.5 } }}>
      <MessageWallSection />
      {/* 管理员前台「管理留言墙」：右下角悬浮按钮，iframe 弹窗直接载后台 */}
      <AdminFrameFab adminPath="/admin/message-wall?embed=1" label="管理留言墙" icon={<ForumIcon />} />
    </Box>
  );
}