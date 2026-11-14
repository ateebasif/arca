/**
 * Minimal Chrome DevTools Protocol driver for end-to-end smoke checks.
 *
 * Launches Chrome (headless, throwaway profile) with --remote-debugging-pipe and
 * loads the built extension with `Extensions.loadUnpacked`, which is the
 * supported path now that branded Chrome ignores --load-extension.
 * No dependencies: Node child_process pipes + JSON.
 *
 * Set CHROME_PATH to use a different Chromium binary.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

type Handler = (msg: { result?: unknown; error?: { message: string } }) => void;
type EventHandler = (params: Record<string, unknown>, sessionId?: string) => void;

class Connection {
  private nextId = 1;
  private pending = new Map<number, Handler>();
  private listeners = new Set<{ method: string; fn: EventHandler }>();
  private buffer = '';

  constructor(
    private input: Writable,
    output: Readable,
  ) {
    output.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let end: number;
      while ((end = this.buffer.indexOf('\0')) !== -1) {
        const raw = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 1);
        this.dispatch(JSON.parse(raw));
      }
    });
  }

  private dispatch(msg: {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    sessionId?: string;
    result?: unknown;
    error?: { message: string };
  }) {
    if (msg.id !== undefined) {
      this.pending.get(msg.id)?.(msg);
      this.pending.delete(msg.id);
      return;
    }
    for (const l of this.listeners) {
      if (l.method === msg.method) l.fn(msg.params ?? {}, msg.sessionId);
    }
  }

  on(method: string, fn: EventHandler) {
    this.listeners.add({ method, fn });
  }

  send<T = unknown>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    this.input.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    return new Promise((res, rej) => {
      // A reply that never comes (e.g. a page stuck mid-navigation) must fail
      // the check with the call that hung, not stall the whole run.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const detail = JSON.stringify(params).slice(0, 160);
        rej(new Error(`${method} got no reply in ${SEND_TIMEOUT_MS / 1000}s: ${detail}`));
      }, SEND_TIMEOUT_MS);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) rej(new Error(`${method}: ${msg.error.message}`));
        else res(msg.result as T);
      });
    });
  }
}

/** Longest any single DevTools call may take. */
const SEND_TIMEOUT_MS = 60_000;

export const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 } as const;

export class Page {
  readonly consoleErrors: string[] = [];
  /** Every URL this page requested (for the no-network audit). */
  readonly requests: string[] = [];

  constructor(
    private conn: Connection,
    readonly sessionId: string,
  ) {
    conn.on('Runtime.exceptionThrown', (params, sid) => {
      if (sid !== sessionId) return;
      const details = params.exceptionDetails as { exception?: { description?: string } };
      this.consoleErrors.push(details.exception?.description ?? 'exception');
    });
    conn.on('Network.requestWillBeSent', (params, sid) => {
      if (sid !== sessionId) return;
      this.requests.push((params.request as { url: string }).url);
    });
    conn.on('Runtime.consoleAPICalled', (params, sid) => {
      if (sid !== sessionId || params.type !== 'error') return;
      const args = params.args as Array<{ value?: unknown; description?: string }>;
      this.consoleErrors.push(
        args.map((a) => String(a.value ?? a.description)).join(' '),
      );
    });
  }

  send<T = unknown>(method: string, params: object = {}): Promise<T> {
    return this.conn.send<T>(method, params, this.sessionId);
  }

  /** Listens for a CDP event on this page. */
  on(method: string, fn: (params: Record<string, unknown>) => void): void {
    this.conn.on(method, (params, sid) => sid === this.sessionId && fn(params));
  }

