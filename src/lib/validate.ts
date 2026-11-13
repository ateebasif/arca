/**
 * Small guards for data read back from storage. Storage is only writable by
 * Arca's own pages, but values can be stale, hand-edited in DevTools, or from
 * an older version, so every field is checked and anything odd falls back to
 * its default.
 */

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function str(value: unknown, fallback: string, maxLength = 2048): string {
  return typeof value === 'string' && value.length <= maxLength ? value : fallback;
}

export function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function idList(value: unknown, fallback: string[], max = 5000): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((v): v is string => typeof v === 'string' && v.length < 64)
    .slice(0, max);
}
