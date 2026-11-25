import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';

// Security layer 5 (network): a strict Content-Security-Policy on the production build only.
// Firebase AI Logic, Remote Config and App Check talk to *.googleapis.com; reCAPTCHA needs google.com/gstatic.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://www.google.com",
  "frame-src https://www.google.com https://recaptcha.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const csp = (): Plugin => ({
  name: 'csp', apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Security layer 5 (network): Subresource Integrity on the bundled script and stylesheet.
const sri = (): Plugin => ({
  name: 'sri', apply: 'build', enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const bundle = ctx.bundle ?? {};
      const hash = (src: string | Uint8Array) => 'sha384-' + createHash('sha384').update(src).digest('base64');
      return html.replace(/<(script|link)([^>]*?)(src|href)="([^"]*\/assets\/[^"]+)"([^>]*)>/g, (tag, name, pre, attr, url, post) => {
        const file = url.slice(url.indexOf('assets/'));
        const out = bundle[file];
        if (!out || /integrity=/.test(tag)) return tag;
        const body = out.type === 'chunk' ? out.code : (out as { source: string | Uint8Array }).source;
        return `<${name}${pre}${attr}="${url}"${post} integrity="${hash(body)}">`;
      });
    },
  },
});

// Security layer 2 (build obfuscation): minify + mangle, strip console/debugger, never ship source maps.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), csp(), sri()],
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      mangle: { toplevel: true },
      format: { comments: false },
    },
  },
});
