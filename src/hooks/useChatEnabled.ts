import { useEffect, useState } from 'react';
import { getChatSettings } from '@/api/chat';

/**
 * 聊天室功能总开关。
 * 默认视为关闭（功能默认不开启，管理员在后台打开后才显示入口），设置加载完成后纠正。
 */
export function useChatEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getChatSettings().then((res) => {
      if (cancelled) return;
      if (res.code === 0 && res.data) setEnabled(res.data.enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}