  /** Evaluates an expression (async allowed) in the page and returns its JSON value. */
  async eval<T = unknown>(expression: string): Promise<T> {
    const result = await this.send<{
      result: { value?: T };
      exceptionDetails?: { exception?: { description?: string }; text?: string };
    }>('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    }
    return result.result.value as T;
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await sleep(150);
    await this.waitFor('document.readyState === "complete"');
  }

  async reload(): Promise<void> {
    await this.send('Page.reload');
    await sleep(150);
    await this.waitFor('document.readyState === "complete"');
  }

  async waitFor(expression: string, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.eval<boolean>(`!!(${expression})`).catch(() => false)) return;
      await sleep(50);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async setViewport(width: number, height: number, dark = false): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
    });
  }

  async screenshot(path: string): Promise<void> {
    // Let CSS transitions (150–200 ms) finish so colours are final.
    await sleep(350);
    const { data } = await this.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
    });
    writeFileSync(path, Buffer.from(data, 'base64'));
  }

  async click(selector: string, opts: { modifiers?: number; clickCount?: number } = {}) {
    const box = await this.eval<{ x: number; y: number } | null>(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) throw new Error(`No element for ${selector}`);
    const base = { x: box.x, y: box.y, button: 'left', modifiers: opts.modifiers ?? 0 };
    const clickCount = opts.clickCount ?? 1;
    for (let i = 1; i <= clickCount; i++) {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        clickCount: i,
        ...base,
      });
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        clickCount: i,
        ...base,
      });
    }
  }

  /** Centre of the first element matching `selector` (scrolled into view). */
  async centerOf(selector: string): Promise<{ x: number; y: number }> {
    const point = await this.eval<{ x: number; y: number } | null>(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error(`No element for ${selector}`);
    return point;
  }

  /** A real pointer drag: press, move in steps, pause, release. */
  async drag(from: string, to: string, modifiers = 0): Promise<void> {
    const a = await this.centerOf(from);
    const b = await this.centerOf(to);
    const mouse = (type: string, x: number, y: number, extra: object = {}) =>
      this.send('Input.dispatchMouseEvent', { type, x, y, modifiers, ...extra });
    await mouse('mouseMoved', a.x, a.y);
    await mouse('mousePressed', a.x, a.y, { button: 'left', buttons: 1, clickCount: 1 });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await mouse(
        'mouseMoved',
        a.x + ((b.x - a.x) * i) / steps,
        a.y + ((b.y - a.y) * i) / steps,
        {
          button: 'left',
          buttons: 1,
        },
      );
      await sleep(16);
    }
    await sleep(150);
    await mouse('mouseReleased', b.x, b.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(250);
  }

  /** Moves the mouse over the centre of an element (or to a far corner). */
  async hover(selector: string | null): Promise<void> {
    const point = selector
      ? await this.eval<{ x: number; y: number } | null>(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`)
      : { x: 5, y: 5 };
    if (!point) throw new Error(`No element for ${selector}`);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  }

  async key(key: string, modifiers = 0): Promise<void> {
    // Match what a real keyboard sends: code "Space" for " ", "KeyA" for "a".
    const code =
      key === ' '
        ? 'Space'
        : key.length === 1 && /[a-z]/i.test(key)
          ? `Key${key.toUpperCase()}`
          : key;
    const base = { key, code, modifiers, windowsVirtualKeyCode: keyCodeFor(key) };
    // Real Enter key presses carry "\r", which Chrome needs for implicit form submit.
    const printable = key === 'Enter' ? '\r' : key.length === 1 ? key : '';
    const text = printable && (modifiers & ~MOD.shift) === 0 ? { text: printable } : {};
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...text });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }

  async type(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }
}

function keyCodeFor(key: string): number {
  const map: Record<string, number> = {
    Enter: 13,
    Escape: 27,
    ArrowUp: 38,
    ArrowDown: 40,
    Backspace: 8,
    Delete: 46,
    F2: 113,
    Tab: 9,
    ' ': 32,
    '/': 191,
    '\\': 220,
  };
  return map[key] ?? key.toUpperCase().charCodeAt(0);
}

export interface Browser {
  extensionId: string;
  /** Ids of extra extensions loaded with `launch({ extraExtensions })`. */
  extraIds: string[];
  open(path: string): Promise<Page>;
  close(): void;
}

export interface LaunchOptions {
  /** Paths of additional unpacked extensions (e.g. a hostile test extension). */
  extraExtensions?: string[];
  /**
   * Test-only: pre-grant the optional <all_urls> permission in the loaded copy,
   * since headless Chrome can't click the permission prompt. The real build
   * keeps it optional (checked by `bun run security`).
   */
  grantSiteAccess?: boolean;
}

export async function launch(options: LaunchOptions = {}): Promise<Browser> {
  const buildPath = resolve('.output/chrome-mv3');
  if (!existsSync(join(buildPath, 'manifest.json'))) {
    throw new Error('Run `bun run build` first.');
  }
  const workDir = mkdtempSync(join(tmpdir(), 'arca-e2e-'));
  // macOS privacy rules can stop Chrome reading ~/Downloads etc., so load a copy.
  const extensionPath = join(workDir, 'extension');
  cpSync(buildPath, extensionPath, { recursive: true });
  if (options.grantSiteAccess) {
    const manifestPath = join(extensionPath, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.host_permissions = ['<all_urls>'];
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }

  const proc: ChildProcess = spawn(
    process.env.CHROME_PATH ?? DEFAULT_CHROME,
    [
      '--headless=new',
      `--user-data-dir=${join(workDir, 'profile')}`,
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );
  const conn = new Connection(proc.stdio[3] as Writable, proc.stdio[4] as Readable);

  const { id: extensionId } = await conn.send<{ id: string }>('Extensions.loadUnpacked', {
    path: extensionPath,
  });
  const extraIds: string[] = [];
  for (const [i, extra] of (options.extraExtensions ?? []).entries()) {
    const copy = join(workDir, `extra-${i}`);
    cpSync(extra, copy, { recursive: true });
    const { id } = await conn.send<{ id: string }>('Extensions.loadUnpacked', {
      path: copy,
    });
    extraIds.push(id);
  }

  return {
    extensionId,
    extraIds,
    async open(path: string) {
      // Absolute URLs (https:, about:, data:…) as-is; anything else is an Arca page.
      const url = /^[a-z][a-z0-9+.-]*:/i.test(path)
        ? path
        : `chrome-extension://${extensionId}/${path}`;
      const { targetId } = await conn.send<{ targetId: string }>('Target.createTarget', {
        url: 'about:blank',
      });
      const { sessionId } = await conn.send<{ sessionId: string }>(
        'Target.attachToTarget',
        {
          targetId,
          flatten: true,
        },
      );
      const page = new Page(conn, sessionId);
      await page.send('Runtime.enable');
      await page.send('Page.enable');
      await page.send('Network.enable');
      await page.navigate(url);
      return page;
    },
    close() {
      proc.kill();
      rmSync(workDir, { recursive: true, force: true });
    },
  };
}
