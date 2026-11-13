/**
 * 平滑滚动控制器：桥接 useSmoothScroll 与外部滚动触发方（目录、回到顶部等）。
 *
 * 项目使用自定义 lerp 平滑滚动（useSmoothScroll）操控 <main> 的 scrollTop。
 * 若目录/按钮直接调用原生 el.scrollTo({ behavior: 'smooth' })，
 * 会与 lerp 循环互相打架：原生 smooth scroll 产生的 scroll 事件会被
 * useSmoothScroll 的 onScroll 误判为用户拖动，从而取消 lerp 动画并重置位置，
 * 导致锚点跳转无效、滚动错位。
 *
 * 这里通过模块级单例把 lerp 滚动能力暴露给外部：
 * - 平滑滚动启用时，调用方命中 controller.scrollTo，走 lerp 动画；
 * - 平滑滚动禁用（触摸设备回退原生滚动）时返回 false，调用方改用原生 scrollTo。
 */

export interface SmoothScrollApi {
  /** 滚动到指定内容偏移（lerp 方式） */
  scrollTo: (target: number) => void;
  /** 重新计算可滚动边界 */
  updateBounds: () => void;
}

let api: SmoothScrollApi | null = null;

export function registerSmoothScroll(instance: SmoothScrollApi | null) {
  api = instance;
}

/**
 * 以与当前滚动系统相兼容的方式滚动到目标偏移。
 * 返回 true 表示已交由 lerp 平滑滚动接管；false 表示需回退到原生滚动。
 */
export function smoothScrollTo(target: number): boolean {
  if (api && api.scrollTo) {
    api.scrollTo(target);
    return true;
  }
  return false;
}

/** 通知滚动系统内容高度可能已变化，重新计算边界 */
export function refreshSmoothScrollBounds() {
  api?.updateBounds?.();
}