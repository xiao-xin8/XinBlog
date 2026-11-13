import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  alpha,
  Fade,
  useTheme,
  useMediaQuery,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { useSiteStore } from '@/stores/siteStore';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { useSnackbar } from 'notistack';

type TermsTab = 'agreement' | 'privacy';

const tabs: { id: TermsTab; label: string }[] = [
  { id: 'agreement', label: '用户协议' },
  { id: 'privacy', label: '隐私政策' },
];

export function TermsEditor() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const site = useSiteStore();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));

  const [tab, setTab] = useState<TermsTab>('agreement');
  const [agreement, setAgreement] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [initialAgreement, setInitialAgreement] = useState('');
  const [initialPrivacy, setInitialPrivacy] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!site.loaded);

  useEffect(() => {
    if (site.loaded) {
      setLoading(false);
      setAgreement(site.config.termsAgreement ?? '');
      setPrivacy(site.config.termsPrivacy ?? '');
      setInitialAgreement(site.config.termsAgreement ?? '');
      setInitialPrivacy(site.config.termsPrivacy ?? '');
    }
  }, [site.loaded, site.config.termsAgreement, site.config.termsPrivacy]);

  const currentContent = tab === 'agreement' ? agreement : privacy;
  const setCurrentContent = (v: string) => {
    if (tab === 'agreement') setAgreement(v);
    else setPrivacy(v);
  };
  const initialContent = tab === 'agreement' ? initialAgreement : initialPrivacy;
  const isDirty = currentContent !== initialContent;

  const handleSave = async () => {
    setSaving(true);
    const ok = await site.saveConfig({
      termsAgreement: agreement,
      termsPrivacy: privacy,
    });
    setSaving(false);
    if (ok) {
      setInitialAgreement(agreement);
      setInitialPrivacy(privacy);
      enqueueSnackbar('协议内容已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  if (loading) return <Loading />;

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          协议管理
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          编辑用户协议和隐私政策内容，支持 Markdown 格式。留空则使用默认内容。
        </Typography>

        {isMobileAdmin ? (
          <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
            <Select<TermsTab>
              value={tab}
              onChange={(e) => setTab(e.target.value as TermsTab)}
              sx={{
                borderRadius: (t) => t.shape.borderRadius * 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-select': {
                  fontWeight: 600,
                  color: 'primary.main',
                  py: 1,
                  px: 2,
                },
              }}
            >
              {tabs.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Box
            onWheel={(e) => {
              const el = e.currentTarget;
              if (el.scrollWidth <= el.clientWidth) return;
              e.preventDefault();
              el.scrollLeft += e.deltaY;
            }}
            sx={{
              mb: 3,
              maxWidth: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              pb: 0.5,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                minWidth: 'max-content',
                p: 0.5,
                borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: 4,
                  width: `calc((100% - 8px) / ${tabs.length})`,
                  bgcolor: 'background.paper',
                  borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                  boxShadow: (theme) => `0 2px 10px ${alpha(theme.palette.common.black, 0.08)}`,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      easing: theme.transitions.easing.easeInOut,
                      duration: theme.transitions.duration.short,
                    }),
                  transform: `translateX(${tabs.findIndex((t) => t.id === tab) * 100}%)`,
                }}
              />
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <Button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      px: { xs: 2, sm: 3 },
                      py: 0.8,
                      borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: 'transparent',
                      fontWeight: 600,
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: 'transparent' },
                    }}
                  >
                    {t.label}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 1,
            boxShadow: (t) =>
              t.palette.mode === 'light'
                ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            {tab === 'agreement' ? '用户协议' : '隐私政策'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            使用 Markdown 格式编写内容。保存后前台页面将自动展示编辑后的内容。
          </Typography>
          <TextField
            value={currentContent}
            onChange={(e) => setCurrentContent(e.target.value)}
            fullWidth
            multiline
            minRows={20}
            maxRows={40}
            placeholder={`在此输入${tab === 'agreement' ? '用户协议' : '隐私政策'}的 Markdown 内容...\n\n留空则使用站点默认的${tab === 'agreement' ? '用户协议' : '隐私政策'}内容。`}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                borderRadius: 1,
              },
            }}
          />
        </Paper>

        <FloatingSaveButton
          show={isDirty}
          saving={saving}
          onClick={handleSave}
          label="保存协议内容"
        />
      </Box>
    </Fade>
  );
}