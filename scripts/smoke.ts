/// <reference types="node" />
// Prueba de humo de todas las vistas (`pnpm smoke`, después de `pnpm build`). Arranca `vite preview`, abre
// cada ruta de COMMANDS y la ficha de NVDA a 390 y 1280 px con Chromium, y falla si:
// - hay errores en la consola o excepciones sin capturar;
// - a 390 px la página es más ancha que la pantalla (scroll horizontal);
// - la vista no tiene paneles o alguno dice «… todavía» (le faltan sus datos).
// Además avisa (sin fallar) si una vista pesa más de WEIGHT_LIMIT: lo que descarga de la propia web
// (HTML, JS, CSS y datos) comprimido con gzip, como lo sirve GitHub Pages; sin TradingView ni otras webs.
// Las peticiones a otras webs (TradingView, fuentes…) se contestan vacías: así la prueba no depende de la red.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { chromium, type Browser } from 'playwright-core';
import { COMMANDS } from '../src/lib/commands.ts';

const PORT = 4317;
const ROOT = `http://localhost:${PORT}/arc-terminal`;
const PATHS = [...COMMANDS.map((c) => c.route), '/s?sym=NVDA'];
const WIDTHS = [390, 1280];
/** Vistas de texto, sin paneles. */
const NO_PANELS = new Set(['/help', '/doc']);
/** Peso máximo razonable de una vista en el móvil (4G), en bytes gzip. */
const WEIGHT_LIMIT = 300 * 1024;

/** Chromium de la imagen de desarrollo; en el runner de GitHub, el Chrome que trae instalado. */
async function launch(): Promise<Browser> {
	const local = '/opt/pw-browsers/chromium';
	if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
	if (existsSync(local)) return chromium.launch({ executablePath: local });
	return chromium.launch({ channel: 'chrome' });
}

async function waitForServer() {
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${ROOT}/`)).ok) return;
		} catch {}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`vite preview no responde en el puerto ${PORT}`);
}

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const failures: string[] = [];
const warnings: string[] = [];

try {
	await waitForServer();
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
					.filter((t) => /todav[ií]a/i.test(t))
			}));
			if (width < 600 && check.scroll > 0) failures.push(`${where}: scroll horizontal de ${check.scroll} px`);
			if (!NO_PANELS.has(path) && !check.panels) failures.push(`${where}: sin paneles`);
			for (const text of check.missing) failures.push(`${where}: panel sin datos («${text}»)`);
			const weight = (await Promise.all(sizes)).reduce((a, b) => a + b, 0);
			if (width < 600 && weight > WEIGHT_LIMIT) {
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

if (failures.length) {
	console.log(`✗ Prueba de humo: ${failures.length} fallos\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`✓ Prueba de humo: ${PATHS.length} vistas a ${WIDTHS.join(' y ')} px sin errores`);
