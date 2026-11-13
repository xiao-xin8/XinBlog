export interface ApiResult<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

export interface InteractionSettings {
  commentsEnabled: boolean;
  likesEnabled: boolean;
  commentAudit: boolean;
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  username?: string;
  avatar?: string;
  parentId?: number | null;
  replyToUsername?: string | null;
}

export interface CommentListResponse {
  list: Comment[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminComment extends Comment {
  postTitle: string;
  postSlug: string;
}

export interface AdminCommentListResponse {
  list: AdminComment[];
  total: number;
  page: number;
  limit: number;
}

export interface LikeStatus {
  count: number;
  liked: boolean;
}

// ---------- 留言墙 ----------

export type MessageWallStyle = 'danmaku' | 'flipcard' | 'timetunnel';

export interface MessageWallSettings {
  enabled: boolean;
  allowAnonymous: boolean;
  auditEnabled: boolean;
  defaultStyle: MessageWallStyle;
  // 弹幕展示参数
  danmakuRepeatSec?: number;      // 同一条留言两次上屏的最小冷却间隔（秒）
  danmakuTrackCount?: number;     // 弹幕轨道数
  danmakuSpeedMin?: number;       // 每条轨道最短飞行时长（秒）
  danmakuSpeedMax?: number;       // 每条轨道最长飞行时长（秒）
  danmakuIntervalMin?: number;    // 每条轨道最短推送间隔（秒）
  danmakuIntervalMax?: number;    // 每条轨道最长推送间隔（秒）
}

export interface Message {
  id: number;
  content: string;
  nickname?: string | null;
  userId: number | null;
  username?: string | null;
  avatar?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface MessageListResponse {
  list: Message[];
  total: number;
  page: number;
  limit: number;
}

// ---------- 聊天室 ----------

export interface ChatSettings {
  enabled: boolean; // 功能总开关：控制主页侧边栏是否显示聊天室入口
  publicRoomEnabled: boolean; // 公共聊天房开关：控制无需鉴权可进的公共房是否开放
  allUsersRoomEnabled: boolean; // 全体聊天房开关：控制仅登录用户可进的全员房是否开放
}

export interface ChatRoom {
  key: string;
  name: string;
  enabled: boolean;
}

// 自定义聊天房（后台创建，按成员授权，可设封面与人数上限）
export interface CustomChatRoom {
  room_key: string;
  name: string;
  description: string;
  cover: string; // 封面地址（可为空，空则前端用默认封面）
  max_users: number; // 0 表示不限制
  enabled: number;
  created_at: string;
  updated_at: string;
  member_count?: number; // 成员数（列表接口返回）
}

// 成员选择器的用户项
export interface RoomUserOption {
  id: number;
  username: string;
}

// ---------- 评论邮件通知 ----------

export interface CommentNotifySettings {
  enabled: boolean;
  notifyEmail: string;
  dailyLimit: number;
  reserveForRegister: number;
  notifyAdminOnNew: boolean;
  notifyAdminReply: boolean;
  notifyUserReply: boolean;
}
