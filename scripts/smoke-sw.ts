/// <reference types="node" />
// Prueba sin conexión del service worker (la llama scripts/smoke.ts, solo con Chromium), en el móvil:
// 1) primera visita a TOP con conexión (el service worker se instala) y, sin conexión, TOP tiene que arrancar;
// 2) con conexión otra vez se abre ECO y, sin conexión, ECO tiene que arrancar.
// Antes de cada «sin conexión» se vacían la caché HTTP del navegador y arc-chunks (lo que guarda al pedirlo): así
// solo cuenta la precaché (scripts/precache.ts), como tras una publicación. «Arrancar» es que la barra de comandos
// sugiera algo al escribir: sin su JavaScript no lo hace. Si falla, dice qué archivos de _app/immutable no cargan.
// Usa su propio `vite preview` y lo apaga para cortar la red: setOffline de Playwright no corta los fetch del
// service worker.
import type { ChildProcess } from 'node:child_process';
import type { Browser, Page } from 'playwright-core';
import { preview } from './browser.ts';

export async function swChecks(browser: Browser, port = 4321): Promise<string[]> {
	const failures: string[] = [];
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
	await context.addInitScript(() => {
		localStorage.setItem('arc-welcome', JSON.stringify({ v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: '' }));
	});
	// Otras webs (TradingView, fuentes…) y /api/*: vacías, como en el resto de la prueba de humo.
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.hostname === 'localhost' && !url.pathname.startsWith('/api/') ? route.continue() : route.fulfill({ status: 200, body: '' });
	});
	const page = await context.newPage();
	const missing = new Set<string>();
	page.on('requestfailed', (r) => {
		if (r.url().includes('/_app/immutable/')) missing.add(new URL(r.url()).pathname);
	});
	let server: ChildProcess | undefined;
	let root = '';

	/** Apaga el servidor y vacía la caché HTTP (vite preview sirve _app/immutable como «immutable») y arc-chunks. */
	async function offline() {
		server?.kill();
		for (let i = 0; i < 25 && (await fetch(root).then(() => true, () => false)); i++) await new Promise((r) => setTimeout(r, 200));
		await page.evaluate(() => caches.delete('arc-chunks'));
		await (await context.newCDPSession(page)).send('Network.clearBrowserCache');
	}

	/** Sin conexión, ¿arranca `path`? */
	async function check(path: string, when: string) {
		missing.clear();
		await page.goto(root + path, { waitUntil: 'load' });
		if (await boots(page)) return;
		const files = missing.size ? ` (no cargan ${[...missing].join(', ')})` : '';
		failures.push(`service worker: sin conexión ${when}, ${path} no arranca${files}`);
	}

	try {
		({ server, root } = await preview(port));
		await page.goto(root + '/', { waitUntil: 'load' });
		// Instalado y al mando de la página (clients.claim).
		const controlled = await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
			for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
			return !!navigator.serviceWorker.controller;
		});
		if (!controlled) failures.push('service worker: no se instala o no controla la página');
		await offline();
		await check('/', 'tras la primera visita');

		({ server } = await preview(port));
		await page.goto(root + '/eco', { waitUntil: 'networkidle' });
		await offline();
		await check('/eco', 'tras abrir ECO');
	} catch (error) {
		failures.push(`service worker: ${String(error)}`);
	} finally {
		server?.kill();
		await context.close();
	}
	return failures;
}

/**
 * ¿Ha arrancado la vista? Sin JavaScript, la barra de comandos no sugiere nada al escribir. Se vuelve a escribir
 * durante unos segundos: lo escrito antes de que arranque la página no cuenta.
 */
async function boots(page: Page): Promise<boolean> {
	const input = page.locator('input[aria-controls="suggest"]').first();
	const option = page.locator('#suggest [role="option"]').first();
	for (let i = 0; i < 10; i++) {
		await input.fill('');
		await input.fill('ECO');
		if (await option.waitFor({ timeout: 500 }).then(() => true, () => false)) return true;
	}
	return false;
}
