import type { HeroWidgetConfig } from '@/types';
import { ProfileWidget } from './widgets/ProfileWidget';
import { ClockWidget } from './widgets/ClockWidget';
import { ImageWidget } from './widgets/ImageWidget';
import { HitokotoWidget } from './widgets/HitokotoWidget';
import { MusicWidget } from './widgets/MusicWidget';
import { PostsWidget } from './widgets/PostsWidget';
import { TagsWidget } from './widgets/TagsWidget';

export interface WidgetSize {
  w: number;
  h: number;
  label?: string;
}

export interface PropSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'boolean' | 'select';
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface HeroWidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  sizes: WidgetSize[];
  propSchema: PropSchema[];
  defaultProps: Record<string, unknown>;
  render: (config: HeroWidgetConfig) => React.ReactNode;
}

const definitions: HeroWidgetDefinition[] = [
  {
    id: 'profile',
    name: '个人介绍',
    description: '展示头像、昵称、简介和社交链接',
    sizes: [
      { w: 1, h: 2, label: '1 × 2' },
      { w: 1, h: 3, label: '1 × 3' },
      { w: 2, h: 2, label: '2 × 2' },
      { w: 2, h: 3, label: '2 × 3' },
      { w: 3, h: 3, label: '3 × 3' },
    ],
    propSchema: [
      { key: 'showAvatar', label: '显示头像', type: 'boolean', defaultValue: true },
      { key: 'showTags', label: '显示标签', type: 'boolean', defaultValue: true },
      { key: 'showSocial', label: '显示社交链接', type: 'boolean', defaultValue: true },
      { key: 'greeting', label: '问候语', type: 'text', defaultValue: '你好，我是', placeholder: '你好，我是' },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      showAvatar: true,
      showTags: true,
      showSocial: true,
      greeting: '你好，我是',
      opacity: 0.75,
    },
    render: (config) => <ProfileWidget config={config} />,
  },
  {
    id: 'clock',
    name: '时间日期',
    description: '实时显示当前时间和日期',
    sizes: [
      { w: 1, h: 1, label: '1 × 1' },
      { w: 1, h: 2, label: '1 × 2' },
      { w: 2, h: 1, label: '2 × 1' },
      { w: 2, h: 2, label: '2 × 2' },
    ],
    propSchema: [
      {
        key: 'format',
        label: '时间格式',
        type: 'select',
        defaultValue: '24h',
        options: [
          { label: '24小时制', value: '24h' },
          { label: '12小时制', value: '12h' },
        ],
      },
      { key: 'showSeconds', label: '显示秒数', type: 'boolean', defaultValue: false },
      { key: 'showDate', label: '显示日期', type: 'boolean', defaultValue: true },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      format: '24h',
      showSeconds: false,
      showDate: true,
      opacity: 0.75,
    },
    render: (config) => <ClockWidget config={config} />,
  },
  {
    id: 'image',
    name: '图片展示',
    description: '展示一张图片，可配标题和跳转链接',
    sizes: [
      { w: 1, h: 1, label: '1 × 1' },
      { w: 1, h: 2, label: '1 × 2' },
      { w: 1, h: 3, label: '1 × 3' },
      { w: 2, h: 2, label: '2 × 2' },
      { w: 2, h: 3, label: '2 × 3' },
    ],
    propSchema: [
      { key: 'src', label: '图片地址', type: 'text', defaultValue: '', placeholder: 'https://example.com/image.jpg' },
      { key: 'title', label: '图片标题', type: 'text', defaultValue: '', placeholder: '可选' },
      { key: 'url', label: '跳转链接', type: 'text', defaultValue: '', placeholder: '可选' },
      { key: 'objectFit', label: '填充方式', type: 'select', defaultValue: 'cover', options: [{ label: '覆盖', value: 'cover' }, { label: '包含', value: 'contain' }] },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      src: '',
      title: '',
      url: '',
      objectFit: 'cover',
      opacity: 0.75,
    },
    render: (config) => <ImageWidget config={config} />,
  },
  {
    id: 'hitokoto',
    name: '一言',
    description: '实时获取并展示一句精选语录',
    sizes: [
      { w: 1, h: 1, label: '1 × 1' },
      { w: 1, h: 2, label: '1 × 2' },
      { w: 1, h: 3, label: '1 × 3' },
      { w: 2, h: 1, label: '2 × 1' },
      { w: 2, h: 2, label: '2 × 2' },
    ],
    propSchema: [
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      opacity: 0.75,
    },
    render: (config) => <HitokotoWidget config={config} />,
  },
  {
    id: 'music',
    name: '音乐播放器',
    description: '展示一个迷你音乐播放器，支持单曲音频或网易云歌单 ID',
    sizes: [
      { w: 1, h: 2, label: '1 × 2' },
      { w: 2, h: 1, label: '2 × 1' },
      { w: 2, h: 2, label: '2 × 2' },
      { w: 2, h: 3, label: '2 × 3' },
      { w: 3, h: 2, label: '3 × 2' },
    ],
    propSchema: [
      {
        key: 'mode',
        label: '播放模式',
        type: 'select',
        defaultValue: 'single',
        options: [
          { label: '单曲', value: 'single' },
          { label: '网易云歌单', value: 'netease' },
        ],
      },
      { key: 'src', label: '音频地址', type: 'text', defaultValue: '', placeholder: 'https://example.com/music.mp3' },
      { key: 'title', label: '歌曲名称', type: 'text', defaultValue: '示例音乐', placeholder: '歌曲名称' },
      { key: 'artist', label: '艺术家', type: 'text', defaultValue: '未知艺术家', placeholder: '艺术家' },
      { key: 'cover', label: '封面图片', type: 'text', defaultValue: '', placeholder: '可选' },
      { key: 'songIds', label: '网易云音乐 ID', type: 'textarea', defaultValue: '', placeholder: '多个 ID 用逗号分隔，如 123456, 789012' },
      { key: 'autoplay', label: '自动播放', type: 'boolean', defaultValue: false },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      mode: 'single',
      src: '',
      title: '示例音乐',
      artist: '未知艺术家',
      cover: '',
      songIds: '',
      autoplay: false,
      opacity: 0.75,
    },
    render: (config) => <MusicWidget config={config} />,
  },
  {
    id: 'posts',
    name: '最新文章',
    description: '展示站点最新发布的文章列表',
    sizes: [
      { w: 1, h: 2, label: '1 × 2' },
      { w: 1, h: 3, label: '1 × 3' },
      { w: 2, h: 2, label: '2 × 2' },
      { w: 2, h: 3, label: '2 × 3' },
      { w: 3, h: 3, label: '3 × 3' },
    ],
    propSchema: [
      { key: 'limit', label: '显示数量', type: 'number', defaultValue: 5, min: 1, max: 20, step: 1 },
      { key: 'showCover', label: '显示封面', type: 'boolean', defaultValue: true },
      { key: 'showExcerpt', label: '显示摘要', type: 'boolean', defaultValue: true },
      { key: 'showTags', label: '显示标签', type: 'boolean', defaultValue: true },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      limit: 5,
      showCover: true,
      showExcerpt: true,
      showTags: true,
      opacity: 0.75,
    },
    render: (config) => <PostsWidget config={config} />,
  },
  {
    id: 'tags',
    name: '文章标签',
    description: '展示站点所有文章标签云',
    sizes: [
      { w: 1, h: 1, label: '1 × 1' },
      { w: 1, h: 2, label: '1 × 2' },
      { w: 1, h: 3, label: '1 × 3' },
      { w: 2, h: 1, label: '2 × 1' },
      { w: 2, h: 2, label: '2 × 2' },
    ],
    propSchema: [
      { key: 'limit', label: '显示数量', type: 'number', defaultValue: 20, min: 1, max: 50, step: 1 },
      { key: 'showCount', label: '显示文章数', type: 'boolean', defaultValue: true },
      { key: 'opacity', label: '透明度', type: 'number', defaultValue: 0.75, min: 0.1, max: 1, step: 0.05 },
    ],
    defaultProps: {
      limit: 20,
      showCount: true,
      opacity: 0.75,
    },
    render: (config) => <TagsWidget config={config} />,
  },
];

export function getHeroWidgetDefinitions(): HeroWidgetDefinition[] {
  return definitions;
}

export function getHeroWidgetDefinition(id: string): HeroWidgetDefinition | undefined {
  return definitions.find((d) => d.id === id);
}

export function getHeroWidgetDefaultSize(id: string): WidgetSize {
  const def = getHeroWidgetDefinition(id);
  return def?.sizes[0] || { w: 1, h: 1 };
}

export function getHeroWidgetSize(id: string, w: number, h: number): WidgetSize | undefined {
  const def = getHeroWidgetDefinition(id);
  return def?.sizes.find((s) => s.w === w && s.h === h);
}

export function fillHeroWidgetProps(config: HeroWidgetConfig): HeroWidgetConfig {
  const def = getHeroWidgetDefinition(config.type);
  if (!def) return config;
  const defaultSize = def.sizes[0];
  return {
    ...config,
    w: config.w || defaultSize.w,
    h: config.h || defaultSize.h,
    props: { ...def.defaultProps, ...config.props },
  };
}
