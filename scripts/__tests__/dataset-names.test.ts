// Cada nombre de datos escrito a mano tiene que ser una fuente que existe (static/data/<nombre>.json).
// dataset('x') acepta cualquier texto: con un nombre mal escrito devuelve null y el panel desaparece sin
// error, y una regla de avisos con un archivo mal escrito en FILES no salta nunca. Este test lo avisa.
// Mira dataset('x') en src, FILES (y WORLD_FILES) de los avisos y ctx.get('x') de las fuentes derivadas.
// Los nombres con plantilla (`news-${clave}`) no se pueden comprobar así y se dejan fuera.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILES } from '../alerts/rules.ts';
import { loadSources } from '../registry.ts';

/** Archivos de static/data que no salen de una fuente: los escribe update.ts por su cuenta (o news-index.ts). */
const EXTRA = ['status', 'status-history', 'news-index', 'news-countries'];

/** Los .ts y .svelte de una carpeta, sin los tests. */
const code = (dir: string, ext = /\.(ts|svelte)$/) =>
	(readdirSync(dir, { recursive: true }) as string[])
		.map((f) => join(dir, f).replaceAll('\\', '/'))
		.filter((f) => ext.test(f) && !f.endsWith('.test.ts'))
		.map((file) => ({ file, text: readFileSync(file, 'utf8') }));

/** El primer texto fijo de cada llamada (`dataset<T>('x')`, `ctx.get<T>('x')`), con su archivo. */
function calls(files: { file: string; text: string }[], fn: string): { file: string; name: string }[] {
	const re = new RegExp(`${fn}\\s*(?:<[^(]*?>)?\\(\\s*(['"\`])([^'"\`]+)\\1\\s*[,)]`, 'g');
	return files.flatMap(({ file, text }) => [...text.matchAll(re)].filter((m) => !m[2].includes('${')).map((m) => ({ file, name: m[2] })));
}

const names = new Set([...(await loadSources()).map((s) => s.name), ...EXTRA]);
const missing = (list: { file: string; name: string }[]) => list.filter((c) => !names.has(c.name)).map((c) => `${c.file}: ${c.name}`);

describe('nombres de datos', () => {
	it('los que escribe update.ts por su cuenta siguen ahí', () => {
		const text = ['scripts/update.ts', 'scripts/news-index.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
		for (const n of EXTRA) expect(text, n).toContain(`name: '${n}'`);
	});

	it("cada dataset('x') de src pide una fuente que existe", () => {
		const list = calls(code('src'), '\\bdataset');
		expect(list.length).toBeGreaterThan(150);
		expect(missing(list)).toEqual([]);
	});

	it('cada archivo de FILES (avisos) es una fuente que existe', () => {
		const list = Object.entries(FILES).map(([key, name]) => ({ file: `scripts/alerts FILES.${key}`, name }));
		expect(list.length).toBeGreaterThan(30);
		expect(missing(list)).toEqual([]);
	});

	it("cada ctx.get('x') de las fuentes derivadas pide una fuente que existe", () => {
		const list = calls(code('scripts/sources', /\.ts$/), '\\bctx\\??\\.get');
		expect(list.length).toBeGreaterThan(4);
		expect(missing(list)).toEqual([]);
	});

	it('lee bien las llamadas: con genérico, en varias líneas y sin las de plantilla', () => {
		const text = "dataset<Record<string, X>>(\n\t'a'\n); ctx?.get<Y>('b'); dataset(`news-${k}`); dataset<T>(name);";
		expect(calls([{ file: 'x', text }], '\\bdataset').map((c) => c.name)).toEqual(['a']);
		expect(calls([{ file: 'x', text }], '\\bctx\\??\\.get').map((c) => c.name)).toEqual(['b']);
	});
});
