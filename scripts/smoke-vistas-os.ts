/// <reference types="node" />
// Prueba de humo de Arc OS (/os): las vistas de Arc como apps, sin datos (va en el job `checks`).
// - Cada vista y experiencia embebida (?embed=1) a 390 px, como en el móvil a pantalla completa: arranca sin
//   excepciones ni errores de consola, sin la cabecera de la web y sin scroll horizontal.
// - En el escritorio (1280 px): el buscador abre la ficha de un valor en su ventana (y no la repite), un enlace de
//   una vista a otra app abre esa app en otra ventana, y una app ya abierta va a la ruta nueva que se le pide.
// Los 404 de /data/* no cuentan: aquí no hay datos.
import { readdirSync } from 'node:fs';
import { launch, preview, viewPaths } from './browser.ts';
import type { Page } from 'playwright-core';

/** Lo que no es una app del escritorio (apps.ts → NOT_APPS) y el propio escritorio. */
const SKIP = new Set(['/os', '/tv', '/modo', '/bienvenida', '/admin', '/x']);
const EXPERIENCES = readdirSync('build/x').filter((f) => f.endsWith('.html')).map((f) => `/x/${f.slice(0, -'.html'.length)}`);
const PATHS = [...viewPaths().filter((p) => !SKIP.has(p)), '/s?sym=NVDA', ...EXPERIENCES];

const { root: ROOT } = await preview(4319);
const failures: string[] = [];
const noise = (t: string) => /Failed to load resource|ERR_|net::/.test(t);

function watch(page: Page, where: () => string) {
	page.on('console', (m) => m.type() === 'error' && !noise(m.text()) && failures.push(`${where()}: consola: ${m.text().slice(0, 200)}`));
	page.on('pageerror', (e) => failures.push(`${where()}: excepción: ${e.message.slice(0, 200)}`));
}

try {
	const browser = await launch();
	const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
	// Sin internet de terceros (TradingView…): solo la propia web; /api/* vacío, como «sin cuenta».
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.hostname === 'localhost' && !url.pathname.startsWith('/api/') ? route.continue() : route.fulfill({ status: 200, body: '' });
	});
	await context.addInitScript(() => localStorage.setItem('arc-shell', 'os'));

	// 1. Cada vista dentro de un iframe del escritorio, a 390 px.
	const page = await context.newPage();
	let where = '/os';
	watch(page, () => where);
	await page.goto(ROOT + '/os');
	for (const path of PATHS) {
		where = `${path} embebida a 390 px`;
		const r = await page.evaluate(async (path) => {
			document.querySelectorAll('iframe.smoke').forEach((f) => f.remove());
			const f = document.createElement('iframe');
			f.className = 'smoke';
			f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:800px;z-index:99999;border:0';
			f.src = path + (path.includes('?') ? '&' : '?') + 'embed=1';
			document.body.append(f);
			await new Promise((ok) => f.addEventListener('load', ok, { once: true }));
			await new Promise((ok) => setTimeout(ok, 700));
			const d = f.contentDocument!;
			const head = d.querySelector('.top');
			return {
				embed: d.documentElement.dataset.embed,
				width: d.documentElement.scrollWidth,
				head: !!head && head.getClientRects().length > 0 && getComputedStyle(head).display !== 'none'
			};
		}, path);
		if (r.embed !== '1') failures.push(`${where}: sin data-embed`);
		if (r.head) failures.push(`${where}: se ve la cabecera de la web`);
		if (r.width > 391) failures.push(`${where}: scroll horizontal (${r.width} px)`);
	}

	// 2. El escritorio como un usuario.
	where = '/os a 1280 px';
	await page.goto(ROOT + '/os');
	await page.waitForTimeout(1200);
	await page.keyboard.press('Enter'); // pantalla de bloqueo o arranque
	await page.waitForTimeout(400);
	const skip = page.getByRole('button', { name: 'Saltar' });
	if (await skip.count()) await skip.click();
	const titles = () => page.evaluate(() => [...document.querySelectorAll('[data-ui=os-name]')].map((e) => e.textContent ?? ''));
	const search = async (q: string) => {
		await page.keyboard.press('Control+Space');
		await page.waitForTimeout(300);
		await page.keyboard.type(q);
		await page.waitForTimeout(400);
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1500);
	};
	const count = (list: string[], t: string) => list.filter((x) => x === t).length;

	await search('NVDA');
	await search('NVDA');
	let t = await titles();
	if (count(t, 'Valor · NVDA') !== 1) failures.push(`${where}: «NVDA» en el buscador no abre una ventana «Valor · NVDA» (hay: ${t.join(', ') || 'ninguna'})`);

	await search('TOP');
	const link = page.frameLocator('iframe[title="Portada"]').locator('a[href$="/luz"]').first();
	if (await link.count()) {
		await link.click();
		await page.waitForTimeout(1500);
		t = await titles();
		const inTop = await page.evaluate(() => document.querySelector<HTMLIFrameElement>('iframe[title="Portada"]')?.contentWindow?.location.pathname);
		if (!t.includes('Luz') || inTop !== '/') failures.push(`${where}: «LUZ ›» en Portada no abre LUZ en otra ventana (ventanas: ${t.join(', ')}; Portada en ${inTop})`);
	} else failures.push(`${where}: Portada sin enlace a LUZ`);

	await search('China');
	await search('Alemania');
	const pais = await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.contentWindow?.location.search ?? '').filter((s) => s.includes('c=')));
	if (pais.length !== 1 || !pais[0].includes('c=DE')) failures.push(`${where}: PAIS ya abierta no va al país nuevo (${pais.join(', ')})`);

	await browser.close();
} finally {
	process.exit(report());
}

function report() {
	if (!failures.length) {
		console.log(`✓ Arc OS: ${PATHS.length} vistas embebidas y el escritorio, sin fallos`);
		return 0;
	}
	console.log(`✗ Arc OS: ${failures.length} fallos\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	return 1;
}
