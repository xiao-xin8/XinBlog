import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  Fade,
  Grow,
  Skeleton,
  Slider,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  Delete,
  Edit,
  Add,
  Image as ImageIcon,
  Close,
  ArrowBack,
  Save,
  FormatBold,
  FormatItalic,
  Title,
  Link,
  Code,
  FormatQuote,
  FormatListBulleted,
  FormatListNumbered,
  AutoAwesome,
  AutoAwesomeMotion,
  CheckCircle,
  FormatClear,
  ExpandLess,
  ExpandMore,
  MoreVert,
} from '@mui/icons-material';
import {
  fetchAdminPosts,
  fetchAdminPost,
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
  fetchAdminTags,
  createAdminTag,
} from '@/api/admin';
import { generateAiPost, fetchAiSettings, fetchAiModels, formatOptimize, isTextAiModel, AiGenerateError, type AiGeneratedPost, type AiModel } from '@/api/ai';
import { peekCache } from '@/api/client';
import { uploadMedia, deleteMedia, extractMediaId } from '@/api/media';
import { Loading } from '@/components/Common/Loading';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import type { AdminPost, AdminTag, PagedResult } from '@/api/admin';
import { useSnackbar } from 'notistack';
import { useUIStore } from '@/stores/uiStore';

const MAX_COVER_SIZE = 500 * 1024;
const MAX_INLINE_IMAGE_SIZE = 500 * 1024;

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverBase64: '',
  status: 'published' as 'published' | 'draft',
  tagIds: [] as number[],
};

import { getBase64Size, compressImage } from '@/utils/image';
import { createPortal } from 'react-dom';

function slugifyTag(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}



