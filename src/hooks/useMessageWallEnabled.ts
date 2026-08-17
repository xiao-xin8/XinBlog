import { useEffect, useState } from 'react';
import { getMessageWallSettings } from '@/api/messages';





export function useMessageWallEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMessageWallSettings().then((res) => {
      if (cancelled) return;
      if (res.code === 0 && res.data) setEnabled(res.data.enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
