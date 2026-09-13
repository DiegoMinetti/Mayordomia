/**
 * Regression test for the nginx routing layer that fronts the Mayordomía
 * gateway inside the Pi (and locally via docker-compose).
 *
 * Two failure modes this guards against:
 *
 *   1. The frontend posts to `/api/auth/*` (with the `/api/` prefix baked in
 *      via VITE_APPS_SCRIPT_URL) but the gateway only mounts `/auth/*`. The
 *      bridge is the `location /api/` block in nginx — when `proxy_pass` has
 *      no URI part (i.e. `http://upstream:port`), nginx forwards the FULL
 *      request URI unchanged, so `/api/auth/register` reaches the gateway and
 *      gets a 404. With a trailing slash (`http://upstream:port/`), nginx
 *      STRIPS the matched prefix and forwards `/auth/register` correctly.
 *
 *   2. `BootstrapClient` posts to `appsScriptUrl='/api'` (the single-action
 *      dispatcher). nginx's `location /api/` would strip `/api/` and forward
 *      `/` (no such route → 404). An exact-match `location = /api` with
 *      `proxy_pass http://upstream:port/api` keeps the gateway's
 *      `app.post('/api', ...)` route reachable.
 *
 * If anyone removes the trailing slash from the strip block, or drops the
 * exact-match `/api` block, the create-account / bootstrap flows 404 and the
 * frontend shows "Unexpected token '<', '<!DOCTYPE …' is not valid JSON".
 *
 * The parser is intentionally small and tolerant: it splits the conf into
 * `location … { … }` blocks and looks at each block's `proxy_pass` directive.
 * It does NOT validate nginx syntax exhaustively — that's `nginx -t`'s job.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface NginxBlock {
  selector: string;
  body: string;
}

// Tests run with cwd=./gateway (per vitest.config.ts). Resolve both nginx
// files relative to the repo root so we can lint them in one place.
const REPO_ROOT = resolve(process.cwd(), '..');
const NGINX_CONFS = [
  // Used by the docker-compose stack on the Pi (and locally).
  resolve(REPO_ROOT, 'gateway/deploy/web/nginx.conf'),
  // Baked into the mayordomia-web container that GHCR pulls.
  resolve(REPO_ROOT, 'web-image/nginx.conf'),
];

function parseNginxBlocks(source: string): NginxBlock[] {
  const blocks: NginxBlock[] = [];
  // Match `location <selector> { … }` where the closing `}` may be indented
  // (the project's nginx.conf uses 4-space indent inside `server { … }`).
  // Selector can be `= /api`, `~* regex`, or `/prefix`.
  const re =
    /^\s*location\s+(=\s*[^\s{]+|[~^]\s*[^\s{]+|[^\s={^~][^\s{]*)\s*\{([\s\S]*?)\n\s*\}\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    blocks.push({ selector: match[1].trim(), body: match[2] });
  }
  return blocks;
}

function proxyPass(body: string): string | undefined {
  const m = body.match(/^\s*proxy_pass\s+([^;]+);/m);
  return m ? m[1].trim() : undefined;
}

describe('nginx routing — /api/ → gateway prefix strip', () => {
  for (const absPath of NGINX_CONFS) {
    const relPath = absPath.replace(`${REPO_ROOT}/`, '');
    describe(relPath, () => {
      const source = readFileSync(absPath, 'utf8');
      const blocks = parseNginxBlocks(source);

      it('defines a prefix-match `location /api/` block', () => {
        const apiPrefix = blocks.find((b) => b.selector === '/api/');
        expect(
          apiPrefix,
          'expected an nginx `location /api/ { ... }` block to bridge /api/* to the gateway',
        ).toBeDefined();
      });

      it('`location /api/` uses `proxy_pass` with a trailing slash (URI part)', () => {
        const apiPrefix = blocks.find((b) => b.selector === '/api/');
        expect(apiPrefix).toBeDefined();
        const pass = proxyPass(apiPrefix!.body);
        expect(pass, 'expected `proxy_pass` directive inside `location /api/`').toBeDefined();
        // With `proxy_pass http://host:port;` (no URI), nginx forwards the
        // request URI unchanged → /api/auth/register hits the gateway which
        // 404s. The fix is `proxy_pass http://host:port/;` — the trailing
        // slash makes nginx replace the matched `/api/` with `/`, stripping
        // the prefix.
        expect(pass).toMatch(/\/$/);
        expect(pass).not.toMatch(/\/[^/]*\/\/+$/); // no path after the trailing slash
      });
    });
  }
});

describe('nginx routing — exact-match `/api` for the dispatcher', () => {
  for (const absPath of NGINX_CONFS) {
    const relPath = absPath.replace(`${REPO_ROOT}/`, '');
    describe(relPath, () => {
      const source = readFileSync(absPath, 'utf8');
      const blocks = parseNginxBlocks(source);

      it('defines an exact-match `location = /api` block', () => {
        const exact = blocks.find((b) => b.selector === '= /api');
        expect(
          exact,
          'expected an exact-match `location = /api { ... }` block — without it, /api falls through to /api/ which strips to / (404)',
        ).toBeDefined();
      });

      it('`location = /api` proxies to the gateway `/api` route (no prefix strip)', () => {
        const exact = blocks.find((b) => b.selector === '= /api');
        expect(exact).toBeDefined();
        const pass = proxyPass(exact!.body);
        expect(pass).toBeDefined();
        // Must keep `/api` so the gateway's `app.post('/api', ...)` matches.
        expect(pass).toMatch(/\/api$/);
      });
    });
  }
});

describe('nginx routing — Cloudflare HTTPS safety', () => {
  for (const absPath of NGINX_CONFS) {
    const relPath = absPath.replace(`${REPO_ROOT}/`, '');
    describe(relPath, () => {
      const source = readFileSync(absPath, 'utf8');

      it('sets `absolute_redirect off` so 3xx redirects stay on the public HTTPS scheme', () => {
        // When cloudflared tunnels HTTPS in but talks HTTP to nginx, nginx's
        // $scheme is "http". Any 3xx auto-redirect (e.g. trailing-slash on
        // `/api`) would emit an absolute http:// Location, triggering the
        // browser's mixed-content blocker. `absolute_redirect off` makes
        // nginx return relative paths so the browser keeps the HTTPS scheme.
        expect(source).toMatch(/^\s*absolute_redirect\s+off\s*;/m);
      });
    });
  }
});
