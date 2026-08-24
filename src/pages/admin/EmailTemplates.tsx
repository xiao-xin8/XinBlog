import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Preview } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  fetchEmailTemplateSettings,
  updateEmailTemplateSettings,
  type EmailTemplateSettings,
  type EmailTemplateKind,
} from '@/api/admin';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';

interface MagicVariable {
  key: string;
  label: string;
  desc: string;
}

const MAGIC_VARIABLES: MagicVariable[] = [
  { key: 'username', label: '用户名', desc: '收件人的用户名' },
  { key: 'email', label: '邮箱', desc: '收件人邮箱地址' },
  { key: 'code', label: '验证码', desc: '自动生成的邮箱验证码' },
  { key: 'expireMinutes', label: '有效分钟', desc: '验证码有效期，默认 10 分钟' },
  { key: 'siteName', label: '站点名称', desc: '基础设置中的站点名称，也用作站点标题' },
  { key: 'siteTitle', label: '站点标题', desc: '与站点名称一致' },
];

const SAMPLE_VALUES: Record<string, string> = {
  username: '星语',
  email: 'user@example.com',
  code: 'A3B7C9',
  expireMinutes: '10',
  siteName: 'XinBlog',
  siteTitle: 'XinBlog',
};


const defaultTemplate: EmailTemplateSettings = {
  subject: '您的注册验证码',
  html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>注册验证码</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(91,124,250,0.12);">
          <tr>
            <td style="padding:40px 32px 32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;font-weight:700;">{{siteName}}</h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">{{siteTitle}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">您好，<strong>{{username}}</strong>：</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">感谢您注册 {{siteName}}，请在 {{expireMinutes}} 分钟内使用以下验证码完成注册：</p>
              <div style="text-align:center;padding:24px 0;">
                <table cellpadding="0" cellspacing="0" border="0" bgcolor="#5b7cfa" style="background-color:#5b7cfa;border-radius:12px;display:inline-block;">
                  <tr>
                    <td style="padding:16px 32px;text-align:center;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;line-height:1;">{{code}}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">如果这不是您本人的操作，请忽略此邮件。验证码仅用于注册验证，请勿泄露给他人。</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">本邮件由 {{siteName}} 自动发送</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  text: '您好，{{username}}：感谢您注册 {{siteName}}，验证码是 {{code}}，{{expireMinutes}} 分钟内有效。如非本人操作请忽略。',
};


const defaultResetTemplate: EmailTemplateSettings = {
  subject: '您的密码重置验证码',
  html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置密码</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(91,124,250,0.12);">
          <tr>
            <td style="padding:40px 32px 32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;font-weight:700;">{{siteName}}</h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">{{siteTitle}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">您好，<strong>{{username}}</strong>：</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">我们收到了您重置 {{siteName}} 密码的请求，请在 {{expireMinutes}} 分钟内使用以下验证码完成密码重置：</p>
              <div style="text-align:center;padding:24px 0;">
                <table cellpadding="0" cellspacing="0" border="0" bgcolor="#5b7cfa" style="background-color:#5b7cfa;border-radius:12px;display:inline-block;">
                  <tr>
                    <td style="padding:16px 32px;text-align:center;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;line-height:1;">{{code}}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">验证码仅用于密码重置，请勿泄露给他人。如果您没有申请重置密码，请忽略此邮件并尽快修改密码。</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">本邮件由 {{siteName}} 自动发送</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  text: '您好，{{username}}：我们收到了重置 {{siteName}} 密码的请求，请在 {{expireMinutes}} 分钟内使用验证码 {{code}} 完成重置。如非本人操作请忽略此邮件。',
};

function applyVariables(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
  }
  return result;
}

