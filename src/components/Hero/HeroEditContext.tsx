import { createContext, useContext } from 'react';
interface HeroEditContextValue {
  editable: boolean;
}
export const HeroEditContext = createContext<HeroEditContextValue>({ editable: false });
export function useHeroEditContext(): HeroEditContextValue {
  return useContext(HeroEditContext);
}