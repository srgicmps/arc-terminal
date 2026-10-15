/// <reference types="node" />
// Presupuesto de peso por vista (job `checks` de los PR, tras `pnpm build`, sin datos): por cada página de
// build/, su HTML y el JS y CSS propios que carga (los `modulepreload`, las hojas de estilo y los import()
// del arranque), comprimidos con gzip como los sirve GitHub Pages. Si alguna pasa de LIMIT, falla.
// Los datos (JSON) y TradingView no cuentan: el peso con datos lo mide la prueba de humo (scripts/smoke.ts).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * Tope por vista, en bytes gzip. Hoy la más pesada (GEO) ronda los 181 KB. Cada ruta nueva engorda un poco el
 * manifiesto de rutas que cargan todas las vistas (las experiencias /x/* añadieron ~2,5 KB a GEO). Sergi lo
 * subió a 300 KB (D45): margen para estéticas y vistas nuevas. Aun así, el CSS de cada estética solo se
 * descarga cuando se elige.
 */
export const LIMIT = 300 * 1024;

/** El JS y el CSS de la propia web que nombra una página: «_app/immutable/…». Sin repetir. */
export function refsOf(html: string): string[] {
	const found = new Set<string>();
	for (const m of html.matchAll(/(?:href|src)="(?:\.\.?\/)*(_app\/immutable\/[^"]+\.(?:js|css))"/g)) found.add(m[1]);
	for (const m of html.matchAll(/import\("(?:\.\.?\/)*(_app\/immutable\/[^"]+\.js)"\)/g)) found.add(m[1]);
	return [...found];
}

/** Peso gzip de cada página .html de `dir`, de la más pesada a la más ligera. */
export async function weigh(dir = 'build'): Promise<{ page: string; bytes: number }[]> {
	const gz = async (path: string) => gzipSync(await readFile(path)).length;
	const pages = (await readdir(dir)).filter((f) => f.endsWith('.html') && f !== '404.html');
	const out = await Promise.all(
		pages.map(async (page) => {
			const html = await readFile(join(dir, page), 'utf8');
			const parts = await Promise.all(refsOf(html).map((r) => gz(join(dir, r)).catch(() => 0)));
			return { page, bytes: gzipSync(html).length + parts.reduce((a, b) => a + b, 0) };
		})
	);
	return out.sort((a, b) => b.bytes - a.bytes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const rows = await weigh();
	const kb = (n: number) => `${Math.round(n / 1024)} KB`;
	for (const r of rows.slice(0, 5)) console.log(`${r.page.padEnd(16)} ${kb(r.bytes)}`);
	const over = rows.filter((r) => r.bytes > LIMIT);
	for (const r of over) console.log(`::error title=Peso de las vistas::${r.page} pesa ${kb(r.bytes)} (gzip, sin datos); el tope es ${kb(LIMIT)} (scripts/weight.ts)`);
	if (over.length) process.exit(1);
	console.log(`${rows.length} vistas por debajo de ${kb(LIMIT)}`);
}
