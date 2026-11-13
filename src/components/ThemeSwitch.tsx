import type { Theme } from '@/src/lib/theme';
import { useSettings } from '@/src/store/settings';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof SunIcon }> = [
  { value: 'system', label: 'Match system', Icon: MonitorIcon },
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
];

/** System / Light / Dark segmented control. Applies and saves immediately. */
export function ThemeSwitch({ showLabels = false }: { showLabels?: boolean }) {
  const theme = useSettings((s) => s.theme);
  const update = useSettings((s) => s.update);
  return (
    <div role="radiogroup" aria-label="Theme" className="bg-hover flex rounded-lg p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => void update({ theme: value })}
            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-xs transition-colors duration-150 ${
              showLabels ? 'flex-1 px-2.5' : 'w-8'
            } ${active ? 'bg-surface-strong text-ink shadow-(--shadow-tile)' : 'text-ink-muted hover:text-ink'}`}
          >
            <Icon width={14} height={14} />
            {showLabels && (value === 'system' ? 'System' : label)}
          </button>
        );
      })}
    </div>
  );
}
