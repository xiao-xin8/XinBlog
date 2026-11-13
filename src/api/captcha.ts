// 人机验证相关接口
// 均为公开接口，用原生 fetch 调用，避免 apiGet 缓存导致后台刚保存的配置不能即时生效

export type CaptchaMode = 'none' | 'turnstile' | 'math' | 'geetest' | 'hcaptcha';

export interface CaptchaConfig {
  mode: CaptchaMode;
  loginRequired: boolean;
  registerRequired: boolean;
  forgotRequired: boolean;
  turnstileSiteKey: string;
  geetestCaptchaId: string;
  hcaptchaSiteKey: string;
}

export interface MathCaptcha {
  question: string;
  token: string;
}

// 前端完成验证后传给发码接口的负载
export interface CaptchaPayload {
  mode: CaptchaMode;
  turnstileToken?: string;
  mathToken?: string;
  mathAnswer?: number;
  lotNumber?: string;
  captchaOutput?: string;
  passToken?: string;
  genTime?: string;
  hcaptchaToken?: string;
}

export async function fetchCaptchaConfig(): Promise<CaptchaConfig | null> {
  try {
    const res = await fetch('/api/v1/auth/captcha/config', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 0 || !data.data) return null;
    return data.data as CaptchaConfig;
  } catch {
    return null;
  }
}

export async function fetchMathCaptcha(): Promise<MathCaptcha | null> {
  try {
    const res = await fetch('/api/v1/auth/captcha/math', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 0 || !data.data) return null;
    return data.data as MathCaptcha;
  } catch {
    return null;
  }
}
