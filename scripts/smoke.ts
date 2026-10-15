/// <reference types="node" />
// Prueba de humo de todas las vistas (`pnpm smoke`, después de `pnpm build`). Arranca `vite preview`, abre
// cada vista de build/ y la ficha de NVDA a 390 y 1280 px con Chromium, y falla si:
// - hay errores en la consola o excepciones sin capturar;
// - a 390 px la página es más ancha que la pantalla (scroll horizontal);
// - sale «NaN», «undefined», «Infinity» o «[object Object]» en el texto de la vista;
// - la vista no tiene paneles o alguno dice «… todavía» (le faltan sus datos). Una fuente que ha respondido
//   sin nada que contar (hoy no hay terremotos ni avisos) tiene que decirlo con otro aviso, sin «todavía».
// Además avisa (sin fallar) si una vista pesa más de WEIGHT_LIMIT: lo que descarga de la propia web
// (HTML, JS, CSS y datos) comprimido con gzip, como lo sirve GitHub Pages; sin TradingView ni otras webs.
// También avisa (sin fallar, de momento) de los fallos de accesibilidad de axe-core en contraste y nombres de
// controles, enlaces e imágenes (AXE_RULES), a 390 px.
// Las peticiones a otras webs (TradingView, fuentes…) se contestan vacías: así la prueba no depende de la red.
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { launch, preview, viewPaths } from './browser.ts';

const PATHS = [...viewPaths(), '/s?sym=NVDA'];
const WIDTHS = [390, 1280];
/** Los dos modos (src/lib/modo.ts): Sencillo enseña menos paneles y letra mayor; Terminal, todo. */
const MODES = ['sencillo', 'terminal'] as const;
/** Vistas de texto, sin paneles. */
const NO_PANELS = new Set(['/help', '/doc']);
/** Peso máximo razonable de una vista en el móvil (4G), en bytes gzip. */
const WEIGHT_LIMIT = 300 * 1024;
/** Reglas de axe-core que se miran: contraste y que todo control, enlace e imagen tenga nombre o etiqueta. */
const AXE_RULES = ['color-contrast', 'label', 'select-name', 'button-name', 'link-name', 'image-alt', 'input-button-name', 'aria-input-field-name'];
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

const { server, root: ROOT } = await preview(4317);
const failures: string[] = [];
const warnings: string[] = [];
/** Fallos de accesibilidad por vista (axe-core): solo avisan. */
const a11y: string[] = [];

try {
	const browser = await launch();
	for (const mode of MODES)
	for (const width of WIDTHS) {
		const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
		await context.addInitScript((m) => localStorage.setItem('arc-modo', m), mode);
		// Peso y accesibilidad se miran una vez, en el primer modo.
		const first = mode === MODES[0];
		await context.route('**/*', (route) => {
			const url = new URL(route.request().url());
			// /api/* son Pages Functions: en vite preview no existen. Una respuesta vacía (sin JSON) es «sin cuenta».
			const local = url.hostname === 'localhost' && !url.pathname.startsWith('/api/');
			return local ? route.continue() : route.fulfill({ status: 200, body: '' });
		});
		for (const path of PATHS) {
			const where = `${path} a ${width} px (${mode})`;
			const page = await context.newPage();
			page.on('console', (m) => {
				if (m.type() === 'error') failures.push(`${where}: consola: ${m.text()} (${m.location().url})`);
			});
			page.on('pageerror', (e) => failures.push(`${where}: excepción: ${e.message}`));
			// Peso de la vista: cada respuesta de la propia web, comprimida (también las que el navegador ya tenía
			// en caché de una vista anterior, para medir la vista como si se abriera en frío).
			const sizes: Promise<number>[] = [];
			page.on('response', (res) => {
				if (new URL(res.url()).hostname !== 'localhost') return;
				sizes.push(res.body().then((b) => gzipSync(b).length, () => 0));
			});
			const res = await page.goto(ROOT + path, { waitUntil: 'networkidle' });
			if (!res?.ok()) failures.push(`${where}: HTTP ${res?.status()}`);
			// Deja que arranquen el reloj y los $effect.
			await page.waitForTimeout(300);
			const check = await page.evaluate(() => ({
				scroll: document.documentElement.scrollWidth - window.innerWidth,
				panels: document.querySelectorAll('section.panel').length,
				missing: [...document.querySelectorAll('.empty')]
					.map((e) => e.textContent?.trim() ?? '')
					.filter((t) => /todav[ií]a/i.test(t)),
				// Restos de un fallo técnico que no deben llegar nunca a la vista. Se salta el texto de los enlaces
				// externos (titulares, títulos de PR): es de otros y puede decir «undefined» a propósito.
				glitches: (() => {
					const found = new Set<string>();
					const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
					for (let n = walk.nextNode(); n; n = walk.nextNode()) {
						if (n.parentElement?.closest('a[target="_blank"], script, style, noscript, template')) continue;
						for (const m of n.textContent?.match(/\b(?:NaN|undefined|Infinity)\b|\[object Object\]/g) ?? []) found.add(m);
					}
					return [...found];
				})()
			}));
			if (width < 600 && check.scroll > 0) failures.push(`${where}: scroll horizontal de ${check.scroll} px`);
			if (!NO_PANELS.has(path) && !check.panels) failures.push(`${where}: sin paneles`);
			for (const text of check.missing) failures.push(`${where}: panel sin datos («${text}»)`);
			for (const text of check.glitches) failures.push(`${where}: «${text}» en la vista`);
			if (width < 600 && first) {
				await page.addScriptTag({ path: AXE });
				const found = await page.evaluate(async (rules) => {
					const r = await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run(document, {
						runOnly: { type: 'rule', values: rules }
					});
					return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
				}, AXE_RULES);
				if (found.length) a11y.push(`${path}: ${found.join(', ')}`);
			}
			const weight = (await Promise.all(sizes)).reduce((a, b) => a + b, 0);
			if (width < 600 && first && weight > WEIGHT_LIMIT) {
				warnings.push(`${path} pesa ${Math.round(weight / 1024)} KB (gzip, sin terceros); el límite es ${WEIGHT_LIMIT / 1024} KB`);
			}
			await page.close();
		}
		await context.close();
	}
	await browser.close();
} catch (error) {
	failures.push(String(error));
} finally {
	server.kill();
}

// ::warning:: hace que GitHub muestre el aviso en el resumen de la Action.
for (const w of warnings) console.log(`::warning title=Peso de las vistas::${w}`);
for (const w of a11y) console.log(`::warning title=Accesibilidad (axe-core)::${w}`);
if (!a11y.length) console.log(`axe-core: sin fallos de ${AXE_RULES.length} reglas en ${PATHS.length} vistas a 390 px`);

if (failures.length) {
	console.log(`✗ Prueba de humo: ${failures.length} fallos\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`✓ Prueba de humo: ${PATHS.length} vistas a ${WIDTHS.join(' y ')} px, en modo ${MODES.join(' y ')}, sin errores`);
