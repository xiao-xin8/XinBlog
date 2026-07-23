import { Box, Typography, Paper, Stack, TextField, ToggleButtonGroup, ToggleButton, Slider, alpha } from '@mui/material';
import type { PaginationMode } from '@/types';
import { ImageField } from '../ImageField';
import type { AppearanceEditor } from '../useAppearanceEditor';

export function BasicPanel({ editor }: { editor: AppearanceEditor }) {
  const {
    siteName,
    setSiteName,
    author,
    setAuthor,
    shareDescription,
    setShareDescription,
    shareImage,
    setShareImage,
    footerText,
    setFooterText,
    paginationMode,
    setPaginationMode,
    pageSize,
    setPageSize,
    logo,
    setLogo,
    favicon,
    setFavicon,
    backgroundImage,
    setBackgroundImage,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundBlur,
    setBackgroundBlur,
    MAX_SHARE_IMAGE_SIZE,
    MAX_ICON_SIZE,
    MAX_BACKGROUND_SIZE,
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
          label="站点名称（站点标题 / 侧边栏 Logo 文字）"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          fullWidth
        />
        <TextField label="作者名" value={author} onChange={(e) => setAuthor(e.target.value)} fullWidth />
        <TextField
          label="站点分享描述"
          value={shareDescription}
          onChange={(e) => setShareDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="分享站点时显示的卡片描述文本"
        />
        <ImageField
          label="分享图片"
          value={shareImage}
          onChange={setShareImage}
          maxSize={MAX_SHARE_IMAGE_SIZE}
          acceptUrl
          isMobileAdmin={isMobileAdmin}
          onUpload={handleImageUpload}
          hint="建议 1200×630，压缩到 100KB 以内，也可引用自定义 URL"
        />
        <TextField
          label="页脚自定义文本"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="显示在版权声明上方的自定义文字"
        />
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            首页文章分页方式
          </Typography>
          <ToggleButtonGroup
            value={paginationMode}
            exclusive
            onChange={(_, value) => value && setPaginationMode(value as PaginationMode)}
            size="small"
          >
            <ToggleButton value="load-more">加载更多</ToggleButton>
            <ToggleButton value="page-number">上一页 / 下一页</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            每页文章数量 {pageSize} 篇
          </Typography>
          <Slider
            value={pageSize}
            onChange={(_, value) => setPageSize(value as number)}
            min={3}
            max={30}
            step={1}
            marks={[
              { value: 3, label: '3' },
              { value: 6, label: '6' },
              { value: 9, label: '9' },
              { value: 12, label: '12' },
              { value: 18, label: '18' },
              { value: 24, label: '24' },
              { value: 30, label: '30' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>
        <ImageField
          label="Logo（侧边栏左上角）"
          value={logo}
          onChange={setLogo}
          maxSize={MAX_ICON_SIZE}
          acceptUrl
          isMobileAdmin={isMobileAdmin}
          onUpload={handleImageUpload}
          hint="建议 40×40，压缩到 100KB 以内，也可引用自定义 URL"
          showSizeSelect={false}
        />
        <ImageField
          label="Favicon（标签页图标）"
          value={favicon}
          onChange={setFavicon}
          maxSize={MAX_ICON_SIZE}
          acceptUrl
          isMobileAdmin={isMobileAdmin}
          onUpload={handleImageUpload}
          hint="建议 32×32，压缩到 100KB 以内，也可引用自定义 URL"
          showSizeSelect={false}
        />
        <ImageField
          label="全局背景图片"
          value={backgroundImage}
          onChange={setBackgroundImage}
          maxSize={MAX_BACKGROUND_SIZE}
          acceptUrl
          isMobileAdmin={isMobileAdmin}
          onUpload={handleImageUpload}
          hint="允许压缩到 600KB 以内，也可引用自定义 URL"
        />
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            背景透明度 {Math.round(backgroundOpacity * 100)}%
          </Typography>
          <Slider
            value={backgroundOpacity}
            onChange={(_, value) => setBackgroundOpacity(value as number)}
            min={0}
            max={1}
            step={0.05}
            marks={[
              { value: 0, label: '0%' },
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
            磨砂模糊 {backgroundBlur}px
          </Typography>
          <Slider
            value={backgroundBlur}
            onChange={(_, value) => setBackgroundBlur(value as number)}
            min={0}
            max={20}
            step={1}
            marks={[
              { value: 0, label: '0' },
              { value: 10, label: '10' },
              { value: 20, label: '20' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>
      </Stack>
    </Paper>
  );
}
