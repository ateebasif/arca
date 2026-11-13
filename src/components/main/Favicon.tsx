import { memo, useState } from 'react';
import { faviconUrl, isDefaultFavicon, letterTile } from '@/src/lib/favicon';

interface FaviconProps {
  url: string;
  title: string;
  /** Rendered size in CSS px. The image is fetched at 2x for sharpness. */
  size?: 16 | 20 | 24 | 32;
  className?: string;
}

/**
 * Site icon from the browser's favicon cache. Falls back to a lettered tile
 * when it fails or when the browser only has its generic placeholder.
 */
export const Favicon = memo(function Favicon({
  url,
  title,
  size = 20,
  className = '',
}: FaviconProps) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <LetterTile url={url} title={title} size={size} className={className} />;
  return (
    <img
      src={faviconUrl(url, size >= 24 ? 64 : 32)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        void isDefaultFavicon(img).then((isDefault) => isDefault && setFailed(true));
      }}
      className={`shrink-0 rounded-[4px] ${className}`}
    />
  );
});

export function LetterTile({
  url,
  title,
  size,
  className = '',
}: Required<Pick<FaviconProps, 'url' | 'title' | 'size'>> & { className?: string }) {
  const { letter, hue } = letterTile(title, url);
  return (
    <span
      aria-hidden="true"
      data-testid="letter-tile"
      className={`grid shrink-0 place-items-center rounded-[5px] font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.55),
        background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 30) % 360} 70% 48%))`,
      }}
    >
      {letter}
    </span>
  );
}
