export interface ClickEffectParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation?: number;
  rotationSpeed?: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
}
