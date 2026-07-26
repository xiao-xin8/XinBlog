import { useEffect, useMemo, useState } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import { useSnackbar } from 'notistack';
import type { Live2dConfig } from '@/types';

export type Live2dTab = 'basic' | 'tools' | 'advanced';

export const tabList: { value: Live2dTab; label: string }[] = [
  { value: 'basic', label: '基础设置' },
  { value: 'tools', label: '模型工具' },
  { value: 'advanced', label: '高级选项' },
];

export type Live2dEditor = ReturnType<typeof useLive2dEditor>;

const DEFAULT_LIVE2D_CONFIG: Live2dConfig = {
  enabled: false,
  mobileEnabled: true,
  position: 'right',
  width: 280,
  height: 280,
  tools: ['hitokoto', 'asteroids', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
  drag: false,
  showToggleAfterQuit: true,
  logLevel: 'warn',
  modelSource: 'cdn',
  customCdn: '',
  waifuPath: '/live2d/waifu-tips.json',
  cdnPath: '/live2d-models/',
  cubism2Path: '/live2d/live2d.min.js',
  cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
};

const ALL_TOOLS = [
  { key: 'hitokoto', label: '一言', description: '随机显示一句语录' },
  { key: 'asteroids', label: '飞机大战', description: '在页面上玩小飞机游戏' },
  { key: 'switch-model', label: '切换模型', description: '切换到下一个角色模型' },
  { key: 'switch-texture', label: '切换服装', description: '切换当前模型的服装' },
  { key: 'photo', label: '拍照', description: '给看板娘截图' },
  { key: 'info', label: '信息', description: '查看模型来源信息' },
  { key: 'quit', label: '关闭', description: '隐藏看板娘' },
];

export function useLive2dEditor() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<Live2dTab>('basic');
  const [saving, setSaving] = useState(false);

  const current = site.config.live2d || DEFAULT_LIVE2D_CONFIG;

  const [enabled, setEnabled] = useState(current.enabled);
  const [mobileEnabled, setMobileEnabled] = useState(current.mobileEnabled);
  const [position, setPosition] = useState(current.position);
  const [width, setWidth] = useState(current.width);
  const [height, setHeight] = useState(current.height);
  const [tools, setTools] = useState<string[]>(current.tools);
  const [drag, setDrag] = useState(current.drag);
  const [showToggleAfterQuit, setShowToggleAfterQuit] = useState(current.showToggleAfterQuit);
  const [logLevel, setLogLevel] = useState(current.logLevel);
  const [modelSource, setModelSource] = useState(current.modelSource);
  const [customCdn, setCustomCdn] = useState(current.customCdn || '');

  useEffect(() => {
    const cfg = site.config.live2d || DEFAULT_LIVE2D_CONFIG;
    setEnabled(cfg.enabled);
    setMobileEnabled(cfg.mobileEnabled);
    setPosition(cfg.position);
    setWidth(cfg.width);
    setHeight(cfg.height);
    setTools(cfg.tools);
    setDrag(cfg.drag);
    setShowToggleAfterQuit(cfg.showToggleAfterQuit);
    setLogLevel(cfg.logLevel);
    setModelSource(cfg.modelSource);
    setCustomCdn(cfg.customCdn || '');
  }, [site.config.live2d]);

  const isDirty = useMemo(() => {
    const cfg = site.config.live2d || DEFAULT_LIVE2D_CONFIG;
    if (enabled !== cfg.enabled) return true;
    if (mobileEnabled !== cfg.mobileEnabled) return true;
    if (position !== cfg.position) return true;
    if (width !== cfg.width) return true;
    if (height !== cfg.height) return true;
    if (JSON.stringify(tools.sort()) !== JSON.stringify([...cfg.tools].sort())) return true;
    if (drag !== cfg.drag) return true;
    if (showToggleAfterQuit !== cfg.showToggleAfterQuit) return true;
    if (logLevel !== cfg.logLevel) return true;
    if (modelSource !== cfg.modelSource) return true;
    if (customCdn !== (cfg.customCdn || '')) return true;
    return false;
  }, [
    enabled,
    mobileEnabled,
    position,
    width,
    height,
    tools,
    drag,
    showToggleAfterQuit,
    logLevel,
    modelSource,
    customCdn,
    site.config.live2d,
  ]);

  const isToolEnabled = (key: string) => tools.includes(key);

  const toggleTool = (key: string) => {
    setTools((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const buildConfig = (): Live2dConfig => ({
    enabled,
    mobileEnabled,
    position,
    width,
    height,
    tools,
    drag,
    showToggleAfterQuit,
    logLevel,
    modelSource,
    customCdn: customCdn.trim(),
    waifuPath: DEFAULT_LIVE2D_CONFIG.waifuPath,
    cdnPath: DEFAULT_LIVE2D_CONFIG.cdnPath,
    cubism2Path: DEFAULT_LIVE2D_CONFIG.cubism2Path,
    cubism5Path: DEFAULT_LIVE2D_CONFIG.cubism5Path,
  });

  const resetToDefault = () => {
    const cfg = DEFAULT_LIVE2D_CONFIG;
    setEnabled(cfg.enabled);
    setMobileEnabled(cfg.mobileEnabled);
    setPosition(cfg.position);
    setWidth(cfg.width);
    setHeight(cfg.height);
    setTools(cfg.tools);
    setDrag(cfg.drag);
    setShowToggleAfterQuit(cfg.showToggleAfterQuit);
    setLogLevel(cfg.logLevel);
    setModelSource(cfg.modelSource);
    setCustomCdn(cfg.customCdn || '');
  };

  const save = async () => {
    if (!isDirty) return true;
    setSaving(true);
    const config = buildConfig();
    const ok = await site.saveConfig({ live2d: config });
    setSaving(false);
    if (ok) {
      enqueueSnackbar('看板娘设置已保存', { variant: 'success' });
    } else {
      enqueueSnackbar('保存失败，请稍后再试', { variant: 'error' });
    }
    return ok;
  };

  return {
    tab,
    setTab,
    saving,
    isDirty,
    enabled,
    setEnabled,
    mobileEnabled,
    setMobileEnabled,
    position,
    setPosition,
    width,
    setWidth,
    height,
    setHeight,
    tools,
    setTools,
    drag,
    setDrag,
    showToggleAfterQuit,
    setShowToggleAfterQuit,
    logLevel,
    setLogLevel,
    modelSource,
    setModelSource,
    customCdn,
    setCustomCdn,
    isToolEnabled,
    toggleTool,
    save,
    resetToDefault,
    allTools: ALL_TOOLS,
  };
}
