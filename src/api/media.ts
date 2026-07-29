import { apiPost, apiDelete } from './client';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const MAX_MEDIA_CHUNK_SIZE = 80 * 1024; 
export interface UploadMediaResult {
  id: number;
  url: string;
  size: number;
}
export interface UploadMediaOptions {
  width?: number;
  height?: number;
}
function parseBase64(base64: string): { mimeType: string; pureBase64: string; size: number } {
  const mimeType = base64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const size = Math.floor(pureBase64.length * 0.75);
  return { mimeType, pureBase64, size };
}
async function uploadSingle(name: string, pureBase64: string, mimeType: string, options?: UploadMediaOptions): Promise<UploadMediaResult> {
  const res = await apiPost<UploadMediaResult>('/api/v1/admin/media/upload', {
    name,
    mimeType,
    base64: pureBase64,
    width: options?.width,
    height: options?.height,
  });
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '图片上传失败');
  }
  return res.data;
}
async function uploadChunks(name: string, pureBase64: string, mimeType: string, size: number, options?: UploadMediaOptions): Promise<UploadMediaResult> {
  const chunkCount = Math.ceil(pureBase64.length / MAX_MEDIA_CHUNK_SIZE);
  const initRes = await apiPost<{ id: number }>('/api/v1/admin/media/init', {
    name,
    mimeType,
    size,
    chunkCount,
    width: options?.width,
    height: options?.height,
  });
  if (initRes.code !== 0 || !initRes.data?.id) {
    throw new Error(initRes.msg || '初始化分片上传失败');
  }
  const mediaId = initRes.data.id;
  for (let i = 0; i < chunkCount; i++) {
    const chunkData = pureBase64.slice(i * MAX_MEDIA_CHUNK_SIZE, (i + 1) * MAX_MEDIA_CHUNK_SIZE);
    const chunkRes = await apiPost<unknown>(`/api/v1/admin/media/chunk/${mediaId}`, {
      chunkIndex: i,
      chunkData,
    });
    if (chunkRes.code !== 0) {
      throw new Error(chunkRes.msg || `分片 ${i + 1}/${chunkCount} 上传失败`);
    }
  }
  const finalRes = await apiPost<UploadMediaResult>(`/api/v1/admin/media/finalize/${mediaId}`, {});
  if (finalRes.code !== 0 || !finalRes.data) {
    throw new Error(finalRes.msg || '分片上传合并失败');
  }
  return { ...finalRes.data, size };
}
export async function uploadMedia(name: string, base64: string, options?: UploadMediaOptions): Promise<UploadMediaResult> {
  const { mimeType, pureBase64, size } = parseBase64(base64);
  if (!pureBase64) throw new Error('图片数据为空');
  if (!mimeType.startsWith('image/')) throw new Error('仅支持图片文件');
  const finalName = mimeType === 'image/jpeg' ? name.replace(/\.[^.]+$/, '.jpg') : name;
  if (pureBase64.length <= MAX_MEDIA_CHUNK_SIZE) {
    return uploadSingle(finalName, pureBase64, mimeType, options);
  }
  return uploadChunks(finalName, pureBase64, mimeType, size, options);
}
export async function deleteMedia(id: number): Promise<boolean> {
  const res = await apiDelete<unknown>(`/api/v1/admin/media/${id}`);
  return res.code === 0;
}
export function getMediaUrl(id: number | string): string {
  return `${API_BASE}/api/v1/media/${id}`;
}
export function isMediaUrl(src: string | undefined): boolean {
  if (!src) return false;
  return src.startsWith('/api/v1/media/') || src.startsWith(`${API_BASE}/api/v1/media/`);
}
export function extractMediaId(src: string | undefined): number | null {
  if (!src) return null;
  const match = src.match(/\/api\/v1\/media\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}