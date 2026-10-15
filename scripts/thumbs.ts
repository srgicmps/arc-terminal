/// <reference types="node" />
// Miniaturas de las vistas para el MANUAL (`node scripts/thumbs.ts`, en la Action que publica, una vez al
// día). Abre cada vista de la web PUBLICADA (datos reales; vale la publicación anterior) a 1280×800 en
// tema oscuro y la guarda reducida (480×300, JPEG) en static/manual/<nombre>.jpg. El manual solo enseña
// las que existen (src/routes/manual/+page.server.ts).
// Nunca falla: si una vista o el navegador dan error, lo dice en el registro y sigue. Cada captura se
// escribe primero en un .tmp y luego se renombra, así nunca queda un .jpg a medias.
// Uso: node scripts/thumbs.ts [raíz de la web] (por defecto, la publicada; p. ej. la de `vite preview`).
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { launch } from './browser.ts';
import { accessHeaders } from './lib.ts';
import { SITE } from './site.ts';

// La web privada, con el service token de Access (sin él, Access no deja pasar).
const ACCESS = accessHeaders();
const ROOT = (process.argv[2] ?? SITE).replace(/\/$/, '');
const DIR = 'static/manual';
/** 1280 px × 0,375 = 480 px de ancho. */
const SCALE = 0.375;
/** Por debajo, la captura está casi en blanco: una vista sin datos ya pesa unos 12 KB. */
const MIN_BYTES = 5 * 1024;

/** Copia de thumbSlug() de src/lib/manual.ts (Node no puede importar ese archivo): «/» → «top», «/eco» → «eco». */
const thumbSlug = (route: string) => route.replace(/\//g, '') || 'top';

/**
 * Las vistas, de las carpetas de src/routes/ que tienen +page.svelte, más la portada. Sin la ficha de un
 * valor (/s, necesita ?sym=) ni el propio manual. No se lee COMMANDS: usa import.meta.glob (solo Vite).
 */
function routes(): string[] {
	const dirs = readdirSync('src/routes', { withFileTypes: true })
		.filter((d) => d.isDirectory() && !['s', 'manual'].includes(d.name) && existsSync(`src/routes/${d.name}/+page.svelte`))
		.map((d) => `/${d.name}`);
	return ['/', ...dirs.sort()];
}

let done = 0;
let total = 0;
try {
	const list = routes();
	total = list.length;
	mkdirSync(DIR, { recursive: true });
	const browser = await launch();
	try {
		const context = await browser.newContext({
			viewport: { width: 1280, height: 800 },
			deviceScaleFactor: SCALE,
			colorScheme: 'dark'
		});
		await context.addInitScript(() => localStorage.setItem('arc-theme', 'dark'));
		// El service token solo va a la propia web, nunca a TradingView ni a otros dominios.
		if (Object.keys(ACCESS).length) {
			const origin = new URL(ROOT).origin;
			await context.route(
				(url) => url.origin === origin,
				(route) => route.continue({ headers: { ...route.request().headers(), ...ACCESS } })
			);
		}
		for (const route of list) {
			const slug = thumbSlug(route);
			const tmp = `${DIR}/${slug}.tmp`;
			const page = await context.newPage();
			try {
				await page.goto(ROOT + route, { waitUntil: 'load', timeout: 20_000 });
				// Que terminen de llegar datos y widgets, sin esperar más de 10 s (TradingView no para nunca).
				await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
				// Avisos (sin fallar) de una miniatura que puede salir vacía: paneles que aún esperan sus datos
				// («… todavía», como en la prueba de humo) o una imagen tan ligera que estará casi en blanco.
				const waiting = await page.locator('.empty', { hasText: 'todavía' }).count().catch(() => 0);
				if (waiting) console.log(`::warning::Miniatura de ${route}: ${waiting} panel(es) sin datos todavía`);
				await page.screenshot({ path: tmp, type: 'jpeg', quality: 70, timeout: 15_000 });
				if (statSync(tmp).size < MIN_BYTES) console.log(`::warning::Miniatura de ${route}: pesa muy poco, puede estar en blanco`);
				renameSync(tmp, `${DIR}/${slug}.jpg`);
				done++;
			} catch (e) {
				console.log(`${route}: sin miniatura (${e instanceof Error ? e.message.split('\n')[0] : e})`);
				rmSync(tmp, { force: true });
			} finally {
				await page.close().catch(() => {});
			}
		}
	} finally {
		await browser.close().catch(() => {});
	}
} catch (e) {
	console.log(`Miniaturas: error general (${e instanceof Error ? e.message.split('\n')[0] : e})`);
}
console.log(`${done}/${total} miniaturas en ${DIR}/`);
process.exit(0);
