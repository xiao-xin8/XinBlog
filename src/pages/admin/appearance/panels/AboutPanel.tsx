import { Paper, Stack, alpha, TextField } from '@mui/material';
import type { AppearanceEditor } from '../useAppearanceEditor';

export function AboutPanel({ editor }: { editor: AppearanceEditor }) {
  const { aboutSubtitle, setAboutSubtitle, aboutBio, setAboutBio, aboutTags, setAboutTags } = editor;

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
        <TextField label="副标题" value={aboutSubtitle} onChange={(e) => setAboutSubtitle(e.target.value)} fullWidth />
        <TextField
          label="个人简介"
          value={aboutBio}
          onChange={(e) => setAboutBio(e.target.value)}
          fullWidth
          multiline
          rows={4}
        />
        <TextField
          label="标签（用中文顿号、分隔）"
          value={aboutTags}
          onChange={(e) => setAboutTags(e.target.value)}
          fullWidth
          placeholder="热爱生活、喜欢设计、追求技术"
        />
      </Stack>

    </Paper>

  );
}
