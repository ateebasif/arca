import type { ComponentType, SVGProps } from 'react';
import { useFolderIcon } from '@/src/store/folderIcons';
import { FolderIcon } from './icons';

/** A folder's chosen emoji, or the normal folder icon. */
export function FolderGlyph({
  id,
  size = 16,
  className = '',
  fallback: Fallback = FolderIcon,
}: {
  id: string;
  size?: number;
  className?: string;
  fallback?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  const emoji = useFolderIcon(id);
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className="inline-grid shrink-0 place-items-center leading-none"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.9) }}
        data-folder-emoji
      >
        {emoji}
      </span>
    );
  }
  return <Fallback width={size} height={size} className={className} />;
}
