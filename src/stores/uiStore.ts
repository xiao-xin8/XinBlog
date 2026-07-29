import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSiteStore } from '@/stores/siteStore';
export type PostLayoutMode = 'grid' | 'list' | 'magazine';
interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  postLayout: PostLayoutMode;
  setPostLayout: (layout: PostLayoutMode) => void;
  adminNavHidden: boolean;
  setAdminNavHidden: (hidden: boolean) => void;
  loaded: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<{ postLayout: PostLayoutMode }>) => Promise<boolean>;
}
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      postLayout: 'grid',
      setPostLayout: (layout) => set({ postLayout: layout }),
      adminNavHidden: false,
      setAdminNavHidden: (hidden) => set({ adminNavHidden: hidden }),
      loaded: false,
      loadConfig: async () => {
        const siteLayout = useSiteStore.getState().config.postLayout;
        if (siteLayout && ['grid', 'list', 'magazine'].includes(siteLayout)) {
          set({ postLayout: siteLayout, loaded: true });
          return;
        }
        set({ loaded: true });
      },
      saveConfig: async (newConfig) => {
        const merged = { postLayout: get().postLayout, ...newConfig };
        const ok = await useSiteStore.getState().saveConfig({ postLayout: merged.postLayout });
        if (!ok) return false;
        set({ ...merged, loaded: true });
        return true;
      },
    }),
    {
      name: 'ui-preferences',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        postLayout: state.postLayout,
      }),
    }
  )
);