import { useState } from 'react';
import { normalizeInputUrl } from '@/src/features/editing/url';
import { useOverlays } from '@/src/store/overlays';
import type { OpenDisposition } from '@/src/lib/tabs';
import { useSettings, type NewTabMode } from '@/src/store/settings';
import { ThemeSwitch } from '../ThemeSwitch';
import { Button, Dialog, Field, inputClass } from './Dialog';
import { AiSettings } from '../ai/AiSettings';
import { PreviewSettings } from './PreviewSettings';

const MODES: Array<{ value: NewTabMode; label: string; hint: string }> = [
  { value: 'dashboard', label: 'Dashboard', hint: 'Your bookmarks, every new tab.' },
  { value: 'minimal', label: 'Minimal search page', hint: 'Just a bookmark search box.' },
  { value: 'redirect', label: 'Redirect to a URL', hint: 'Open a page of your choice.' },
];

export function SettingsDialog() {
  const close = useOverlays((s) => s.closeSettings);
  const settings = useSettings();
  const [mode, setMode] = useState(settings.newTabMode);
  const [url, setUrl] = useState(settings.redirectUrl);
  const [error, setError] = useState<string>();

  const save = async () => {
    let redirectUrl = url;
    if (mode === 'redirect') {
      const normalized = normalizeInputUrl(url);
      if (!normalized || !/^https?:/.test(normalized)) {
        setError('Enter a web address, like example.com');
        return;
      }
      redirectUrl = normalized;
    }
    await settings.update({ newTabMode: mode, redirectUrl });
    close();
  };

  return (
    <Dialog
      title="Settings"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <p className="text-ink-muted mb-2 text-xs font-medium">Appearance</p>
        <ThemeSwitch showLabels />
      </div>
      <OpenInSetting />
      <fieldset>
        <legend className="text-ink-muted mb-2 text-xs font-medium">New Tab</legend>
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-default items-start gap-2.5 rounded-lg border px-3 py-2 ${
                mode === m.value ? 'border-accent/40 bg-accent-soft' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="newtab-mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="accent-accent mt-0.5"
              />
              <span>
                <span className="block text-[13px] font-medium">{m.label}</span>
                <span className="text-ink-muted block text-xs">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode === 'redirect' && (
        <div className="mt-3">
          <Field label="Redirect URL" error={error}>
            <input
              className={inputClass}
              value={url}
              placeholder="https://example.com"
              inputMode="url"
              onChange={(e) => {
                setUrl(e.target.value);
                setError(undefined);
              }}
            />
          </Field>
        </div>
      )}
      <PreviewSettings />
      <AiSettings />
      <p className="text-ink-faint mt-3 text-[11px] leading-relaxed">
        Browsers don't let extensions turn their New Tab page off at runtime. To get your
        browser's own New Tab back, disable Arca in the extensions page.
      </p>
    </Dialog>
  );
}

const OPEN_IN: Array<{ value: OpenDisposition; label: string }> = [
  { value: 'current', label: 'Same tab' },
  { value: 'new-tab', label: 'New tab' },
  { value: 'background', label: 'New tab in background' },
  { value: 'window', label: 'Mini window' },
];

/** Where a plain click opens a bookmark. Saved immediately. */
function OpenInSetting() {
  const openIn = useSettings((s) => s.openIn);
  const update = useSettings((s) => s.update);
  return (
    <div className="mb-4">
      <Field label="Open links in">
        <select
          className={inputClass}
          value={openIn}
          onChange={(e) => void update({ openIn: e.target.value as OpenDisposition })}
        >
          {OPEN_IN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-ink-faint -mt-1.5 text-[11px]">
        ⌘-click or middle-click always opens a new background tab.
      </p>
    </div>
  );
}