export function AdminEmailTemplates() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const [kind, setKind] = useState<EmailTemplateKind>('register');
  const isReset = kind === 'reset';
  const currentFallback = isReset ? defaultResetTemplate : defaultTemplate;
  const [template, setTemplate] = useState<EmailTemplateSettings>(currentFallback);
  const [initialTemplate, setInitialTemplate] = useState<EmailTemplateSettings>(template);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<'subject' | 'html' | 'text'>('html');
  const [cursor, setCursor] = useState<{ field: 'subject' | 'html' | 'text'; pos: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchEmailTemplateSettings(kind)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setTemplate(data);
          setInitialTemplate(data);
        } else {
          setLoadError('未能从数据库加载模板，已显示默认模板。保存后将写入数据库。');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '加载模板失败，已显示默认模板');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const isDirty = useMemo(
    () => JSON.stringify(template) !== JSON.stringify(initialTemplate),
    [template, initialTemplate]
  );

  const preview = useMemo(() => {
    return {
      subject: applyVariables(template.subject, SAMPLE_VALUES),
      html: applyVariables(template.html, SAMPLE_VALUES),
      text: applyVariables(template.text, SAMPLE_VALUES),
    };
  }, [template]);

  const handleChange = (field: keyof EmailTemplateSettings, value: string) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  const insertVariable = (key: string) => {
    const field = cursor?.field || activeField;
    const textarea = document.getElementById(`email-template-${field}`) as HTMLTextAreaElement | HTMLInputElement | null;
    const current = template[field];
    const placeholder = `{{${key}}}`;
    let start = current.length;
    let end = current.length;
    if (textarea && typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
      start = textarea.selectionStart;
      end = textarea.selectionEnd;
    } else if (cursor?.field === field) {
      start = cursor.pos;
      end = cursor.pos;
    }
    const next = current.substring(0, start) + placeholder + current.substring(end);
    setTemplate((prev) => ({ ...prev, [field]: next }));
    requestAnimationFrame(() => {
      if (!textarea) return;
      const pos = start + placeholder.length;
      textarea.focus();
      if (typeof textarea.setSelectionRange === 'function') {
        textarea.setSelectionRange(pos, pos);
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    
    const saved = await updateEmailTemplateSettings(template, kind);
    if (saved) {
      setTemplate(saved);
      setInitialTemplate(saved);
      enqueueSnackbar('邮件模板已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败', { variant: 'error' });
    }
    setSaving(false);
  };

  const paperShadow = {
    boxShadow: (t: typeof theme) =>
      t.palette.mode === 'light'
        ? `0 4px 20px ${alpha(t.palette.primary.main, 0.08)}`
        : `0 4px 20px ${alpha(t.palette.common.black, 0.25)}`,
  };

  const renderEditor = () => (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        ...paperShadow,
      }}
    >
      <Stack spacing={3}>
        <TextField
          id="email-template-subject"
          label="邮件主题"
          value={template.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          onFocus={() => setActiveField('subject')}
          onClick={(e) =>
            setCursor({ field: 'subject', pos: (e.target as HTMLInputElement).selectionStart || 0 })
          }
          onKeyUp={(e) =>
            setCursor({ field: 'subject', pos: (e.target as HTMLInputElement).selectionStart || 0 })
          }
          fullWidth
          placeholder="例如：{{siteName}} 注册验证码"
        />

        <TextField
          id="email-template-html"
          label="HTML 正文"
          value={template.html}
          onChange={(e) => handleChange('html', e.target.value)}
          onFocus={() => setActiveField('html')}
          onClick={(e) =>
            setCursor({ field: 'html', pos: (e.target as HTMLTextAreaElement).selectionStart || 0 })
          }
          onKeyUp={(e) =>
            setCursor({ field: 'html', pos: (e.target as HTMLTextAreaElement).selectionStart || 0 })
          }
          fullWidth
          multiline
          rows={12}
          placeholder="在此输入 HTML 邮件模板..."
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: '"Fira Code", monospace',
              fontSize: '0.9rem',
            },
          }}
        />

        <TextField
          id="email-template-text"
          label="纯文本正文（部分邮箱客户端会作为备用显示）"
          value={template.text}
          onChange={(e) => handleChange('text', e.target.value)}
          onFocus={() => setActiveField('text')}
          onClick={(e) =>
            setCursor({ field: 'text', pos: (e.target as HTMLTextAreaElement).selectionStart || 0 })
          }
          onKeyUp={(e) =>
            setCursor({ field: 'text', pos: (e.target as HTMLTextAreaElement).selectionStart || 0 })
          }
          fullWidth
          multiline
          rows={4}
          placeholder="在此输入纯文本版本..."
        />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            魔法变量
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            点击变量可插入到当前聚焦的输入框中；发送邮件时会自动替换为实际内容。
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: (t) =>
                t.palette.mode === 'light'
                  ? t.palette.grey[100]
                  : alpha(t.palette.common.white, 0.05),
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {MAGIC_VARIABLES.map((v) => (
                <Chip
                  key={v.key}
                  label={`{{${v.key}}}`}
                  onClick={() => insertVariable(v.key)}
                  sx={{
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontFamily: '"Fira Code", monospace',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    color: 'primary.main',
                    fontWeight: 500,
                    '&:hover': {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                    },
                  }}
                />
              ))}
            </Box>

            <Stack spacing={0.5}>
              {MAGIC_VARIABLES.map((v) => (
                <Typography key={v.key} variant="caption" color="text.secondary">
                  <Box component="span" sx={{ fontFamily: '"Fira Code", monospace', color: 'primary.main', fontWeight: 500 }}>
                    {'{{'}{v.key}{'}}'}
                  </Box>{' '}

                  — {v.desc}
                </Typography>

              ))}
            </Stack>

          </Paper>

        </Box>


        <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存模板" />
      </Stack>

    </Paper>

  );

  const renderPreview = () => (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        overflow: 'hidden',
        ...paperShadow,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Preview color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          实时预览
        </Typography>

      </Box>


      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          主题
        </Typography>

        <Typography variant="body1" sx={{ fontWeight: 500, overflowWrap: 'break-word' }}>
          {preview.subject || '（未填写主题）'}
        </Typography>

      </Box>


      <Box sx={{ flex: 1, minHeight: 240, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <iframe
          title="邮件预览"
          srcDoc={preview.html}
          style={{ width: '100%', height: '100%', border: 'none', minHeight: 240 }}
          sandbox=""
        />
      </Box>


      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          纯文本版本
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: (t) =>
              t.palette.mode === 'light'
                ? t.palette.grey[100]
                : alpha(t.palette.common.white, 0.05),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.85rem',
          }}
        >
          {preview.text || '（未填写纯文本版本）'}
        </Paper>

      </Box>

    </Paper>

  );

  if (loading) {
    return <Loading text="加载邮件模板..." />;
  }

  return (
    <Fade in timeout={400}>
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
        邮件模板
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        自定义验证码邮件的主题、HTML 和纯文本内容。
      </Typography>


      <ToggleButtonGroup
        exclusive
        value={kind}
        onChange={(_, v: EmailTemplateKind | null) => v && setKind(v)}
        size="small"
        sx={{ mb: 3 }}
        aria-label="邮件模板类型"
      >
        <ToggleButton value="register">注册验证模板</ToggleButton>

        <ToggleButton value="reset">重置密码模板</ToggleButton>

      </ToggleButtonGroup>


      {loadError && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 1 }}>
          {loadError}
        </Alert>

      )}

      {isMobileAdmin ? (
        <Stack spacing={3}>
          {renderEditor()}
          {renderPreview()}
        </Stack>

      ) : (
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={7}>
            {renderEditor()}
          </Grid>

          <Grid item xs={12} lg={5}>
            {renderPreview()}
          </Grid>

        </Grid>

      )}
    </Box>

    </Fade>

  );
}
