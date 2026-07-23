

export function getBase64Size(base64: string): number {
  const head = base64.indexOf(',');
  const len = base64.length - (head + 1);
  return Math.floor(len * 0.75);
}

export function compressImage(file: File, maxSize: number, maxDim = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const scale = Math.min(maxDim / width, maxDim / height, 1);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.92;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        while (getBase64Size(base64) > maxSize && quality > 0.1) {
          quality -= 0.08;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface CompressSourceOptions {
  maxSize: number;
  maxDim: number;
  minQuality: number;
}

export function compressImageSource(src: string, options: CompressSourceOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const scale = Math.min(options.maxDim / width, options.maxDim / height, 1);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.92;
      let base64 = canvas.toDataURL('image/jpeg', quality);
      const step = Math.max(0.02, (0.92 - options.minQuality) / 20);
      while (getBase64Size(base64) > options.maxSize && quality > options.minQuality + step / 2) {
        quality -= step;
        base64 = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(base64);
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}
