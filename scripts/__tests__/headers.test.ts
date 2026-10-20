// Cabeceras de Cloudflare Pages (static/_headers): caché de un año solo para lo que lleva hash en el
// nombre, y frame-ancestors 'self' (nunca 'none': Arc OS abre las vistas en iframes del mismo origen).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILE = 'static/_headers';

type Rule = { path: string; headers: Record<string, string> };

/** Lee el archivo como Pages: sin líneas vacías ni comentarios; una ruta y debajo «Nombre: valor». */
function parse(text: string): Rule[] {
	const rules: Rule[] = [];
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		if (/^(\/|[a-z]+:\/\/)/.test(line)) {
			rules.push({ path: line, headers: {} });
			continue;
		}
		const at = line.indexOf(':');
		const rule = rules.at(-1);
		if (at < 1 || !rule) throw new Error(`Línea que Pages no entiende: «${line}»`);
		rule.headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
	}
	return rules;
}

/** El comodín * de Pages vale cualquier cosa (también /), en cualquier punto de la ruta. */
const matches = (rule: string, path: string) =>
	new RegExp(`^${rule.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(path);

const maxAge = (rule: Rule) => Number(/max-age=(\d+)/.exec(rule.headers['cache-control'] ?? '')?.[1] ?? 0);

/** Las únicas reglas con caché larga: archivos cuyo nombre cambia si cambia el contenido. */
const HASHED = ['/_app/immutable/*', '/engine/stockfish-*'];

describe('static/_headers', () => {
	it('existe (adapter-static lo copia a build/ y Pages lo aplica)', () => {
		expect(existsSync(FILE)).toBe(true);
	});

	const rules = existsSync(FILE) ? parse(readFileSync(FILE, 'utf8')) : [];
	const rule = (path: string) => rules.find((r) => r.path === path);

	it('_app/immutable y el motor de ajedrez: un año, private e immutable', () => {
		for (const path of HASHED) {
			const value = rule(path)?.headers['cache-control'] ?? '';
			expect(value, path).toContain('max-age=31536000');
			expect(value, path).toContain('immutable');
			// private: la web va detrás de Access, que no lo guarde una caché compartida.
			expect(value, path).toContain('private');
		}
	});

	it('ninguna otra regla guarda en caché', () => {
		const others = rules.filter((r) => !HASHED.includes(r.path) && maxAge(r) > 0);
		expect(others.map((r) => r.path)).toEqual([]);
	});

	it('lo que no lleva hash se revalida siempre', () => {
		const fresh = [
			'/',
			'/index.html',
			'/eco',
			'/eco.html',
			'/__data.json',
			'/eco/__data.json',
			'/data/top.json',
			'/data/fuel/07.json',
			'/estilos/grafito.css',
			'/_app/version.json',
			'/service-worker.js',
			'/manifest.webmanifest',
			'/favicon.svg',
			'/icon-192.png',
			'/engine/README.txt',
			'/engine/license.txt'
		];
		for (const path of fresh) {
			const cached = rules.filter((r) => matches(r.path, path) && maxAge(r) > 0).map((r) => r.path);
			expect(cached, path).toEqual([]);
		}
		expect(matches('/_app/immutable/*', '/_app/immutable/chunks/abc123.js')).toBe(true);
	});

	it('los archivos del motor que se guardan un año llevan versión y commit en el nombre', () => {
		const files = readdirSync('static/engine').filter((f) => matches('/engine/stockfish-*', `/engine/${f}`));
		expect(files.length).toBeGreaterThan(0);
		for (const f of files) expect(f).toMatch(/^stockfish-\d+(\.\d+)*-.+-[0-9a-f]{7,}\.(js|wasm)$/);
	});

	it("seguridad en todo lo estático: nosniff y frame-ancestors 'self'", () => {
		const all = rule('/*');
		expect(all?.headers['x-content-type-options']).toBe('nosniff');
		expect(all?.headers['content-security-policy']).toContain("frame-ancestors 'self'");
	});

	it("nunca 'none', X-Frame-Options: DENY ni una CSP completa (rompería Arc OS, TradingView o Stockfish)", () => {
		for (const r of rules) {
			const csp = r.headers['content-security-policy'] ?? '';
			expect(csp, r.path).not.toContain("'none'");
			expect(csp, r.path).not.toMatch(/(script|default|style|connect|frame)-src/);
			expect(r.headers['x-frame-options'] ?? '', r.path).not.toMatch(/deny/i);
		}
	});
});
