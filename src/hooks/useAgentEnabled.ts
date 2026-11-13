import { useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';

/**
 * AI Agent 功能总开关。
 * 从全局 store 读取，后台保存后实时同步；首次挂载时拉取一次。
 */
export function useAgentEnabled() {
  const agentEnabled = useAgentStore((s) => s.agentEnabled);
  const init = useAgentStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return agentEnabled;
}