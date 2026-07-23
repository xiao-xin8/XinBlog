import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  alpha,
  FormControl,
  Select,
  MenuItem,
  useMediaQuery,
  Fade,
  Paper,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  CircularProgress,
  IconButton,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add, Delete, ContentCopy, Visibility, VisibilityOff } from '@mui/icons-material';
import {
  fetchAiSettings,
  updateAiSettings,
  fetchAiApiKeys,
  createAiApiKey,
  deleteAiApiKey,
  fetchAiModels,
  fetchAiCustomModels,
  createAiCustomModel,
  updateAiCustomModel,
  deleteAiCustomModel,
  isTextAiModel,
  type AiSettings,
  type AiApiKey,
  type AiModel,
  type AiCustomModel,
} from '@/api/ai';
import { Loading } from '@/components/Common/Loading';
import { FloatingSaveButton } from '@/components/Common/FloatingSaveButton';
import { useSnackbar } from 'notistack';

type AiTab = 'basic' | 'apikey' | 'custom';

export function Ai() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<AiTab>('basic');
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    model: 'llama-3.3-70b',
    imageModel: 'flux-1-schnell',
    temperature: 0.7,
    maxTokens: 2048,
  });
  const [initialSettings, setInitialSettings] = useState<AiSettings>(settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keys, setKeys] = useState<AiApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showBuiltInKey, setShowBuiltInKey] = useState(false);

  const [models, setModels] = useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [customModels, setCustomModels] = useState<AiCustomModel[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCustomModel, setEditingCustomModel] = useState<AiCustomModel | null>(null);
  const [customForm, setCustomForm] = useState({ name: '', modelId: '', baseUrl: '', apiKey: '', enabled: true });
  const [customSubmitting, setCustomSubmitting] = useState(false);

  
  const [deleteKeyConfirm, setDeleteKeyConfirm] = useState<AiApiKey | null>(null);
  const [deleteKeyLoading, setDeleteKeyLoading] = useState(false);
  const [deleteCustomConfirm, setDeleteCustomConfirm] = useState<AiCustomModel | null>(null);
  const [deleteCustomLoading, setDeleteCustomLoading] = useState(false);

  const tabs: { id: AiTab; label: string }[] = [
    { id: 'basic', label: '基础设置' },
    { id: 'apikey', label: 'API Key' },
    { id: 'custom', label: '自定义模型' },
  ];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const s = await fetchAiSettings();
      if (!cancelled) {
        if (s) {
          setSettings(s);
          setInitialSettings(s);
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings]
  );

  const loadKeys = async () => {
    setKeysLoading(true);
    const list = await fetchAiApiKeys();
    setKeys(list);
    setKeysLoading(false);
  };

  const loadModels = async () => {
    setModelsLoading(true);
    const list = await fetchAiModels();
    setModels(list);
    setModelsLoading(false);
  };

  const loadCustomModels = async () => {
    setCustomModelsLoading(true);
    const list = await fetchAiCustomModels();
    setCustomModels(list);
    setCustomModelsLoading(false);
  };

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (tab !== 'apikey') return;
    loadKeys();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'custom') return;
    loadCustomModels();
  }, [tab]);

  const handleSave = async () => {
    setSaving(true);
    const updated = await updateAiSettings(settings);
    setSaving(false);
    if (updated) {
      setSettings(updated);
      setInitialSettings(updated);
      enqueueSnackbar('AI 设置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
  };

  const handleCreateKey = async () => {
    const name = newKeyName.trim();
    if (!name) return;
    setCreatingKey(true);
    const result = await createAiApiKey(name);
    setCreatingKey(false);
    if (result.key) {
      setGeneratedKey(result.key);
      setShowKeyDialog(true);
      setNewKeyName('');
      await loadKeys();
    } else {
      enqueueSnackbar(result.msg || '创建失败', { variant: 'error' });
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKeyConfirm) return;
    setDeleteKeyLoading(true);
    const ok = await deleteAiApiKey(deleteKeyConfirm.id);
    setDeleteKeyLoading(false);
    setDeleteKeyConfirm(null);
    if (ok) {
      enqueueSnackbar('API Key 已删除', { variant: 'success' });
      await loadKeys();
    } else {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  };

  const handleConfirmDeleteKey = (key: AiApiKey) => {
    setDeleteKeyConfirm(key);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('已复制到剪贴板', { variant: 'success' });
  };

  const openCustomDialog = (model?: AiCustomModel) => {
    if (model) {
      setEditingCustomModel(model);
      setCustomForm({
        name: model.name,
        modelId: model.modelId,
        baseUrl: model.baseUrl,
        apiKey: '',
        enabled: model.enabled,
      });
    } else {
      setEditingCustomModel(null);
      setCustomForm({ name: '', modelId: '', baseUrl: '', apiKey: '', enabled: true });
    }
    setCustomDialogOpen(true);
  };

  const closeCustomDialog = () => {
    setCustomDialogOpen(false);
    setEditingCustomModel(null);
    setCustomForm({ name: '', modelId: '', baseUrl: '', apiKey: '', enabled: true });
  };

  const handleSaveCustomModel = async () => {
    const name = customForm.name.trim();
    const modelId = customForm.modelId.trim();
    const baseUrl = customForm.baseUrl.trim();
    const apiKey = customForm.apiKey.trim();
    if (!name || !modelId || !baseUrl) {
      enqueueSnackbar('请填写完整信息', { variant: 'warning' });
      return;
    }
    if (!editingCustomModel && !apiKey) {
      enqueueSnackbar('新建模型时 API Key 必填', { variant: 'warning' });
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      enqueueSnackbar('Base URL 必须以 http:// 或 https:// 开头', { variant: 'warning' });
      return;
    }
    setCustomSubmitting(true);
    const data = { name, modelId, baseUrl, apiKey, enabled: customForm.enabled };
    const ok = editingCustomModel
      ? await updateAiCustomModel(editingCustomModel.id, data)
      : await createAiCustomModel(data);
    setCustomSubmitting(false);
    if (ok) {
      enqueueSnackbar(editingCustomModel ? '自定义模型已更新' : '自定义模型已创建', { variant: 'success' });
      closeCustomDialog();
      await loadCustomModels();
      await loadModels();
    } else {
      enqueueSnackbar('保存失败', { variant: 'error' });
    }
  };

  const handleDeleteCustomModel = async () => {
    if (!deleteCustomConfirm) return;
    setDeleteCustomLoading(true);
    const ok = await deleteAiCustomModel(deleteCustomConfirm.id);
    setDeleteCustomLoading(false);
    setDeleteCustomConfirm(null);
    if (ok) {
      enqueueSnackbar('自定义模型已删除', { variant: 'success' });
      await loadCustomModels();
      await loadModels();
    } else {
      enqueueSnackbar('删除失败', { variant: 'error' });
    }
  };

  const handleConfirmDeleteCustomModel = (model: AiCustomModel) => {
    setDeleteCustomConfirm(model);
  };

  if (loading) return <Loading />;

  const textModels = models.filter((m) => isTextAiModel(m.id));

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, overflowWrap: 'break-word' }}>
          AI 管理
        </Typography>

        {isMobileAdmin ? (
          <FormControl size="small" sx={{ mb: 3, minWidth: 140, maxWidth: '100%' }}>
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as AiTab)}
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
              {tabs.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.label}
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
                      flex: 1,
                      zIndex: 1,
                      py: 1,
                      px: { xs: 1.5, sm: 2 },
                      minWidth: { xs: 72, sm: 90 },
                      borderRadius: (theme) => theme.shape.borderRadius * 1.5,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: 'transparent',
                      fontWeight: active ? 700 : 500,
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
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

        <Fade in timeout={300} key={tab}>
          <Box>
            {tab === 'basic' && (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, overflowWrap: 'break-word' }}>
                  基础设置
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enabled}
                        onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                      />
                    }
                    label="启用 AI 功能"
                  />

                  {!settings.enabled && (
                    <Typography variant="body2" color="text.secondary">
                      关闭后，文章编辑页的 AI 助手及所有 AI 接口将不可用。
                    </Typography>
                  )}

                  <FormControl size="small" fullWidth>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      默认文本模型
                    </Typography>
                    <Select
                      value={settings.model}
                      onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                      disabled={modelsLoading}
                      sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                    >
                      {textModels.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.name || m.id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      随机性 (Temperature)
                    </Typography>
                    <Slider
                      value={settings.temperature}
                      onChange={(_, v) => setSettings((s) => ({ ...s, temperature: v as number }))}
                      min={0}
                      max={1.5}
                      step={0.1}
                      marks={[
                        { value: 0, label: '稳定' },
                        { value: 0.7, label: '平衡' },
                        { value: 1.5, label: '创意' },
                      ]}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      最大 Token 数
                    </Typography>
                    <Slider
                      value={settings.maxTokens}
                      onChange={(_, v) => setSettings((s) => ({ ...s, maxTokens: v as number }))}
                      min={2048}
                      max={8192}
                      step={256}
                    marks={[
                      { value: 2048, label: '2048' },
                      { value: 4096, label: '4096' },
                      { value: 8192, label: '8192' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                  </Box>
                </Box>

                <FloatingSaveButton show={isDirty} saving={saving} onClick={handleSave} label="保存设置" />
              </Paper>
            )}

            {tab === 'apikey' && (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'break-word' }}>
                  API Key 管理
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  内置 API Key 由环境变量配置，不会在前端显示。你可以额外创建 Key 供外部工具以 OpenAI 兼容格式调用。
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  接口地址：{typeof window !== 'undefined' ? `${window.location.origin}/v1` : '/v1'}，支持 /v1/models、/v1/chat/completions、/v1/embeddings。
                </Typography>

                <Box
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    内置 API Key
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      value={showBuiltInKey ? 'AI_API_KEY（已配置）' : '****************'}
                      disabled
                      fullWidth
                      size="small"
                      type={showBuiltInKey ? 'text' : 'password'}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowBuiltInKey((v) => !v)}>
                              {showBuiltInKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    在 Cloudflare Dashboard 中配置 AI_API_KEY 环境变量即可启用外部调用。
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  自定义 API Key
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    placeholder="Key 名称，例如：Obsidian 同步"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateKey();
                      }
                    }}
                    sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
                  />
                  <Button
                    variant="contained"
                    startIcon={creatingKey ? <CircularProgress size={16} color="inherit" /> : <Add />}
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim() || creatingKey}
                    sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                  >
                    创建
                  </Button>
                </Box>

                {keysLoading ? (
                  <CircularProgress size={24} />
                ) : keys.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    暂无自定义 API Key
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {keys.map((key) => (
                      <Box
                        key={key.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {key.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            创建于 {new Date(key.created_at).toLocaleString('zh-CN')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                          <Chip
                            label={key.enabled ? '启用' : '禁用'}
                            size="small"
                            color={key.enabled ? 'success' : 'default'}
                            sx={{ borderRadius: 1 }}
                          />
                          <IconButton size="small" color="error" onClick={() => handleConfirmDeleteKey(key)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box
                  sx={{
                    p: 2,
                    mt: 3,
                    borderRadius: 1,
                    bgcolor: (theme) => alpha(theme.palette.info.main, 0.05),
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    调用说明
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    将本站域名作为 OpenAI 兼容 base URL，配合上方 API Key 即可调用：
                  </Typography>
                  <Box
                    component="code"
                    sx={{
                      display: 'block',
                      bgcolor: 'background.paper',
                      px: 1,
                      py: 0.75,
                      borderRadius: 0.75,
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      mb: 1.5,
                      overflowWrap: 'break-word',
                    }}
                  >
                    {typeof window !== 'undefined' ? `${window.location.origin}/v1` : '/v1'}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    支持 endpoints：/v1/models、/v1/chat/completions、/v1/embeddings
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    可直接使用本站内置别名，也支持传入 Cloudflare Workers AI 原始模型 ID（如 <code>@cf/meta/llama-3.3-70b-instruct-fp8-fast</code>）。自定义模型使用 <code>custom:&lt;ID&gt;</code>。
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    当前可用模型 ID：
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                    {modelsLoading ? (
                      <CircularProgress size={16} />
                    ) : models.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        暂无可用模型
                      </Typography>
                    ) : (
                      models.map((m) => (
                        <Chip
                          key={m.id}
                          label={m.id}
                          size="small"
                          sx={{
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            bgcolor: 'background.paper',
                          }}
                        />
                      ))
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    完整 Cloudflare Workers AI 模型列表可参考官方文档。接口层会透传任意合法 ID，列表只展示本站已内置别名与自定义模型。
                  </Typography>
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                    注意：模型 ID 仅表示接口支持调用，不保证每个模型在所有情况下都能正常返回结果。自定义模型取决于第三方服务可用性。
                  </Typography>
                </Box>
              </Paper>
            )}

            {tab === 'custom' && (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'break-word' }}>
                  自定义模型
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  添加符合 OpenAI 接口规范的自定义模型（如 DeepSeek、OpenRouter 等），保存后会出现在基础设置的模型列表最前面。
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => openCustomDialog()}
                    sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                  >
                    添加模型
                  </Button>
                </Box>

                {customModelsLoading ? (
                  <CircularProgress size={24} />
                ) : customModels.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    暂无自定义模型
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {customModels.map((model) => (
                      <ButtonBase
                        key={model.id}
                        focusRipple
                        onClick={() => openCustomDialog(model)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          width: '100%',
                          textAlign: 'left',
                          transition: 'background-color 0.2s ease, border-color 0.2s ease',
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                            borderColor: 'primary.main',
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {model.name}（自定义）
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {model.modelId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {model.baseUrl}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <Chip
                            label={model.enabled ? '启用' : '禁用'}
                            size="small"
                            color={model.enabled ? 'success' : 'default'}
                            sx={{ borderRadius: 1 }}
                          />
                          <IconButton size="small" color="error" onClick={() => handleConfirmDeleteCustomModel(model)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </ButtonBase>
                    ))}
                  </Box>
                )}
              </Paper>
            )}
          </Box>
        </Fade>

        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: { xs: 2, sm: 3 },
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03),
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            使用说明
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.75 } }}>
              <li>
                Cloudflare Workers AI 每天有固定免费额度，高消耗模型会更快用完配额。额度用尽后需等待次日重置，或添加自定义模型使用第三方 API。
              </li>
              <li>
                文章生成、格式优化、AI 对话默认使用「基础设置」中选择的模型；选择自定义模型时会直接调用该模型的 OpenAI 兼容接口。
              </li>
              <li>
                外部调用：可把本站点域名作为 OpenAI base URL，例如{' '}
                <Box component="code" sx={{ bgcolor: 'background.paper', px: 0.75, py: 0.25, borderRadius: 0.75, fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/v1
                </Box>
                ，并传入 API Key 即可。
              </li>
              <li>
                自定义模型需要填写模型提供方给出的模型 ID、Base URL 和 API Key，保存后即可在模型列表中选择使用。
              </li>
              <li>
                安全说明：自定义模型的 API Key 在服务端使用 AES-256-GCM 加密存储，密钥由环境变量派生；前端编辑时不会回显已保存的密钥，只能输入新密钥进行更新，避免密钥泄露风险。此前已保存的明文密钥仍可正常使用，编辑保存时会自动升级为加密存储。
              </li>
            </Box>
          </Typography>
        </Paper>

        <Dialog open={showKeyDialog} onClose={() => setShowKeyDialog(false)} fullWidth maxWidth="sm" BackdropProps={{ 'aria-hidden': false }}>
          <DialogTitle sx={{ fontWeight: 700 }}>API Key 创建成功</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              请立即复制，关闭后将无法再次查看完整 Key。
            </Typography>
            <TextField
              value={generatedKey}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => copyToClipboard(generatedKey)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => setShowKeyDialog(false)} sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}>
              关闭
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={customDialogOpen} onClose={closeCustomDialog} fullWidth maxWidth="sm" BackdropProps={{ 'aria-hidden': false }}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editingCustomModel ? '编辑自定义模型' : '添加自定义模型'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
              <TextField
                label="显示名称"
                placeholder="例如：deepseek-chat"
                value={customForm.name}
                onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
              />
              <TextField
                label="模型 ID"
                placeholder="例如：DeepSeek-V4-Flash"
                value={customForm.modelId}
                onChange={(e) => setCustomForm((f) => ({ ...f, modelId: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
              />
              <TextField
                label="Base URL"
                placeholder="例如：https://api.deepseek.com"
                value={customForm.baseUrl}
                onChange={(e) => setCustomForm((f) => ({ ...f, baseUrl: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
              />
              <TextField
                label="API Key"
                type="password"
                placeholder={editingCustomModel ? '输入新密钥以更新，留空则保持原密钥' : 'sk-xxxxxxxx'}
                value={customForm.apiKey}
                onChange={(e) => setCustomForm((f) => ({ ...f, apiKey: e.target.value }))}
                helperText={
                  editingCustomModel
                    ? '为了保障您的信息安全，无法查看已保存的密钥，可直接输入新的密钥进行更新。'
                    : ''
                }
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) } }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={customForm.enabled}
                    onChange={(e) => setCustomForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                }
                label="启用该模型"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
            <Button onClick={closeCustomDialog} sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveCustomModel}
              disabled={customSubmitting}
              sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
            >
              {customSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteKeyConfirm)} onClose={() => setDeleteKeyConfirm(null)} fullWidth maxWidth="xs" BackdropProps={{ 'aria-hidden': false }}>
          <DialogTitle sx={{ fontWeight: 700 }}>确认删除 API Key</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              确定要删除 API Key「{deleteKeyConfirm?.name}」吗？删除后无法恢复。
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteKeyConfirm(null)} sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}>
              取消
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteKey}
              disabled={deleteKeyLoading}
              sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
            >
              {deleteKeyLoading ? '删除中...' : '删除'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteCustomConfirm)} onClose={() => setDeleteCustomConfirm(null)} fullWidth maxWidth="xs" BackdropProps={{ 'aria-hidden': false }}>
          <DialogTitle sx={{ fontWeight: 700 }}>确认删除自定义模型</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              确定要删除自定义模型「{deleteCustomConfirm?.name}」吗？删除后无法恢复。
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteCustomConfirm(null)} sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}>
              取消
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteCustomModel}
              disabled={deleteCustomLoading}
              sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
            >
              {deleteCustomLoading ? '删除中...' : '删除'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
