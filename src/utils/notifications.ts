/**
 * 浏览器 Notification API 的封装。
 *
 * 仅在收到底层 WebSocket 推送时由前端主动触发，不涉及任何后端改动。
 */

/** 浏览器是否支持系统通知（不支持时前端应隐藏开关）。 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * 请求通知权限。
 * 注意：必须在用户手势（如点击开关）中调用，否则部分浏览器会静默拒绝。
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * 弹出一条系统级桌面通知。
 * 权限未授予时静默忽略；点击通知会聚焦回页面。
 */
export function showNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  let notification: Notification;
  try {
    notification = new Notification(
      title,
      {
        body,
        tag: 'chat-room-message',
        // 同 tag 的新通知会替换旧通知；默认替换时不再重新提醒（导致"只有第一条弹"）。
        // 置为 true 才在每次替换时重新弹出/响铃。浏览器支持该项，仅较旧 TS 类型未收录，故断言。
        renotify: true,
      } as NotificationOptions
    );
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // 某些环境（如移动端）可能抛错，忽略即可
  }
}