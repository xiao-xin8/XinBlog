import { create } from 'zustand';
import { fetchAgentEnabled } from '@/api/ai';

interface AgentStore {
  agentEnabled: boolean;
  loaded: boolean;
  init: () => Promise<void>;
  setAgentEnabled: (v: boolean) => void;
}

/**
 * AI Agent 功能开关的全局响应式状态。
 * 侧边栏/Agent 页面读取，后台保存成功后通过 setAgentEnabled 实时同步，
 * 避免持久化侧边栏组件无法感知开关变化的问题。
 */
export const useAgentStore = create<AgentStore>((set, get) => ({
  agentEnabled: false,
  loaded: false,
  init: async () => {
    if (get().loaded) return;
    const v = await fetchAgentEnabled();
    set({ agentEnabled: v, loaded: true });
  },
  setAgentEnabled: (v) => set({ agentEnabled: v, loaded: true }),
}));