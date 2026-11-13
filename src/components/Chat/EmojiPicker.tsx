import { useState } from 'react';
import data from '@emoji-mart/data/sets/15/native.json';
import { Box, Tab, Tabs, alpha, useTheme } from '@mui/material';

/** emoji-mart 的分类 id → 中文名 */
const CATEGORY_LABELS: Record<string, string> = {
  smileys: '表情',
  people: '人物',
  nature: '自然',
  foods: '食物',
  activity: '活动',
  places: '旅行',
  objects: '物品',
  symbols: '符号',
  flags: '旗帜',
};

interface EmojiPickerProps {
  onEmoji: (emoji: string) => void;
}

/** 从 native.json 里取某个 emoji 的实际字符（取第一个肤色版本） */
function nativeOf(hexId: string): string | undefined {
  const emoji = data.emojis[hexId];
  return emoji?.skins?.[0]?.native;
}

export default function EmojiPicker({ onEmoji }: EmojiPickerProps) {
  const theme = useTheme();
  const categories = data.categories.filter((c) => c.emojis.length > 0);
  const [active, setActive] = useState(() => categories[0]?.id ?? '');

  const activeCat = categories.find((c) => c.id === active) ?? categories[0];
  const gridEmojis = (activeCat?.emojis ?? [])
    .map(nativeOf)
    .filter((n): n is string => Boolean(n));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 240 }}>
      <Tabs
        value={active}
        onChange={(_, v) => setActive(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 40,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: (t) => alpha(t.palette.divider, 0.5),
          '& .MuiTabs-scroller': { overflowX: 'auto' },
          '& .MuiTabs-scroller::-webkit-scrollbar': { height: 6 },
          '& .MuiTabs-scroller::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.2),
            borderRadius: 3,
          },
          '& .MuiTabs-scroller::-webkit-scrollbar-thumb:hover': {
            bgcolor: alpha(theme.palette.text.primary, 0.35),
          },
          '& .MuiTab-root': { minHeight: 40, px: 1.5, fontSize: '0.85rem' },
        }}
      >
        {categories.map((c) => (
          <Tab key={c.id} value={c.id} label={CATEGORY_LABELS[c.id] ?? c.id} />
        ))}
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 0.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {gridEmojis.map((emoji) => (
            <Box
              key={emoji}
              component="button"
              type="button"
              onClick={() => onEmoji(emoji)}
              sx={{
                width: 36,
                height: 36,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                lineHeight: 1,
                border: 'none',
                borderRadius: 1,
                bgcolor: 'transparent',
                cursor: 'pointer',
                p: 0,
                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                '&:active': { transform: 'scale(0.88)' },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}