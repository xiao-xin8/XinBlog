import type { ChatBubbleRenderer } from './base';
import { iosBubbleRenderer } from './ios';
import { gradientBubbleRenderer } from './gradient';
import { minimalBubbleRenderer } from './minimal';
import { ticketBubbleRenderer } from './ticket';
import { neonBubbleRenderer } from './neon';
import { glassBubbleRenderer } from './glass';
import { jellyBubbleRenderer } from './jelly';
import { stickyBubbleRenderer } from './sticky';
import { darkBubbleRenderer } from './dark';
import { candyBubbleRenderer } from './candy';
import { mintBubbleRenderer } from './mint';
import { marbleBubbleRenderer } from './marble';
import { gingkoBubbleRenderer } from './gingko';

const renderers: ChatBubbleRenderer[] = [
  iosBubbleRenderer as unknown as ChatBubbleRenderer,
  gradientBubbleRenderer as unknown as ChatBubbleRenderer,
  minimalBubbleRenderer as unknown as ChatBubbleRenderer,
  ticketBubbleRenderer as unknown as ChatBubbleRenderer,
  neonBubbleRenderer as unknown as ChatBubbleRenderer,
  glassBubbleRenderer as unknown as ChatBubbleRenderer,
  jellyBubbleRenderer as unknown as ChatBubbleRenderer,
  stickyBubbleRenderer as unknown as ChatBubbleRenderer,
  darkBubbleRenderer as unknown as ChatBubbleRenderer,
  candyBubbleRenderer as unknown as ChatBubbleRenderer,
  mintBubbleRenderer as unknown as ChatBubbleRenderer,
  marbleBubbleRenderer as unknown as ChatBubbleRenderer,
  gingkoBubbleRenderer as unknown as ChatBubbleRenderer,
];

export function getChatBubbleRenderer(variant?: string): ChatBubbleRenderer | undefined {
  if (!variant || variant === 'default') return undefined;
  return renderers.find((r) => r.id === variant || r.aliases?.includes(variant));
}

export function listChatBubbleRenderers(): ChatBubbleRenderer[] {
  return renderers.slice();
}

export type { ChatBubbleRenderer, ChatBubbleRenderContext, ChatBubbleRenderOutput } from './base';
export { resolveThemeColor, bubbleRadius } from './base';