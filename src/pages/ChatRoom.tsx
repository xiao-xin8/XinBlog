import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Loading } from '@/components/Common/Loading';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ChatRoomPanel from '@/components/Chat/ChatRoomPanel';
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
import type { ChatSettings, CustomChatRoom } from '@/types/interaction';

/**
 * 聊天房间页（沉浸式）。
 *
 * 由列表页 /chat 点击房间进入，仅在此时才挂载 ChatRoomPanel、
 * 建立 WebSocket 连接；离开（返回/关闭）即销毁组件并断开连接。
 * 顶栏左侧提供返回按钮回到 /chat 列表页。
 */
export default function ChatRoom() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isLoggedIn = Boolean(user);
  const { roomKey: rawRoomKey } = useParams();
  const roomKey = rawRoomKey ? decodeURIComponent(rawRoomKey) : PUBLIC_CHAT_ROOM_KEY;
  const isMembersRoom = roomKey === ALL_USERS_CHAT_ROOM_KEY;
  const isCustomRoom = roomKey.startsWith('c_');

  const [settings, setSettings] = useState<ChatSettings | null>(null);
  // 自定义房元信息（仅从当前登录用户可见列表里校验成员身份与读取名称）
  const [customRoom, setCustomRoom] = useState<CustomChatRoom | null>(null);
  const [customResolved, setCustomResolved] = useState(!isCustomRoom);
  const [loading, setLoading] = useState(true);

  const roomName = roomKey === PUBLIC_CHAT_ROOM_KEY ? PUBLIC_CHAT_ROOM_NAME : isMembersRoom ? ALL_USERS_CHAT_ROOM_NAME : customRoom?.name || roomKey;

  useEffect(() => {
    let cancelled = false;
    getChatSettings().then((res) => {
      if (cancelled) return;
      if (res.code === 0 && res.data) setSettings(res.data);
    });
    if (isCustomRoom) {
      // 自定义房：只有成员可见列表里能查到才放行
      getMyChatRooms()
        .then((res) => {
          if (cancelled) return;
          const found = res.code === 0 && res.data?.list ? res.data.list.find((r) => r.room_key === roomKey) : undefined;
          if (found) setCustomRoom(found);
          setCustomResolved(true);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setCustomResolved(true);
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [roomKey, isCustomRoom]);

  if (loading) {
    return <Loading fullScreen text="房间加载中..." />;
  }

  const roomEnabled = Boolean(settings?.enabled);
  // 自定义房：独立于公共/全体开关，能否进入取决于是不是成员且该房已启用
  const customOpen = isCustomRoom && customResolved && !!customRoom && !!customRoom.enabled;
  const roomOpen = isCustomRoom ? roomEnabled && customOpen : roomEnabled && (isMembersRoom ? settings!.allUsersRoomEnabled !== false : settings!.publicRoomEnabled !== false);

  // 全体聊天房/自定义房未登录：整页提示登录（防直连 URL 绕过）
  if (roomOpen && (isMembersRoom || isCustomRoom) && !isLoggedIn) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          需要登录
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 320 }}>
          「{roomName}」仅供登录用户使用。请先登录后再进入聊天室。
        </Typography>
        <Button component={Link} to="/admin/login" variant="contained" sx={{ textTransform: 'none', px: 4 }}>
          去登录
        </Button>
      </Box>
    );
  }

  // 自定义房：已登录但并非成员/房间不存在或被停用
  if (roomEnabled && isCustomRoom && customResolved && (!customRoom || !customRoom.enabled)) {
    return (
      <Box sx={{ height: '100dvh', flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <ChatEmptyState title="无权访问该房间" description="该专属聊天房不存在、已停用，或您不在其成员列表中。" />
        <Button variant="text" onClick={() => navigate('/chat')} sx={{ textTransform: 'none', mt: 1 }}>
          返回房间列表
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* 功能总开关关闭：整页空态 */}
      {!roomEnabled && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChatEmptyState title="聊天室功能暂未开放" description="管理员尚未开启聊天室，请耐心等待~" />
        </Box>
      )}

      {/* 功能开启但对应房间开关关闭：空态 */}
      {roomEnabled && roomOpen && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ChatRoomPanel
            roomKey={roomKey}
            roomName={roomName}
            onBack={() => navigate('/chat')}
          />
        </Box>
      )}

      {/* 功能开启但该房间被关闭：空态 */}
      {roomEnabled && !roomOpen && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChatEmptyState
            title={`「${isMembersRoom ? '全体聊天房' : '公共聊天房'}」暂未开放`}
            description="管理员正在整理房间，请稍后再来看看~"
          />
        </Box>
      )}
    </Box>
  );
}