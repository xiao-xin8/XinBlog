import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Skeleton,
  Fade,
  Chip,
  Card,
  CardActionArea,
} from '@mui/material';
import { Groups, People, ChevronRight, LockOutlined, MeetingRoom } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ChatEmptyState from '@/components/Chat/ChatEmptyState';
import {
  getChatSettings,
  getMyChatRooms,
  PUBLIC_CHAT_ROOM_KEY,
  PUBLIC_CHAT_ROOM_NAME,
  ALL_USERS_CHAT_ROOM_KEY,
  ALL_USERS_CHAT_ROOM_NAME,
} from '@/api/chat';
import { useAuthStore } from '@/stores/authStore';
import { AdminFrameFab } from '@/components/Admin/AdminFrameFab';
import type { ChatSettings, CustomChatRoom } from '@/types/interaction';

/**
 * 聊天室列表页（正常页面，带导航栏/页脚）。
 *
 * 聊天拆成两级：/chat 是房间列表，/chat/:roomKey 才是聊天房间（沉浸式）。
 * 列表页只展示房间入口、不发起任何 WebSocket 连接；
 * 只有点击房间进入后，才会在房间页建立连接。
 */
export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isLoggedIn = Boolean(user);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [customRooms, setCustomRooms] = useState<CustomChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const finish = () => {
      if (!loaded) {
        loaded = true;
        if (!cancelled) setLoading(false);
      }
    };
    getChatSettings().then((res) => {
      if (!cancelled && res.code === 0 && res.data) setSettings(res.data);
      finish();
    });
    // 自定义房：仅当前登录用户可见（自己是成员且已启用）
    if (isLoggedIn) {
      getMyChatRooms().then((res) => {
        if (!cancelled && res.code === 0 && res.data?.list) setCustomRooms(res.data.list);
        finish();
      });
    } else {
      finish();
    }
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Skeleton variant="text" width={140} sx={{ fontSize: '1.5rem' }} />
        <Skeleton variant="rectangular" height={96} sx={{ mt: 2, borderRadius: 1 }} />
      </Container>
    );
  }

  const roomEnabled = Boolean(settings?.enabled);
  const publicOpen = roomEnabled && settings!.publicRoomEnabled !== false;
  const membersOpen = roomEnabled && settings!.allUsersRoomEnabled !== false;

  interface RoomRowInfo {
    key: string;
    name: string;
    desc: string;
    cover?: string;
    open: boolean;
    locked: boolean;
    icon?: React.ReactNode;
    memberCount?: number;
    maxUsers?: number;
  }

  // 每个房间一张卡片（横向排版，全宽铺开，分隔清晰但不厚重）
  const roomCard = (info: RoomRowInfo) => {
    const clickable = info.open;
    return (
      <Card
        elevation={0}
        sx={{
          borderRadius: 1,
          border: (t) => `1px solid ${t.palette.divider}`,
          opacity: clickable ? 1 : 0.55,
        }}
      >
        <CardActionArea
          disabled={!clickable}
          onClick={clickable ? () => navigate(`/chat/${encodeURIComponent(info.key)}`) : undefined}
          sx={{ display: 'flex', alignItems: 'center', p: { xs: 1.75, sm: 2.25 }, textAlign: 'left' }}
        >
          {/* 封面缩略图：有封面显示图；无封面用默认封面兜底；内置房用图标 */}
          <Box
            sx={{
              width: 56,
              height: 42,
              flexShrink: 0,
              borderRadius: 1,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {info.cover ? (
              <Box
                component="img"
                src={info.cover}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: 'action.hover' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (t) =>
                    t.palette.mode === 'light'
                      ? 'linear-gradient(135deg, rgba(58, 90, 153, 0.16) 0%, rgba(99, 123, 255, 0.12) 100%)'
                      : 'linear-gradient(135deg, rgba(58, 90, 153, 0.30) 0%, rgba(99, 123, 255, 0.24) 100%)',
                  color: (t) => t.palette.primary.main,
                }}
              >
                {info.icon || <MeetingRoom sx={{ fontSize: 24, opacity: 0.85 }} />}
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, ml: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {info.name}
              </Typography>
              {info.locked &&
                (isLoggedIn ? (
                  <Chip size="small" label="仅登录" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                ) : (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, color: 'text.secondary' }}>
                    <LockOutlined sx={{ fontSize: 14 }} />
                    <Typography variant="caption">登录后进入</Typography>
                  </Box>
                ))}
            </Box>
            {!clickable ? (
              <Typography variant="caption" color="text.secondary">
                暂未开放
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.15 }}>
                <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                  {info.desc}
                </Typography>
                {(info.memberCount !== undefined || info.maxUsers !== undefined) && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {info.memberCount !== undefined && `${info.memberCount} 人`}
                    {info.maxUsers! > 0 && ` / 上限 ${info.maxUsers}`}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          <ChevronRight color="disabled" sx={{ flexShrink: 0, ml: 1 }} />
        </CardActionArea>
      </Card>
    );
  };

  // 统一房间列表（无需区分"专属/公共"区块，全部按顺序排下来）
  const allRooms: RoomRowInfo[] = [];
  for (const r of customRooms) {
    allRooms.push({
      key: r.room_key,
      name: r.name,
      desc: r.description || '专属聊天房',
      cover: r.cover || undefined,
      open: true,
      locked: true,
      memberCount: r.member_count ?? 0,
      maxUsers: r.max_users,
    });
  }
  allRooms.push(
    { key: PUBLIC_CHAT_ROOM_KEY, name: PUBLIC_CHAT_ROOM_NAME, desc: '所有访客均可进入的公共聊天房', open: publicOpen, locked: false, icon: <Groups sx={{ fontSize: 24 }} /> },
    { key: ALL_USERS_CHAT_ROOM_KEY, name: ALL_USERS_CHAT_ROOM_NAME, desc: '仅登录用户可进入的全体聊天房', open: membersOpen, locked: true, icon: <People sx={{ fontSize: 24 }} /> }
  );

  return (
    <Fade in timeout={400}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 }, pb: { xs: 8, md: 12 } }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          全部房间
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          只有你被邀请加入的房间才会显示在这里
        </Typography>

        {!roomEnabled ? (
          <ChatEmptyState title="聊天室功能暂未开放" description="管理员尚未开启聊天室，请耐心等待~" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {allRooms.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {isLoggedIn ? '暂时没有你加入的聊天房' : '登录后可见你被邀请加入的聊天房'}
                </Typography>
              </Box>
            ) : (
              allRooms.map((row) => <Box key={row.key}>{roomCard(row)}</Box>)
            )}
          </Box>
        )}
        {/* 管理员「管理聊天」：右下角悬浮按钮，iframe 弹窗直接载后台（仅站主） */}
        <AdminFrameFab adminPath="/admin/chat?embed=1" label="管理聊天" icon={<Groups />} requireSuper />
      </Container>
    </Fade>
  );
}