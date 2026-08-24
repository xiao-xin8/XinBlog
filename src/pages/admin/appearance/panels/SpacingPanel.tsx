import { Box, Typography, Paper, Stack, TextField, Button, Divider, alpha } from '@mui/material';
import { RestartAlt } from '@mui/icons-material';
import type { SpacingConfig } from '@/types';
import type { AppearanceEditor } from '../useAppearanceEditor';

type Side = 'mobile' | 'desktop';

interface SpacingItem {
  key: keyof SpacingConfig;
  label: string;
  desc: string;
}


const GROUPS: { title: string; desc: string; items: SpacingItem[] }[] = [
  {
    title: '主内容区',
    desc: '作用于整站布局，所有页面正文与屏幕左右边缘的距离。',
    items: [
      {
        key: 'mainPaddingX',
        label: '主内容左右内边距',
        desc: '移动端默认 16px，桌面端默认 0px（正文由各页面内部的容器控制宽度）。',
      },
    ],
  },
  {
    title: '导航栏',
    desc: '顶部导航栏区域。',
    items: [
      {
        key: 'navPaddingX',
        label: '导航栏左右内边距',
        desc: '移动端默认 8px，桌面端默认 16px（保证右侧功能按钮不贴边）。',
      },
      {
        key: 'navGap',
        label: '右侧控件间距',
        desc: '导航栏右侧「搜索 / 主题切换 / 头像」等控件之间的间距，默认 8px。',
      },
    ],
  },
  {
    title: '页脚',
    desc: '底部页脚区域。',
    items: [
      {
        key: 'footerPaddingY',
        label: '页脚上下内边距',
        desc: '页脚内容与外边框之间的上下留白，默认 32px。',
      },
      {
        key: 'footerLinkGap',
        label: '底部链接间距',
        desc: '页脚底部「用户协议 / 隐私政策」链接之间的间距，默认移动 12px / 桌面 20px。',
      },
    ],
  },
  {
    title: '文章正文',
    desc: '文章详情页的正文排版。',
    items: [
      {
        key: 'articleHeadingGap',
        label: '标题上方间距',
        desc: '正文各级标题（h1~h6）上方的留白，默认 32px。',
      },
      {
        key: 'articleParagraphGap',
        label: '段落间距',
        desc: '正文章节相邻段落之间的间距，默认 16px。',
      },
    ],
  },
  {
    title: '帖子列表',
    desc: '首页 / 标签页 / 搜索结果页的帖子卡片排列。',
    items: [
      {
        key: 'postListGap',
        label: '卡片间距',
        desc: '帖子卡片之间的间隙（网格、横向、杂志三种布局通用），默认 24px。调大则卡片之间更开阔。',
      },
      {
        key: 'cardPaddingY',
        label: '卡片内容内边距',
        desc: '每张帖子卡片内部文字区域与卡片边框的距离，默认移动 16px / 桌面 24px。',
      },
    ],
  },
  {
    title: '主页英雄区',
    desc: '首页顶部的大幅标题区域。',
    items: [
      {
        key: 'heroPaddingY',
        label: '英雄区上下内边距',
        desc: '英雄区内容与自身顶部/底部的留白，默认移动 48px / 桌面 80px。',
      },
      {
        key: 'heroBottomGap',
        label: '英雄区与下方间距',
        desc: '英雄区与下方「最新文章」区块之间的距离，默认移动 32px / 桌面 48px。',
      },
    ],
  },
];

function SpacingRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: { mobile: number; desktop: number };
  onChange: (side: Side, value: number) => void;
}) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, mb: 1.5 }}>
        {desc}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {(['mobile', 'desktop'] as Side[]).map((side) => (
          <TextField
            key={side}
            label={side === 'mobile' ? '移动端 (px)' : '桌面端 (px)'}
            type="number"
            value={value[side]}
            onChange={(e) => onChange(side, Number(e.target.value))}
            inputProps={{ min: 0, max: 240, step: 1 }}
            size="small"
            sx={{ maxWidth: { sm: 180 } }}
          />
        ))}
      </Stack>

    </Box>

  );
}

export function SpacingPanel({ editor }: { editor: AppearanceEditor }) {
  const { spacing, updateSpacing, resetSpacing, enqueueSnackbar } = editor;

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          间距设置
        </Typography>

        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<RestartAlt fontSize="small" />}
          onClick={() => {
            resetSpacing();
            enqueueSnackbar('已还原为默认间距，别忘了点击右下角「保存外观设置」', { variant: 'info' });
          }}
        >
          还原默认配置
        </Button>

      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        所有间距单位均为 px。修改后点击右下角「保存外观设置」才会生效，且无需预览，可反复调整。
      </Typography>


      <Stack spacing={4}>
        {GROUPS.map((group, idx) => (
          <Box key={group.title}>
            {idx > 0 && <Divider sx={{ mb: 3 }} />}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {group.title}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {group.desc}
            </Typography>

            <Stack spacing={2.5}>
              {group.items.map((item) => (
                <SpacingRow
                  key={item.key}
                  label={item.label}
                  desc={item.desc}
                  value={spacing[item.key]}
                  onChange={(side, value) => updateSpacing(item.key, side, value)}
                />
              ))}
            </Stack>

          </Box>

        ))}
      </Stack>

    </Paper>

  );
}