import { useEffect, useMemo, useState } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import { useSnackbar } from 'notistack';
import { DEFAULT_MUSIC_CONFIG, isValidPlaylistId } from '@/components/MusicPlayer/musicUtils';
import type { MusicPlayerConfig, MusicPlayMode } from '@/types';

export type MusicTab = 'basic' | 'preview';

export const tabList: { value: MusicTab; label: string }[] = [
  { value: 'basic', label: '基础设置' },
  { value: 'preview', label: '效果预览' },
];

export type MusicEditor = ReturnType<typeof useMusicEditor>;


export function useMusicEditor() {
  const site = useSiteStore();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<MusicTab>('basic');
  const [saving, setSaving] = useState(false);

  const current = site.config.music || DEFAULT_MUSIC_CONFIG;

  const [enabled, setEnabled] = useState(current.enabled);
  const [playlistId, setPlaylistId] = useState(current.playlistId);
  const [volume, setVolume] = useState<number>(current.volume);
  const [playMode, setPlayMode] = useState<MusicPlayMode>(current.playMode);
  const [autoplay, setAutoplay] = useState(current.autoplay);
  const [showLyric, setShowLyric] = useState(current.showLyric);
  const [memory, setMemory] = useState(current.memory);
  const [position, setPosition] = useState<'left' | 'right'>(current.position);
  const [showInAdmin, setShowInAdmin] = useState(current.showInAdmin);
  const [showPage, setShowPage] = useState(current.showPage);
  const [imageProxy, setImageProxy] = useState(current.imageProxy ?? false);
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    const cfg = site.config.music || DEFAULT_MUSIC_CONFIG;
    setEnabled(cfg.enabled);
    setPlaylistId(cfg.playlistId);
    setVolume(cfg.volume);
    setPlayMode(cfg.playMode);
    setAutoplay(cfg.autoplay);
    setShowLyric(cfg.showLyric);
    setMemory(cfg.memory);
    setPosition(cfg.position);
    setShowInAdmin(cfg.showInAdmin);
    setShowPage(cfg.showPage);
    setImageProxy(cfg.imageProxy ?? false);
  }, [site.config.music]);

  const isDirty = useMemo(() => {
    const cfg = site.config.music || DEFAULT_MUSIC_CONFIG;
    return (
      enabled !== cfg.enabled ||
      playlistId.trim() !== cfg.playlistId ||
      volume !== cfg.volume ||
      playMode !== cfg.playMode ||
      autoplay !== cfg.autoplay ||
      showLyric !== cfg.showLyric ||
      memory !== cfg.memory ||
      position !== cfg.position ||
      showInAdmin !== cfg.showInAdmin ||
      showPage !== cfg.showPage ||
      imageProxy !== (cfg.imageProxy ?? false)
    );
  }, [enabled, playlistId, volume, playMode, autoplay, showLyric, memory, position, showInAdmin, showPage, imageProxy, site.config.music]);

  const buildConfig = (): MusicPlayerConfig => ({
    enabled,
    
    apiUrl: DEFAULT_MUSIC_CONFIG.apiUrl,
    playlistId: playlistId.trim(),
    volume: Math.max(0, Math.min(1, Number(volume) || 0)),
    playMode,
    autoplay,
    showLyric,
    memory,
    position,
    showInAdmin,
    showPage,
    imageProxy,
  });

  const resetToDefault = () => {
    const cfg = DEFAULT_MUSIC_CONFIG;
    setEnabled(cfg.enabled);
    setPlaylistId(cfg.playlistId);
    setVolume(cfg.volume);
    setPlayMode(cfg.playMode);
    setAutoplay(cfg.autoplay);
    setShowLyric(cfg.showLyric);
    setMemory(cfg.memory);
    setPosition(cfg.position);
    setShowInAdmin(cfg.showInAdmin);
    setShowPage(cfg.showPage);
    setImageProxy(cfg.imageProxy ?? false);
  };

  const save = async () => {
    if (!isDirty) return true;
    
    const id = playlistId.trim();
    if (id && !isValidPlaylistId(id)) {
      setInputError('歌单 ID 格式不正确，请输入纯数字 ID');
      enqueueSnackbar('请输入有效的歌单 ID', { variant: 'error' });
      return false;
    }
    setSaving(true);
    const ok = await site.saveConfig({ music: buildConfig() });
    setSaving(false);
    if (ok) {
      enqueueSnackbar('音乐播放器设置已保存', { variant: 'success' });
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
    current,
    enabled,
    setEnabled,
    playlistId,
    setPlaylistId,
    volume,
    setVolume,
    playMode,
    setPlayMode,
    autoplay,
    setAutoplay,
    showLyric,
    setShowLyric,
    memory,
    setMemory,
    position,
    setPosition,
    showInAdmin,
    setShowInAdmin,
    showPage,
    setShowPage,
    imageProxy,
    setImageProxy,
    inputError,
    setInputError,
    buildConfig,
    save,
    resetToDefault,
  };
}
