import { useEffect, useState } from 'react';
import { coverGradient, type CoverTone } from '@/src/lib/color';
import { fallbackTone, faviconTone } from '@/src/lib/favicon';

/** Cover gradient + hover glow for a bookmark, from its favicon's brand hue. */
export function useCover(url: string, title: string) {
  const [tone, setTone] = useState<CoverTone>(() => fallbackTone(title, url));
  useEffect(() => {
    let alive = true;
    void faviconTone(url, title).then((t) => alive && setTone(t));
    return () => {
      alive = false;
    };
  }, [url, title]);
  return coverGradient(tone);
}