export function AdminPosts() {
  const theme = useTheme();
  const isMobileAdmin = useMediaQuery(theme.breakpoints.down('lg'));
  const aiAsOverlay = useMediaQuery(theme.breakpoints.down('md'));
  const { enqueueSnackbar } = useSnackbar();
  const postsCache = peekCache<PagedResult<AdminPost>>('/api/v1/admin/posts');
  const tagsCache = peekCache<PagedResult<AdminTag>>('/api/v1/admin/tags');
  const [posts, setPosts] = useState<AdminPost[]>(postsCache.data?.list || []);
  const [tags, setTags] = useState<AdminTag[]>(tagsCache.data?.list || []);
  const [loading, setLoading] = useState(!(postsCache.hit && tagsCache.hit));
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(postsCache.data?.total || 0);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [pendingMediaIds, setPendingMediaIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeCoverDialogOpen, setRemoveCoverDialogOpen] = useState(false);
  const [removeCoverMediaId, setRemoveCoverMediaId] = useState<number | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [inlineImageDialogOpen, setInlineImageDialogOpen] = useState(false);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [inlineImageUrl, setInlineImageUrl] = useState('');
  const [inlineImageUploading, setInlineImageUploading] = useState(false);
  const [editorUseCustomFont, setEditorUseCustomFont] = useState(true);
  const [editorToolbarExpanded, setEditorToolbarExpanded] = useState(true);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editorScrollBoxRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const aiPanelScrollRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  
  const [aiOpen, setAiOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiModel, setAiModel] = useState<string>('');
  const [aiTemperature, setAiTemperature] = useState<number>(0.7);
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(2048);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AiGeneratedPost | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiRawOutput, setAiRawOutput] = useState('');
  const [aiRawExpanded, setAiRawExpanded] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiRegenerateConfirmOpen, setAiRegenerateConfirmOpen] = useState(false);

  
  const [aiFormatResult, setAiFormatResult] = useState<string | null>(null);
  const [aiFormatLoading, setAiFormatLoading] = useState(false);
  const [aiFormatError, setAiFormatError] = useState('');
  const [aiFormatApplying, setAiFormatApplying] = useState(false);
  const [aiShowParams, setAiShowParams] = useState(false);
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const setAdminNavHidden = useUIStore((state) => state.setAdminNavHidden);

  
  
  
  
  useEffect(() => {
    const panel = aiPanelRef.current;
    const box = aiPanelScrollRef.current;
    if (!panel || !box) return;
    const onWheel = (e: WheelEvent) => {
      const inside = box.contains(e.target as Node);
      if (!inside) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const scrollable = box.scrollHeight > box.clientHeight;
      if (!scrollable) {
        e.preventDefault();
      } else {
        const atTop = box.scrollTop <= 0;
        const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
        const reachingEdge = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom);
        if (reachingEdge) e.preventDefault();
      }
      e.stopPropagation();
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, [aiOpen]);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const [postResult, tagResult] = await Promise.all([
      fetchAdminPosts(page + 1, rowsPerPage),
      fetchAdminTags(1, 100),
    ]);
    setPosts(postResult?.list || []);
    setTotal(postResult?.total || 0);
    setTags(tagResult?.list || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData(!(postsCache.hit && tagsCache.hit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage]);

  useEffect(() => {
    if (view !== 'editor') return;
    let cancelled = false;
    Promise.all([fetchAiSettings(), fetchAiModels()]).then(([settings, models]) => {
      if (cancelled) return;
      setAiEnabled(settings?.enabled ?? false);
      if (settings) {
        if (settings.model) setAiModel(settings.model);
        if (settings.temperature !== undefined) setAiTemperature(settings.temperature);
        if (settings.maxTokens !== undefined) setAiMaxTokens(settings.maxTokens);
      }
      const textModels = (models || []).filter((m) => isTextAiModel(m.id));
      setAiModels(textModels);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    setAdminNavHidden(view === 'editor');
    return () => {
      setAdminNavHidden(false);
    };
  }, [view, setAdminNavHidden]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const tagMap = useMemo(() => {
    const map: Record<number, AdminTag> = {};
    tags.forEach((t) => (map[t.id] = t));
    return map;
  }, [tags]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setPendingMediaIds([]);
    setView('editor');
  };

  const handleOpenEdit = async (post: AdminPost) => {
    setFormError('');
    setPendingMediaIds([]);
    setView('editor');
    setEditorLoading(true);
    const full = await fetchAdminPost(post.id);
    setEditorLoading(false);
    if (!full) {
      setFormError('加载文章详情失败');
      setView('list');
      return;
    }
    setEditingId(full.id);
    setForm({
      title: full.title,
      slug: full.slug,
      excerpt: full.excerpt || '',
      content: full.content,
      coverBase64: full.cover_base64 || '',
      status: full.status,
      tagIds: full.tags?.map((t) => t.id) || [],
    });
    setCoverLoading(!!full.cover_base64);
  };

  const handleBackToList = async () => {
    
    for (const mediaId of pendingMediaIds) {
      try {
        await deleteMedia(mediaId);
      } catch {
        // 忽略删除失败
      }
    }
    setPendingMediaIds([]);
    setView('list');
    setFormError('');
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCoverLoading(true);
      const base64 = await compressImage(file, MAX_COVER_SIZE);
      if (getBase64Size(base64) > MAX_COVER_SIZE) {
        setFormError(`封面图片压缩后仍超过 ${Math.round(MAX_COVER_SIZE / 1024)}KB`);
        setCoverLoading(false);
        return;
      }
      const media = await uploadMedia(file.name, base64);
      setForm((prev) => ({ ...prev, coverBase64: media.url }));
      setPendingMediaIds((prev) => [...prev, media.id]);
      setFormError('');
      enqueueSnackbar('封面上传成功', { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '封面图片处理失败';
      setFormError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setCoverLoading(false);
    }
  };

  const handleRemoveCover = () => {
    const mediaId = extractMediaId(form.coverBase64);
    if (mediaId) {
      setRemoveCoverMediaId(mediaId);
      setRemoveCoverDialogOpen(true);
    } else {
      setForm((prev) => ({ ...prev, coverBase64: '' }));
      setCoverLoading(false);
    }
  };

  const handleConfirmRemoveCover = async () => {
    setCoverLoading(true);
    setForm((prev) => ({ ...prev, coverBase64: '' }));
    if (removeCoverMediaId) {
      try {
        await deleteMedia(removeCoverMediaId);
        enqueueSnackbar('封面已从媒体库删除', { variant: 'success' });
        setPendingMediaIds((prev) => prev.filter((id) => id !== removeCoverMediaId));
      } catch {
        enqueueSnackbar('封面已从文章移除，但媒体库删除失败', { variant: 'warning' });
      }
    }
    setCoverLoading(false);
    setRemoveCoverDialogOpen(false);
    setRemoveCoverMediaId(null);
  };

  const handleApplyCoverUrl = () => {
    const url = coverUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setFormError('封面 URL 必须以 http:// 或 https:// 开头');
      return;
    }
    setForm((prev) => ({ ...prev, coverBase64: url }));
    setCoverLoading(true);
    setCoverUrlInput('');
    setFormError('');
  };

  const handleOpenAddTagDialog = () => {
    setNewTagName('');
    setAddTagDialogOpen(true);
  };

  const handleCloseAddTagDialog = () => {
    setAddTagDialogOpen(false);
    setNewTagName('');
  };

  const handleCreateTagFromDialog = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setAddingTag(true);
    const result = await createAdminTag({ name });
    setAddingTag(false);
    if (result.msg) {
      enqueueSnackbar(result.msg, { variant: 'error' });
      return;
    }
    if (result.id) {
      const newTag: AdminTag = { id: result.id, name, slug: slugifyTag(name) };
      setTags((prev) => [...prev, newTag]);
      setForm((prev) => ({ ...prev, tagIds: [...prev.tagIds, result.id!] }));
      enqueueSnackbar('标签创建成功', { variant: 'success' });
    }
    handleCloseAddTagDialog();
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('标题和内容必填');
      return;
    }
    setFormError('');
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content,
      coverBase64: form.coverBase64 || undefined,
      status: form.status,
      tagIds: form.tagIds,
    };

    let result;
    if (editingId) {
      result = await updateAdminPost(editingId, payload);
    } else {
      result = await createAdminPost(payload);
    }

    setSaving(false);

    if (result.msg) {
      setFormError(result.msg);
      enqueueSnackbar(result.msg, { variant: 'error' });
      return;
    }

    enqueueSnackbar(editingId ? '文章已更新' : '文章已创建', { variant: 'success' });
    setPendingMediaIds([]);
    setView('list');
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteAdminPost(deleteId);
    setDeleting(false);
    if (result.msg) {
      enqueueSnackbar(result.msg, { variant: 'error' });
    } else {
      enqueueSnackbar('文章已删除', { variant: 'success' });
    }
    setDeleteId(null);
    await loadData();
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = form.content.substring(start, end);
    const newContent =
      form.content.substring(0, start) + before + selected + after + form.content.substring(end);
    const scrollBox = editorScrollBoxRef.current;
    const savedScrollTop = scrollBox ? scrollBox.scrollTop : 0;
    const savedWindowScrollY = window.scrollY;
    setForm((prev) => ({ ...prev, content: newContent }));
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      const newCursor = start + before.length + selected.length;
      textarea.setSelectionRange(newCursor, newCursor);
      if (scrollBox) scrollBox.scrollTop = savedScrollTop;
      window.scrollTo({ top: savedWindowScrollY, behavior: 'auto' });
    });
  };

  const uploadInlineImage = async (file: File): Promise<string | null> => {
    const base64 = await compressImage(file, MAX_INLINE_IMAGE_SIZE);
    if (getBase64Size(base64) > MAX_INLINE_IMAGE_SIZE) {
      setFormError(`正文图片压缩后仍超过 ${Math.round(MAX_INLINE_IMAGE_SIZE / 1024)}KB`);
      return null;
    }
    const media = await uploadMedia(file.name, base64);
    return media.url;
  };

  const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineImageUploading(true);
    try {
      const url = await uploadInlineImage(file);
      if (!url) return;
      const mediaId = extractMediaId(url);
      if (mediaId) setPendingMediaIds((prev) => [...prev, mediaId]);
      insertMarkdown(`\n![${file.name}](${url})\n`);
      setFormError('');
      enqueueSnackbar('正文图片上传成功', { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '正文图片处理失败';
      setFormError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setInlineImageUploading(false);
    }
  };

  const handleInlineImageFromDialog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleInlineImage(e);
    setInlineImageDialogOpen(false);
  };

  const handleInsertInlineImageUrl = () => {
    const url = inlineImageUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setFormError('图片 URL 必须以 http:// 或 https:// 开头');
      return;
    }
    insertMarkdown(`\n![image](${url})\n`);
    setInlineImageUrl('');
    setFormError('');
    setInlineImageDialogOpen(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        setInlineImageUploading(true);
        try {
          const url = await uploadInlineImage(file);
          if (!url) return;
          const mediaId = extractMediaId(url);
          if (mediaId) setPendingMediaIds((prev) => [...prev, mediaId]);
          insertMarkdown(`\n![image](${url})\n`);
          setFormError('');
        } catch (err) {
          const msg = err instanceof Error ? err.message : '粘贴图片处理失败';
          setFormError(msg);
          enqueueSnackbar(msg, { variant: 'error' });
        } finally {
          setInlineImageUploading(false);
        }
        return;
      }
    }
  };

  const handleAiGenerate = () => {
    const topic = aiTopic.trim();
    if (!topic) {
      setAiError('请输入文章主题');
      return;
    }
    if (aiResult || aiFormatResult) {
      setAiRegenerateConfirmOpen(true);
      return;
    }
    doAiGenerate();
  };

  const doAiGenerate = async () => {
    const topic = aiTopic.trim();
    if (!topic) return;
    setAiRegenerateConfirmOpen(false);
    setAiShowParams(false);
    setAiError('');
    setAiRawOutput('');
    setAiResult(null);
    setAiFormatResult(null);
    setAiFormatError('');
    setAiGenerating(true);
    try {
      const result = await generateAiPost(
        topic,
        tags.map((t) => ({ id: t.id, name: t.name })),
        {
          model: aiModel || undefined,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
          description: aiDescription.trim() || undefined,
        }
      );
      const normalizedTags = (result.tags || [])
        .map((tag: unknown) => {
          if (typeof tag === 'string') return tag;
          if (tag && typeof tag === 'object' && 'name' in tag) return (tag as { name?: string }).name;
          return String(tag);
        })
        .filter((tag): tag is string => Boolean(tag));
      setAiResult({ ...result, tags: normalizedTags });
      setAiRawOutput(result.raw || '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败，请确认 AI 功能已开启且模型可用';
      setAiError(msg);
      if (err instanceof AiGenerateError) {
        const debug = [
          `错误: ${err.message}`,
          err.model ? `模型: ${err.model}` : '',
          err.errorDetail ? `详情: ${err.errorDetail}` : '',
          err.firstError ? `首次错误: ${err.firstError}` : '',
          err.raw ? `原始响应:\n${err.raw}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        setAiRawOutput(debug);
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiApply = async () => {
    if (!aiResult) return;
    setAiApplying(true);

    
    const updatedTags = [...tags];
    const updatedTagIds: number[] = [];
    for (const tagName of aiResult.tags) {
      const existing = updatedTags.find((t) => t.name === tagName);
      if (existing) {
        updatedTagIds.push(existing.id);
      } else {
        const created = await createAdminTag({ name: tagName });
        if (created.id) {
          const newTag: AdminTag = { id: created.id, name: tagName, slug: slugifyTag(tagName) };
          updatedTags.push(newTag);
          updatedTagIds.push(created.id);
        }
      }
    }
    if (updatedTags.length !== tags.length) {
      setTags(updatedTags);
    }

    setForm((prev) => ({
      ...prev,
      title: aiResult.title,
      slug: aiResult.slug || prev.slug,
      excerpt: aiResult.excerpt,
      content: aiResult.content,
      tagIds: updatedTagIds,
    }));
    setAiApplying(false);
    enqueueSnackbar('AI 生成内容已应用', { variant: 'success' });
  };

  const handleAiDiscard = () => {
    setAiResult(null);
    setAiTopic('');
    setAiDescription('');
    setAiError('');
    setAiRawOutput('');
  };

  const handleAiFormat = async () => {
    const content = form.content.trim();
    if (!content) {
      setAiFormatError('当前文章没有内容可供优化');
      return;
    }
    setAiFormatError('');
    setAiFormatLoading(true);
    try {
      const result = await formatOptimize(content, {
        model: aiModel || undefined,
        temperature: aiTemperature,
        maxTokens: aiMaxTokens,
      });
      setAiFormatResult(result.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '格式优化失败，请稍后重试';
      setAiFormatError(msg);
    } finally {
      setAiFormatLoading(false);
    }
  };

  const handleAiFormatApply = () => {
    if (!aiFormatResult) return;
    setAiFormatApplying(true);
    setForm((prev) => ({ ...prev, content: aiFormatResult }));
    setAiFormatApplying(false);
    setAiFormatResult(null);
    enqueueSnackbar('格式优化结果已应用', { variant: 'success' });
  };

  const handleAiFormatDiscard = () => {
    setAiFormatResult(null);
    setAiFormatError('');
  };

  const toolbarItems = [
    { icon: <FormatBold fontSize="small" />, title: '加粗', action: () => insertMarkdown('**', '**') },
    { icon: <FormatItalic fontSize="small" />, title: '斜体', action: () => insertMarkdown('*', '*') },
    { icon: <Title fontSize="small" />, title: '标题', action: () => insertMarkdown('## ', '') },
    { icon: <Link fontSize="small" />, title: '链接', action: () => insertMarkdown('[', '](url)') },
    {
      icon: inlineImageUploading ? <CircularProgress size={18} /> : <ImageIcon fontSize="small" />,
      title: inlineImageUploading ? '上传中' : '图片',
      action: () => setInlineImageDialogOpen(true),
      disabled: inlineImageUploading,
    },
    { icon: <Code fontSize="small" />, title: '代码块', action: () => insertMarkdown('```\n', '\n```') },
    { icon: <FormatQuote fontSize="small" />, title: '引用', action: () => insertMarkdown('> ', '') },
    {
      icon: <FormatListBulleted fontSize="small" />,
      title: '无序列表',
      action: () => insertMarkdown('- ', ''),
    },
    {
      icon: <FormatListNumbered fontSize="small" />,
      title: '有序列表',
      action: () => insertMarkdown('1. ', ''),
    },
  ];

  const aiPanelContent = (
    <Paper
      ref={aiPanelRef}
      elevation={0}
      sx={{
        width: '100%',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
            : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={700}>
            AI 助手
          </Typography>
        </Box>
        <Tooltip title="收起 AI 助手">
          <IconButton size="small" onClick={() => setAiOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        ref={aiPanelScrollRef}
        sx={{ flex: '1 1 auto', overflow: 'auto', overscrollBehavior: 'contain', p: 2, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}
      >
        {!aiEnabled && (
          <Typography variant="body2" color="text.secondary">
            AI 功能尚未开启，请先在「AI 管理」中启用。
          </Typography>
        )}

        <TextField
          label="文章主题"
          placeholder="输入主题，让 AI 生成文章"
          value={aiTopic}
          onChange={(e) => setAiTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAiGenerate();
            }
          }}
          disabled={!aiEnabled || aiGenerating}
          fullWidth
        />

        <TextField
          label="补充描述（可选）"
          placeholder="输入对文章风格、结构、重点等的补充要求"
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          disabled={!aiEnabled || aiGenerating}
          fullWidth
          multiline
          rows={3}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            size="small"
            onClick={() => setAiShowParams((v) => !v)}
            disabled={!aiEnabled}
            sx={{ justifyContent: 'flex-start', px: 1, borderRadius: 1 }}
          >
            {aiShowParams ? '隐藏参数配置' : '展开参数配置'}
          </Button>
          <Collapse in={aiShowParams} timeout={300}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'background.default',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="ai-model-label">生成模型</InputLabel>
                  <Select
                    labelId="ai-model-label"
                    value={aiModel}
                    label="生成模型"
                    onChange={(e) => setAiModel(e.target.value)}
                    disabled={!aiEnabled}
                    sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                  >
                    {aiModels.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.name || m.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      创意度 (Temperature)
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {aiTemperature}
                    </Typography>
                  </Box>
                  <Slider
                    value={aiTemperature}
                    onChange={(_, v) => setAiTemperature(v as number)}
                    min={0}
                    max={2}
                    step={0.1}
                    disabled={!aiEnabled}
                    sx={{ '& .MuiSlider-thumb': { borderRadius: '50%' } }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      最大 Token
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {aiMaxTokens}
                    </Typography>
                  </Box>
                  <Slider
                    value={aiMaxTokens}
                    onChange={(_, v) => setAiMaxTokens(v as number)}
                    min={2048}
                    max={8192}
                    step={256}
                    marks={[
                      { value: 2048, label: '2048' },
                      { value: 4096, label: '4096' },
                      { value: 8192, label: '8192' },
                    ]}
                    disabled={!aiEnabled}
                    sx={{ '& .MuiSlider-thumb': { borderRadius: '50%' } }}
                  />
                </Box>
              </Box>
            </Paper>
          </Collapse>
        </Box>

        {aiFormatError && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 1,
              borderColor: 'error.main',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.06),
            }}
          >
            <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
              {aiFormatError}
            </Typography>
          </Paper>
        )}

        {aiError && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 1,
              borderColor: 'error.main',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.06),
            }}
          >
            <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
              {aiError}
            </Typography>
          </Paper>
        )}

        {aiFormatResult && (
          <Fade in timeout={300}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                格式优化结果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={aiFormatApplying ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                  onClick={handleAiFormatApply}
                  disabled={aiFormatApplying}
                  sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                >
                  {aiFormatApplying ? '应用中...' : '应用'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleAiFormatDiscard}
                  disabled={aiFormatApplying}
                  sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                >
                  丢弃
                </Button>
              </Box>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", monospace', fontSize: '0.85rem' }}>
                  {aiFormatResult}
                </Typography>
              </Paper>
            </Box>
          </Fade>
        )}

        {aiResult && (
          <Fade in timeout={300}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                生成结果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={aiApplying ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                  onClick={handleAiApply}
                  disabled={aiApplying}
                  sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                >
                  {aiApplying ? '应用中...' : '应用'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleAiDiscard}
                  disabled={aiApplying}
                  sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
                >
                  丢弃
                </Button>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  标题
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {String(aiResult.title || '')}
                </Typography>
              </Box>
              {aiResult.excerpt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    摘要
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {String(aiResult.excerpt || '')}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  标签
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {aiResult.tags.map((tagName, idx) => (
                    <Chip
                      key={`${idx}-${String(tagName)}`}
                      label={String(tagName)}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  正文预览
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    overflow: 'auto',
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", monospace', fontSize: '0.85rem' }}>
                    {String(aiResult.content || '')}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Fade>
        )}

        {aiRawOutput && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              size="small"
              onClick={() => setAiRawExpanded((v) => !v)}
              sx={{ justifyContent: 'flex-start', px: 1, borderRadius: 1 }}
            >
              {aiRawExpanded ? '隐藏 AI 原始响应' : '查看 AI 原始响应'}
            </Button>
            <Collapse in={aiRawExpanded}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  maxHeight: 320,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: '"Fira Code", monospace',
                    fontSize: '0.8rem',
                    wordBreak: 'break-word',
                  }}
                >
                  {aiRawOutput}
                </Typography>
              </Paper>
            </Collapse>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          p: 2,
          pt: 1.5,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          variant="contained"
          fullWidth
          startIcon={aiGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeMotion />}
          onClick={handleAiGenerate}
          disabled={!aiEnabled || aiGenerating || !aiTopic.trim()}
          sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
        >
          {aiGenerating ? '生成中...' : '生成文章'}
        </Button>

        <Button
          variant="outlined"
          fullWidth
          startIcon={aiFormatLoading ? <CircularProgress size={16} color="inherit" /> : <FormatClear />}
          onClick={handleAiFormat}
          disabled={!aiEnabled || aiFormatLoading || !form.content.trim()}
          sx={{ borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4) }}
        >
          {aiFormatLoading ? '优化中...' : '优化当前 Markdown'}
        </Button>
      </Box>
    </Paper>
  );

  const editorPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, gap: 2, position: 'relative', overflow: 'hidden' }}>
      <Box ref={editorScrollBoxRef} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', gap: 2, overflow: 'auto', overscrollBehavior: 'contain', pb: { xs: 10, sm: 0 } }}>
      {editorLoading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
            borderRadius: 1,
          }}
        >
          <Loading text="加载文章中..." />
        </Box>
      )}
      {/* 顶部操作栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <IconButton onClick={handleBackToList} aria-label="返回列表" sx={{ width: { xs: 44, sm: 40 }, height: { xs: 44, sm: 40 }, flexShrink: 0 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700, display: { xs: 'none', lg: 'block' }, overflowWrap: 'break-word' }}>
            {editingId ? '编辑文章' : '新建文章'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
          <Tooltip title="AI 助手">
            <IconButton
              onClick={() => setAiOpen((v) => !v)}
              aria-label="打开 AI 助手"
              color={aiOpen ? 'primary' : 'default'}
              sx={{
                width: { xs: 44, sm: 40 },
                height: { xs: 44, sm: 40 },
                bgcolor: aiOpen ? (theme) => alpha(theme.palette.primary.main, 0.12) : 'transparent',
              }}
            >
              <AutoAwesome />
            </IconButton>
          </Tooltip>
          <FormControl size="small" sx={{ minWidth: 120, display: { xs: 'none', sm: 'flex' } }}>
            <InputLabel id="status-label">状态</InputLabel>
            <Select
              labelId="status-label"
              value={form.status}
              label="状态"
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'published' | 'draft' }))}
            >
              <MenuItem value="published">已发布</MenuItem>
              <MenuItem value="draft">草稿</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSave} disabled={saving} sx={{ px: { xs: 2, sm: 3 } }}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Box>

      {formError && (
        <Typography color="error" variant="body2">
          {formError}
        </Typography>
      )}

      {/* 基础信息 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 1,
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <Stack spacing={2}>
          <TextField
            label="标题"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            fullWidth
            required
            placeholder="输入文章标题"
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 240 } }}
              placeholder="留空将自动生成"
            />
            <FormControl sx={{ flex: 1, minWidth: { xs: '100%', sm: 240 } }}>
              <InputLabel id="tags-label">标签</InputLabel>
              <Select
                labelId="tags-label"
                multiple
                value={form.tagIds}
                label="标签"
                onChange={(e) => {
                  const value = typeof e.target.value === 'string' ? [] : (e.target.value as (number | string)[]);
                  if (value.includes('__add_new_tag__')) {
                    handleOpenAddTagDialog();
                    return;
                  }
                  setForm((prev) => ({ ...prev, tagIds: value as number[] }));
                }}
                renderValue={(selected) => (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const tag = tagMap[id];
                      if (!tag) return null;
                      return <Chip key={id} label={tag.name} size="small" sx={{ borderRadius: 1 }} />;
                    })}
                  </Stack>
                )}
              >
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
                {tags.length > 0 && <Box component="li" sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />}
                <MenuItem value="__add_new_tag__" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  <Add fontSize="small" sx={{ mr: 1 }} />
                  添加新标签
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="摘要"
            value={form.excerpt}
            onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
            fullWidth
            multiline
            rows={2}
            placeholder="留空将自动截取正文前 160 字"
          />
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              封面图片（可选）
            </Typography>
            {form.coverBase64 ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                {coverLoading && (
                  <Skeleton
                    variant="rectangular"
                    sx={{ width: { xs: '100%', sm: 200 }, height: { xs: 120, sm: 120 }, borderRadius: 1, position: 'absolute', top: 0, left: 0 }}
                  />
                )}
                <Box
                  component="img"
                  src={form.coverBase64}
                  alt="cover"
                  onLoad={() => setCoverLoading(false)}
                  onError={() => setCoverLoading(false)}
                  sx={{ width: { xs: '100%', sm: 200 }, height: { xs: 'auto', sm: 120 }, maxHeight: { xs: 180, sm: 120 }, objectFit: 'cover', borderRadius: 1, display: 'block' }}
                />
                <IconButton
                  onClick={handleRemoveCover}
                  aria-label="移除封面"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: { xs: 36, sm: 32 },
                    height: { xs: 36, sm: 32 },
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    zIndex: 1,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                <Button variant="outlined" component="label" size="small" startIcon={coverLoading ? <CircularProgress size={16} /> : <ImageIcon />} disabled={coverLoading} sx={{ flexShrink: 0 }}>
                  {coverLoading ? '上传中...' : '上传封面'}
                  <input type="file" accept="image/*" hidden onChange={handleCoverChange} />
                </Button>
                <TextField
                  size="small"
                  placeholder="或输入图片 URL"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCoverUrl();
                    }
                  }}
                  sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
                />
                <Button variant="outlined" size="small" onClick={handleApplyCoverUrl} disabled={!coverUrlInput.trim()} sx={{ flexShrink: 0 }}>
                  使用 URL
                </Button>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* 移动端状态选择：放在编辑器上方，避免文章写太长时看不到 */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          alignItems: 'center',
          gap: 1.5,
          px: 0.5,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="mobile-status-label">状态</InputLabel>
          <Select
            labelId="mobile-status-label"
            value={form.status}
            label="状态"
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'published' | 'draft' }))}
          >
            <MenuItem value="published">已发布</MenuItem>
            <MenuItem value="draft">草稿</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          返回即取消，不会保存修改
        </Typography>
      </Box>

      {/* 编辑器 */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: { xs: 320, md: 480 },
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        {/* 工具栏 + 胶囊 Tab */}
        <Box
          ref={toolbarRef}
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: { xs: 'flex-start', lg: 'center' },
            justifyContent: { xs: 'flex-start', lg: 'space-between' },
            flexDirection: { xs: 'column', lg: 'row' },
            flexWrap: 'wrap',
            gap: 1.5,
            minWidth: 0,
          }}
        >
          <ToggleButtonGroup
            value=""
            size="small"
            sx={{
              flexWrap: 'wrap',
              gap: 0.5,
              '&.MuiToggleButtonGroup-root': {
                flexWrap: 'wrap',
              },
              '& .MuiToggleButtonGroup-grouped': {
                border: 'none',
                borderRadius: '90px !important',
                mx: 0,
              },
            }}
          >
            {/* toolbarItems 的 action 均为点击回调，refs 在事件触发时才访问，非 render 期间访问 */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {toolbarItems.map((item) => (
              <ToggleButton
                key={item.title}
                value={item.title}
                onClick={item.action}
                title={item.title}
                disabled={item.disabled}
                sx={{
                  borderRadius: '90px',
                  minWidth: { xs: 40, sm: 36 },
                  height: { xs: 40, sm: 36 },
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {item.icon}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={editorUseCustomFont}
                  onChange={(e) => setEditorUseCustomFont(e.target.checked)}
                  size="small"
                />
              }
              label="自定义字体"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: { xs: '0.75rem', sm: '0.85rem' } } }}
            />
          </Box>
          <Dialog open={inlineImageDialogOpen} onClose={() => setInlineImageDialogOpen(false)} fullWidth maxWidth="xs" TransitionComponent={Grow} PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }} BackdropProps={{ 'aria-hidden': false }}>
            <DialogTitle sx={{ fontWeight: 700 }}>插入图片</DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Button variant="outlined" component="label" startIcon={inlineImageUploading ? <CircularProgress size={18} /> : <ImageIcon />} disabled={inlineImageUploading} fullWidth sx={{ textTransform: 'none', borderRadius: 2, py: 1 }}>
                  {inlineImageUploading ? '上传中...' : '上传本地图片'}
                  <input type="file" accept="image/*" hidden onChange={handleInlineImageFromDialog} />
                </Button>
                <TextField
                  label="或输入图片 URL"
                  placeholder="https://example.com/image.jpg"
                  value={inlineImageUrl}
                  onChange={(e) => setInlineImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInsertInlineImageUrl();
                    }
                  }}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
                <Button onClick={() => setInlineImageDialogOpen(false)} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
                  取消
                </Button>
                <Button variant="contained" onClick={handleInsertInlineImageUrl} disabled={!inlineImageUrl.trim()} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
                  插入
                </Button>
              </Box>
            </DialogActions>
          </Dialog>
        </Box>

        {/* 编辑区 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <TextField
            inputRef={editorRef}
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            onPaste={handlePaste}
            fullWidth
            multiline
            placeholder="在此输入 Markdown 正文，支持拖拽/粘贴图片"
            sx={{
              width: '100%',
              height: '100%',
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                height: '100%',
                alignItems: 'flex-start',
                p: { xs: 1.5, sm: 2 },
                fontFamily: editorUseCustomFont
                  ? '"Fira Code", monospace'
                  : '"Fira Code", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important',
                fontSize: { xs: '0.9rem', sm: '0.95rem' },
                lineHeight: 1.7,
                '& textarea': editorUseCustomFont
                  ? undefined
                  : {
                      fontFamily:
                        '"Fira Code", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important',
                    },
              },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            }}
          />
        </Box>
      </Paper>

      {/* 右侧可展开/收起的 Markdown 工具栏 */}
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          right: aiOpen && !aiAsOverlay ? { xs: 16, md: 408 } : 16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1150,
          borderRadius: 2,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: 'background.paper',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.35)}`,
        }}
      >
        <Tooltip title={editorToolbarExpanded ? '收起工具栏' : '展开工具栏'} placement="left">
          <IconButton
            size="small"
            onClick={() => setEditorToolbarExpanded((v) => !v)}
            sx={{
              width: 36,
              height: 36,
              color: 'text.secondary',
              borderRadius: '50%',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {editorToolbarExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Collapse in={editorToolbarExpanded} orientation="vertical" timeout={250}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.75, pt: 0 }}>
            {/* toolbarItems 的 action 均为点击回调，refs 在事件触发时才访问，非 render 期间访问 */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {toolbarItems.map((item) => (
              <Tooltip key={item.title} title={item.title} placement="left">
                <span>
                  <IconButton
                    size="small"
                    onClick={item.action}
                    disabled={item.disabled}
                    sx={{
                      width: 40,
                      height: 40,
                      color: 'text.secondary',
                      borderRadius: '50%',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {item.icon}
                  </IconButton>
                </span>
              </Tooltip>
            ))}
          </Box>
        </Collapse>
      </Paper>

      {createPortal(
        <Box
          sx={{
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            zIndex: 1150,
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 1,
            pointerEvents: 'none',
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          {mobileToolbarOpen && (
            <Paper
              elevation={3}
              sx={{
                p: 0.75,
                borderRadius: 2,
                bgcolor: 'background.paper',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                boxShadow: (theme) =>
                  theme.palette.mode === 'light'
                    ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`
                    : `0 4px 20px ${alpha(theme.palette.common.black, 0.35)}`,
                maxHeight: '60vh',
                overflowY: 'auto',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {/* toolbarItems 的 action 均为点击回调，refs 在事件触发时才访问，非 render 期间访问 */}
              {/* eslint-disable-next-line react-hooks/refs */}
              {toolbarItems.map((item) => (
                <Tooltip key={item.title} title={item.title} placement="left">
                  <span>
                    <IconButton
                      size="small"
                      onClick={item.action}
                      disabled={item.disabled}
                      sx={{
                        width: 40,
                        height: 40,
                        color: 'text.secondary',
                        borderRadius: '50%',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {item.icon}
                    </IconButton>
                  </span>
                </Tooltip>
              ))}
            </Paper>
          )}
          <Tooltip title={mobileToolbarOpen ? '收起工具栏' : '展开工具栏'} placement="left">
            <IconButton
              onClick={() => setMobileToolbarOpen((v) => !v)}
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                color: 'text.secondary',
                boxShadow: (theme) =>
                  theme.palette.mode === 'light'
                    ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`
                    : `0 4px 20px ${alpha(theme.palette.common.black, 0.35)}`,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {mobileToolbarOpen ? <Close fontSize="small" /> : <MoreVert />}
            </IconButton>
          </Tooltip>
        </Box>,
        document.body
      )}
    </Box>

    {/* AI 侧边栏抽屉：小屏覆盖，大屏持久推内容 */}
    <Drawer
      anchor="right"
      open={aiOpen}
      onClose={() => setAiOpen(false)}
      variant={aiAsOverlay ? 'temporary' : 'persistent'}
      hideBackdrop={aiAsOverlay}
      ModalProps={{ keepMounted: true }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 360, md: 380 }, height: '100dvh', minHeight: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
    >
      {aiPanelContent}
    </Drawer>

    {/* AI 重新生成确认 */}
    <ConfirmDialog
      open={aiRegenerateConfirmOpen}
      title="确认重新生成？"
      content="当前已有生成结果，重新生成将清空现有内容。是否继续？"
      confirmText="确认生成"
      onClose={() => setAiRegenerateConfirmOpen(false)}
      onConfirm={doAiGenerate}
    />
    </Box>
  );

  const listPanel = (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, overflowWrap: 'break-word' }}>
            文章管理
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
            创建、编辑和管理博客文章
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate} sx={{ px: { xs: 2, sm: 3 } }}>
          新建
        </Button>
      </Box>

      {loading ? (
        <Loading text="加载文章中..." />
      ) : (
        <Fade in timeout={400}>
          {isMobileAdmin ? (
        <Grid container spacing={2}>
          {posts.map((post) => (
            <Grid item xs={12} sm={6} key={post.id}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    theme.palette.mode === 'light'
                      ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, pr: 1, minWidth: 0, overflowWrap: 'break-word' }}>
                      {post.title}
                    </Typography>
                    <Chip
                      label={post.status === 'published' ? '已发布' : '草稿'}
                      size="small"
                      color={post.status === 'published' ? 'success' : 'default'}
                      sx={{ borderRadius: 1, flexShrink: 0 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, overflowWrap: 'break-word' }}>
                    {post.slug}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {post.tags?.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        sx={{
                          borderRadius: 1,
                          backgroundColor: tag.color || undefined,
                          color: tag.color ? '#fff' : undefined,
                        }}
                      />
                    ))}
                    {(!post.tags || post.tags.length === 0) && (
                      <Typography variant="caption" color="text.secondary">
                        无标签
                      </Typography>
                    )}
                  </Stack>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'break-word' }}>
                      {post.views} 阅读 · {new Date(post.created_at).toLocaleDateString('zh-CN')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton onClick={() => handleOpenEdit(post)} sx={{ width: 44, height: 44 }}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleteId(post.id)} sx={{ width: 44, height: 44 }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {posts.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                暂无文章，点击右上角新建
              </Box>
            </Grid>
          )}
        </Grid>
      ) : (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`
              : `0 4px 20px ${alpha(theme.palette.common.black, 0.25)}`,
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>标题</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>标签</TableCell>
                <TableCell>阅读</TableCell>
                <TableCell>创建时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                      {post.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160, display: 'block' }}>
                      {post.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={post.status === 'published' ? '已发布' : '草稿'}
                      size="small"
                      color={post.status === 'published' ? 'success' : 'default'}
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {post.tags?.map((tag) => (
                        <Chip
                          key={tag.id}
                          label={tag.name}
                          size="small"
                          sx={{
                            borderRadius: 1,
                            backgroundColor: tag.color || undefined,
                            color: tag.color ? '#fff' : undefined,
                          }}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{post.views}</TableCell>
                  <TableCell>{new Date(post.created_at).toLocaleDateString('zh-CN')}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(post)} sx={{ width: 40, height: 40 }}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton color="error" onClick={() => setDeleteId(post.id)} sx={{ width: 40, height: 40 }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    暂无文章，点击右上角新建
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 20, 50]}
            labelRowsPerPage="每页"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
            sx={{
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                gap: 1,
                py: 1,
              },
            }}
          />
            )}
          </Paper>
        )}
        </Fade>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteId}
        title="确认删除"
        content="删除后无法恢复，是否继续？"
        confirmText="删除"
        confirmColor="error"
        loading={deleting}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
      {view === 'list' && (
        <Fade in timeout={300}>
          <Box sx={{ flex: '0 0 auto', minWidth: 0 }}>{listPanel}</Box>
        </Fade>
      )}
      {view === 'editor' && (
        <Fade in timeout={400}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              mr: aiOpen && !aiAsOverlay ? { md: '380px' } : 0,
              transition: (theme) =>
                theme.transitions.create('margin', {
                  easing: theme.transitions.easing.easeInOut,
                  duration: theme.transitions.duration.standard,
                }),
            }}
          >
            {editorPanel}
          </Box>
        </Fade>
      )}

      {/* 添加新标签 */}
      <Dialog
        open={addTagDialogOpen}
        onClose={handleCloseAddTagDialog}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Grow}
        PaperProps={{ sx: { borderRadius: { xs: 2, sm: '12px' } } }}
        BackdropProps={{ 'aria-hidden': false }}
        sx={{ zIndex: 1400 }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>添加新标签</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="标签名称"
            placeholder="请输入新标签名称"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateTagFromDialog();
              }
            }}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: { sm: 'flex-end' }, minWidth: 0 }}>
            <Button onClick={handleCloseAddTagDialog} disabled={addingTag} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
              取消
            </Button>
            <Button variant="contained" onClick={handleCreateTagFromDialog} disabled={!newTagName.trim() || addingTag} fullWidth={isMobileAdmin} sx={{ textTransform: 'none', borderRadius: 2 }}>
              {addingTag ? <CircularProgress size={16} color="inherit" /> : '创建'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* 移除封面确认 */}
      <ConfirmDialog
        open={removeCoverDialogOpen}
        title="确认移除封面？"
        content="移除后该图片将从媒体库中删除，是否继续？"
        confirmText="确认移除"
        confirmColor="error"
        loading={coverLoading}
        onClose={() => setRemoveCoverDialogOpen(false)}
        onConfirm={handleConfirmRemoveCover}
      />
    </Box>
  );
}
