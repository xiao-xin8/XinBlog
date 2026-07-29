import type { SceneThemeRenderer } from './base';
import { sakuraSceneRenderer } from './sakura';
import { fireflySceneRenderer } from './firefly';
import { oceanSceneRenderer } from './ocean';
import { snowSceneRenderer } from './snow';
const renderers: SceneThemeRenderer[] = [
  sakuraSceneRenderer,
  fireflySceneRenderer,
  oceanSceneRenderer,
  snowSceneRenderer,
];
export function getSceneThemeRenderer(variant?: string): SceneThemeRenderer | undefined {
  if (!variant || variant === 'default') return undefined;
  return renderers.find((r) => r.id === variant || r.aliases?.includes(variant));
}
export function listSceneThemeRenderers(): SceneThemeRenderer[] {
  return renderers.slice();
}
export type { SceneThemeRenderer, SceneRenderContext } from './base';