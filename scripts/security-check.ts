/**
 * Static security checks on the built extension (run after `bun run build`):
 *
 *   bun run security
 *
 * Fails if the manifest, HTML or bundle drift from Arca's security model:
 * strict CSP, no external messaging, no content scripts or web-accessible
 * resources, no host permissions by default, and no inline/remote/eval code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '.output/chrome-mv3';
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message);
};

const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));

// -- manifest ----------------------------------------------------------------
const ALLOWED_PERMISSIONS = [
  'bookmarks',
  'storage',
  'tabs',
  'topSites',
  'favicon',
  'contextMenus',
];
check(manifest.manifest_version === 3, 'manifest_version must be 3');
check(
  JSON.stringify([...(manifest.permissions ?? [])].sort()) ===
    JSON.stringify([...ALLOWED_PERMISSIONS].sort()),
  `permissions changed: ${JSON.stringify(manifest.permissions)}`,
);
check(!manifest.host_permissions, 'host_permissions must not be granted up front');
check(
  JSON.stringify(manifest.optional_host_permissions) === '["<all_urls>"]',
  'optional_host_permissions must be exactly ["<all_urls>"]',
);
check(!manifest.content_scripts, 'content_scripts are not allowed');
check(!manifest.web_accessible_resources, 'web_accessible_resources are not allowed');
check(
  JSON.stringify(manifest.externally_connectable) === '{"ids":[],"matches":[]}',
  'externally_connectable must block all extensions and sites',
);

const csp: string = manifest.content_security_policy?.extension_pages ?? '';
const directives = new Map(
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .filter((d) => d[0])
    .map(([name, ...values]) => [name, values]),
);
const expect = (name: string, values: string[]) =>
  check(
    JSON.stringify(directives.get(name)) === JSON.stringify(values),
    `CSP ${name} should be "${values.join(' ')}", got "${directives.get(name)?.join(' ')}"`,
  );
expect('script-src', ["'self'"]);
expect('object-src', ["'none'"]);
expect('base-uri', ["'none'"]);
expect('frame-ancestors', ["'none'"]);
expect('form-action', ["'none'"]);
check(
  !/unsafe-(eval|inline)|wasm-unsafe|\*/.test(csp),
  `CSP must not loosen script rules: ${csp}`,
);

// -- HTML ----------------------------------------------------------------------
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
for (const file of files(OUT).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const tag of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    check(
      /\bsrc="\/[^"]+\.js"/.test(tag),
      `${file}: script must be a local file: ${tag}`,
    );
    check(/>\s*<\/script>$/.test(tag), `${file}: inline script content: ${tag}`);
  }
  check(!/\son[a-z]+\s*=/i.test(html), `${file}: inline event handler attribute`);
  check(!/(src|href)="(https?:)?\/\//i.test(html), `${file}: remote resource`);
}

// -- JS bundle -------------------------------------------------------------------
for (const file of files(OUT).filter((f) => f.endsWith('.js'))) {
  const js = readFileSync(file, 'utf8');
  check(!/\beval\s*\(/.test(js), `${file}: eval(`);
  check(!/new\s+Function\s*\(/.test(js), `${file}: new Function(`);
  check(!/import\s*\(\s*["'`]https?:/.test(js), `${file}: remote dynamic import`);
  check(!/importScripts\s*\(/.test(js), `${file}: importScripts`);
  check(
    !/onMessageExternal|onConnectExternal/.test(js),
    `${file}: external message listener`,
  );
}

if (failures.length) {
  console.error(
    `Security check failed (${failures.length}):\n- ${failures.join('\n- ')}`,
  );
  process.exit(1);
}
console.log('Security check passed: manifest, CSP, HTML and bundle look right.');
