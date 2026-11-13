import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  onClick(): void;
  pressed?: boolean;
  /** Visible text next to the icon (the label is still used for a11y). */
  text?: string;
  children: ReactNode;
}

export function IconButton({ label, onClick, pressed, text, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg transition-colors duration-150 ${
        text ? 'px-2.5 text-[13px]' : 'w-8 justify-center'
      } ${
        pressed
          ? 'bg-accent-soft text-accent'
          : 'text-ink-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {children}
      {text}
    </button>
  );
}
