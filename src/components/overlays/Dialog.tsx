import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

interface DialogProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Buttons row. */
  footer: ReactNode;
  role?: 'dialog' | 'alertdialog';
}

/**
 * Modal dialog: traps Tab focus, closes on Escape or backdrop click, and
 * returns focus to whatever was focused before it opened.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  role = 'dialog',
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      '[autofocus], input, select, textarea, button',
    );
    first?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = [
      ...ref.current.querySelectorAll<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => !el.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="animate-pop border-line bg-surface-strong w-full max-w-md rounded-(--radius-panel) border p-5 shadow-(--shadow-pop) backdrop-blur-xl"
      >
        <h2 id={titleId} className="mb-4 text-[15px] font-semibold">
          {title}
        </h2>
        {children}
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function Button({
  variant = 'secondary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles = {
    primary: 'bg-accent-strong text-white hover:opacity-90',
    secondary: 'text-ink hover:bg-hover border border-line',
    danger: 'bg-danger-strong text-white hover:opacity-90',
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={`h-8 rounded-lg px-3.5 text-[13px] font-medium transition-opacity duration-150 disabled:opacity-40 ${styles}`}
    />
  );
}

/**
 * Labelled form field. The child control gets the label as its name, and the
 * error (if any) via aria-describedby, so the name doesn't change on error.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="text-ink-muted mb-1 block text-xs font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <span id={errorId} role="alert" className="text-danger mt-1 block text-xs">
          {error}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  'border-line bg-surface focus:border-accent/50 h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-colors duration-150';
