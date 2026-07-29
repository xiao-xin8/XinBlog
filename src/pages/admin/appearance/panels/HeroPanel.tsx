import { Box, Typography, Paper, Stack, alpha, TextField } from '@mui/material';
import { ColorPicker } from '@/components/Common/ColorPicker';
import { ImageField } from '../ImageField';
import type { AppearanceEditor } from '../useAppearanceEditor';
export function HeroPanel({ editor }: { editor: AppearanceEditor }) {
  const {
    heroTitle,
    setHeroTitle,
    heroSubtitle,
    setHeroSubtitle,
    heroBadge,
    setHeroBadge,
    heroBgColor,
    setHeroBgColor,
    heroBgImage,
    setHeroBgImage,
    MAX_HERO_IMAGE_SIZE,
    isMobileAdmin,
    handleImageUpload,
  } = editor;
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Stack spacing={3}>
        <TextField
          label="英雄区标题"
          value={heroTitle}
          onChange={(e) => setHeroTitle(e.target.value)}
          fullWidth
        />
        <TextField
          label="英雄区副标题"
          value={heroSubtitle}
          onChange={(e) => setHeroSubtitle(e.target.value)}
          fullWidth
        />
        <TextField
          label="顶部徽章文字"
          value={heroBadge}
          onChange={(e) => setHeroBadge(e.target.value)}
          fullWidth
        />
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            背景色
          </Typography>
          <ColorPicker value={heroBgColor} onChange={setHeroBgColor} />
        </Box>
        <ImageField
          label="背景图片"
          value={heroBgImage}
          onChange={setHeroBgImage}
          maxSize={MAX_HERO_IMAGE_SIZE}
          acceptUrl
          isMobileAdmin={isMobileAdmin}
          onUpload={handleImageUpload}
          hint="建议上传后自动压缩到 500KB 以内，也可引用自定义 URL"
        />
      </Stack>
    </Paper>
  );
}