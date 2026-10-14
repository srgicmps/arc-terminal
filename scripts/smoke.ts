/// <reference types="node" />
// Prueba de humo de todas las vistas (`pnpm smoke`, después de `pnpm build`). Arranca `vite preview`, abre
// cada ruta de COMMANDS y la ficha de NVDA a 390 y 1280 px con Chromium, y falla si:
// - hay errores en la consola o excepciones sin capturar;
// - a 390 px la página es más ancha que la pantalla (scroll horizontal);
// - la vista no tiene paneles o alguno dice «… todavía» (le faltan sus datos).
// Las peticiones a otras webs (TradingView, fuentes…) se contestan vacías: así la prueba no depende de la red.
import { COMMANDS } from '../src/lib/commands.ts';
import { launch, preview } from './browser.ts';

const PATHS = [...COMMANDS.map((c) => c.route), '/s?sym=NVDA'];
const WIDTHS = [390, 1280];
/** Vistas de texto, sin paneles. */
const NO_PANELS = new Set(['/help', '/doc']);

const { server, root: ROOT } = await preview(4317);
const failures: string[] = [];

try {
	const browser = await launch();
	for (const width of WIDTHS) {
		const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
		await context.route('**/*', (route) => {
			const url = new URL(route.request().url());
			return url.hostname === 'localhost' ? route.continue() : route.fulfill({ status: 200, body: '' });
		});
		for (const path of PATHS) {
			const where = `${path} a ${width} px`;
			const page = await context.newPage();
			page.on('console', (m) => {
				if (m.type() === 'error') failures.push(`${where}: consola: ${m.text()} (${m.location().url})`);
			});
			page.on('pageerror', (e) => failures.push(`${where}: excepción: ${e.message}`));
			const res = await page.goto(ROOT + path, { waitUntil: 'networkidle' });
			if (!res?.ok()) failures.push(`${where}: HTTP ${res?.status()}`);
			// Deja que arranquen el reloj y los $effect.
			await page.waitForTimeout(300);
			const check = await page.evaluate(() => ({
				scroll: document.documentElement.scrollWidth - window.innerWidth,
				panels: document.querySelectorAll('section.panel').length,
				missing: [...document.querySelectorAll('.empty')]
					.map((e) => e.textContent?.trim() ?? '')
					.filter((t) => /todav[ií]a/i.test(t))
			}));
			if (width < 600 && check.scroll > 0) failures.push(`${where}: scroll horizontal de ${check.scroll} px`);
			if (!NO_PANELS.has(path) && !check.panels) failures.push(`${where}: sin paneles`);
			for (const text of check.missing) failures.push(`${where}: panel sin datos («${text}»)`);
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

if (failures.length) {
	console.log(`✗ Prueba de humo: ${failures.length} fallos\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`✓ Prueba de humo: ${PATHS.length} vistas a ${WIDTHS.join(' y ')} px sin errores`);
