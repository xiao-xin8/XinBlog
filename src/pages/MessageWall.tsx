import { Box } from '@mui/material';
import MessageWallSection from '@/components/MessageWall/MessageWallSection';

export default function MessageWall() {
  return (
    <Box sx={{ mx: { xs: -2, md: 0 }, px: { xs: 0.5, sm: '7px' }, py: { xs: 1, sm: 1.5 } }}>
      <MessageWallSection />
    </Box>

  );
}