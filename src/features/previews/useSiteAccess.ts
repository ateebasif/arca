import { useCallback, useEffect, useState } from 'react';
import { hasSiteAccess, onSiteAccessChange } from '@/src/lib/permissions';

/**
 * Whether the optional all-sites permission is granted (undefined while
 * checking). `refresh` re-checks right away, e.g. after the permission prompt.
 */
export function useSiteAccess(): {
  granted: boolean | undefined;
  refresh(): Promise<void>;
} {
  const [granted, setGranted] = useState<boolean>();
  const refresh = useCallback(async () => {
    setGranted(await hasSiteAccess().catch(() => false));
  }, []);
  useEffect(() => {
    let alive = true;
    void hasSiteAccess()
      .then((g) => alive && setGranted(g))
      .catch(() => alive && setGranted(false));
    const off = onSiteAccessChange((g) => alive && setGranted(g));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { granted, refresh };
}
