

export interface SmoothScrollApi {
  
  scrollTo: (target: number) => void;
  
  updateBounds: () => void;
}

let api: SmoothScrollApi | null = null;

export function registerSmoothScroll(instance: SmoothScrollApi | null) {
  api = instance;
}


export function smoothScrollTo(target: number): boolean {
  if (api && api.scrollTo) {
    api.scrollTo(target);
    return true;
  }
  return false;
}


export function refreshSmoothScrollBounds() {
  api?.updateBounds?.();
}