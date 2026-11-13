import { useCallback, useEffect, useRef, useState } from 'react';
import { isNotificationSupported, requestNotificationPermission } from '@/utils/notifications';

const STORAGE_KEY = 'chat-notifications-enabled';

export type ChatNotificationPermission = NotificationPermission | 'unsupported';

export interface UseChatNotificationsResult {
  /** 当前浏览器是否支持系统通知 */
  supported: boolean;
  /** 用户是否开启新消息提醒（默认关闭，持久化到 localStorage） */
  enabled: boolean;
  /** 当前通知权限状态；不支持时为 'unsupported' */
  permission: ChatNotificationPermission;
  /** 切换提醒开关；开启时如未授权会当场请求浏览器权限 */
  setEnabled: (value: boolean) => void;
}

/**
 * 聊天室桌面消息提醒开关。
 *
 * 通用做法：不绑定任何具体房间 key，开关状态全局共享并持久化，
 * 以后新增自定义房间时也无需改动。
 */
export function useChatNotifications(): UseChatNotificationsResult {
  const supported = isNotificationSupported();

  const [permission, setPermission] = useState<ChatNotificationPermission>(() =>
    supported ? Notification.permission : 'unsupported'
  );

  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // 保证在权限被拒绝/重连等异步回调里读到的是最新 enabled 值
  const setEnabledRef = useRef<(value: boolean) => void>(() => {});
  useEffect(() => {
    setEnabledRef.current = (value: boolean) => {
      if (!supported) return;
      setEnabled(value);
      try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch {
        // ignore
      }
    };
  }, [supported]);

  const setEnabledSafe = useCallback(
    (value: boolean) => {
      if (!supported) return;
      setEnabledRef.current(value);
      // 开启时若尚未授权，当场请求权限；被拒绝则回退为关闭
      if (value && Notification.permission !== 'granted') {
        void requestNotificationPermission().then((next) => {
          setPermission(next as NotificationPermission);
          if (next !== 'granted') {
            setEnabled(false);
            try {
              localStorage.setItem(STORAGE_KEY, '0');
            } catch {
              // ignore
            }
          }
        });
      }
    },
    [supported]
  );

  return { supported, enabled, permission, setEnabled: setEnabledSafe };
}