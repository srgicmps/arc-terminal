/// <reference types="node" />
// Recorridos de punta a punta de Arc OS en el escritorio (`pnpm e2e:os`, después de `pnpm build`): un día de Sergi.
// Primer arranque → bienvenida → fondo propio → TOP, GEO, WS y MIS en ventanas → mosaico → carpeta con un icono
// dentro → Notas → Mapa operacional y Expediente → buscador universal → recargar y que todo vuelva igual → salir al
// Terminal clásico y volver. Falla si un paso no da lo esperado, si hay excepciones sin capturar o errores en la
// consola (salvo los 404 de /data: aquí no hay datos descargados).
// Las peticiones a otras webs y a /api se contestan vacías: no depende de la red ni de una cuenta.
// Navegador: Chromium por defecto; `E2E_BROWSER=firefox` o `webkit` si están instalados los de Playwright.
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright-core';
import { launch, preview } from './browser.ts';

const W = { width: 1440, height: 900 };
const which = process.env.E2E_BROWSER ?? 'chromium';
const { server, root: ROOT } = await preview(4318);
const failures: string[] = [];
const errors: string[] = [];
let current = '';
/** La página del recorrido, para la captura de un paso que falla (con E2E_SHOTS=<carpeta>). */
let page: Page | null = null;

/** Un paso del recorrido: si falla, se apunta con su nombre y el recorrido sigue con el siguiente bloque. */
async function step(name: string, fn: () => Promise<void>) {
	current = name;
	const t = Date.now();
	try {
		await fn();
		console.log(`  ✓ ${name} (${Date.now() - t} ms)`);
	} catch (e) {
		failures.push(`${name}: ${(e as Error).message.split('\n')[0]}`);
		if (process.env.E2E_SHOTS)
			await page?.screenshot({ path: `${process.env.E2E_SHOTS}/${name.split(' ')[0]}.png` }).catch(() => {});
		console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`);
	}
}

function ok(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

async function open(): Promise<Browser> {
	if (which === 'firefox') return firefox.launch();
	if (which === 'webkit') return webkit.launch();
	return which === 'chromium' ? launch() : chromium.launch();
}

/** Las ventanas abiertas, en orden de la capa: app, nombre y caja. */
const wins = (p: Page) =>
	// La caja del estilo y no getBoundingClientRect: así no se mide a mitad de la animación de la ventana.
	p.$$eval('section.win[data-ui="os-win"]:not(.min)', (els) =>
		els.map((e) => {
			const st = (e as HTMLElement).style;
			const n = (v: string) => parseFloat(v) || 0;
			return {
				app: e.getAttribute('data-app')!,
				name: e.getAttribute('aria-label')!,
				x: n(st.left),
				y: n(st.top),
				w: n(st.width),
				h: n(st.height)
			};
		})
	);

/** Abre una app con el buscador universal (Ctrl+Espacio), escribiendo su nombre y con Enter. */
async function spot(p: Page, q: string, pick?: string) {
	await p.keyboard.press('Control+Space');
	const input = p.locator('.spot input[role=combobox]');
	await input.waitFor();
	await input.fill(q);
	const opt = pick
		? p.locator('#os-spot-list li[role=option]', { hasText: pick }).first()
		: p.locator('#os-spot-list li[role=option]').first();
	await opt.waitFor({ timeout: 3000 });
	if (pick) await opt.click();
	else await p.keyboard.press('Enter');
	await p.locator('.spot').waitFor({ state: 'detached', timeout: 3000 });
}

/** Abre una app desde «Todas las apps» de la barra de arriba. */
async function pad(p: Page, name: string) {
	await p.locator('nav.mando button[aria-label="Todas las apps"]').click();
	const pad = p.locator('.pad[role=dialog]');
	await pad.locator('input[aria-label="Buscar apps"]').fill(name);
	await pad
		.locator('button', { has: p.locator(`.name:text-is("${name}")`) })
		.first()
		.click();
	await pad.waitFor({ state: 'detached' });
}

/** Icono del escritorio por su nombre. */
const icon = (p: Page, name: string) => p.locator(`[data-ui="os"] .icon:has(.name:text-is("${name}"))`).first();

/** Ventana de una app. */
const win = (p: Page, app: string) => p.locator(`section.win[data-app="${app}"]`).first();

try {
	const browser = await open();
	// Sin service worker: sus peticiones no pasan por context.route (y /api acabaría en 404).
	const context = await browser.newContext({ viewport: W, serviceWorkers: 'block' });
	// La web clásica sin bienvenida ni aviso del Modo OS: el recorrido empieza en /os.
	await context.addInitScript(() => {
		if (!localStorage.getItem('arc-welcome')) localStorage.setItem('arc-welcome', '1');
		localStorage.setItem('arc-os-invite', '1');
	});
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		const local = url.hostname === 'localhost' && !url.pathname.startsWith('/api/');
		if (local) return route.continue();
		// Vacío, pero del tipo que se espera (WebKit avisa de una hoja de estilos sin text/css).
		const type = route.request().resourceType();
		return route.fulfill({
			status: 200,
			body: '',
			contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'text/javascript' : 'text/plain'
		});
	});
	const p = await context.newPage();
	p.setDefaultTimeout(8000);
	page = p;
	p.on('pageerror', (e) => {
		// Aviso benigno del navegador (WebKit lo lanza como error), no un fallo de Arc OS.
		if (/ResizeObserver loop/.test(e.message)) return;
		errors.push(`[${current}] excepción: ${e.message}`);
	});
	// Los 404 se miran en las respuestas (WebKit no dice la URL en la consola): sin datos descargados, /data/* falta.
	p.on('response', (r) => {
		if (r.status() >= 400 && !new URL(r.url()).pathname.includes('/data/'))
			errors.push(`[${current}] ${r.status()} en ${r.url()}`);
	});
	p.on('console', (m) => {
		if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
		errors.push(`[${current}] consola: ${m.text().slice(0, 200)}`);
	});
	console.log(`Recorridos de Arc OS en ${which}, ${W.width}×${W.height}`);

	// 1. Primer arranque: arranque breve, bloqueo y asistente de bienvenida.
	await step('1 · Primer arranque: arranque y bloqueo', async () => {
		await p.goto(ROOT + '/os');
		await p.locator('[role=dialog][aria-label="Arrancando Arc OS"]').waitFor({ timeout: 5000 });
		const lock = p.locator('[role=dialog][aria-label^="Pantalla de bloqueo"]');
		await lock.waitFor({ timeout: 5000 });
		await lock.locator('button.enter').click();
		await lock.waitFor({ state: 'detached', timeout: 3000 });
	});

	let chosen = '';
	await step('2 · Bienvenida: fondo, widgets y nombre', async () => {
		const first = p.locator('.first[role=dialog]');
		await first.waitFor({ timeout: 3000 });
		const tiles = first.locator('[role=radiogroup][aria-label="Fondo del escritorio"] button[role=radio]');
		ok((await tiles.count()) >= 3, 'el asistente no ofrece fondos');
		await tiles.nth(2).click();
		ok((await tiles.nth(2).getAttribute('aria-checked')) === 'true', 'el fondo elegido no queda marcado');
		chosen = (await p.locator('.desktop').getAttribute('data-wallpaper')) ?? '';
		await first.getByRole('button', { name: 'Siguiente' }).click();
		const toggles = first.locator('[role=group][aria-label="Widgets"] button[aria-pressed]');
		ok((await toggles.count()) > 0, 'no hay widgets que elegir');
		await first.getByRole('button', { name: 'Siguiente' }).click();
		await first.locator('input[aria-label="Tu nombre"]').fill('Sergi');
		await first.getByRole('button', { name: 'Empezar' }).click();
		await first.waitFor({ state: 'detached', timeout: 3000 });
		const ls = await p.evaluate(() => ({
			skin: localStorage.getItem('arc-os-skin'),
			name: localStorage.getItem('arc-os-name')
		}));
		ok(ls.skin === 'mando', `arc-os-skin = ${ls.skin}`);
		ok(ls.name?.includes('Sergi'), `arc-os-name = ${ls.name}`);
		ok(chosen, 'el escritorio no refleja el fondo elegido');
	});

	await step('3 · Fondo propio: un color desde «Cambiar fondo…»', async () => {
		await p
			.locator('[data-ui="os"] .layer[role=group]')
			.first()
			.click({ button: 'right', position: { x: 600, y: 500 } });
		await p.locator('[data-ui="os-menu"] [role=menuitem]', { hasText: 'Cambiar fondo' }).click();
		const app = win(p, 'wallpaper');
		await app.waitFor({ timeout: 5000 });
		await app.locator('input[type=color]').first().fill('#203040');
		await app.getByRole('button', { name: 'Usar color' }).click();
		const wall = p.locator('.desktop .wall:not(.preview)').first();
		await p.waitForFunction(
			() => document.querySelector('.desktop .wall:not(.preview)')?.getAttribute('data-wall') === 'color',
			null,
			{ timeout: 3000 }
		);
		const bg = await wall.evaluate((e) => getComputedStyle(e).backgroundColor);
		ok(bg === 'rgb(32, 48, 64)', `el fondo es ${bg}`);
		await app.locator('[data-btn="close"]').click();
		await app.waitFor({ state: 'detached', timeout: 3000 });
	});

	await step('4 · TOP, GEO y WS desde el escritorio y MIS desde todas las apps', async () => {
		await icon(p, 'Portada').locator('button.hit').dblclick();
		await win(p, 'top').waitFor();
		// La ventana tapa los iconos: el resto, desde «Todas las apps».
		for (const name of ['Geopolítica', 'Wall Street', 'Mis valores']) await pad(p, name);
		for (const app of ['top', 'geo', 'ws', 'mis']) await win(p, app).waitFor({ timeout: 5000 });
		const at = new Set((await wins(p)).map((w) => `${w.x},${w.y}`));
		ok(at.size === 4, `las ventanas nuevas se abren unas encima de otras (${[...at].join(' · ')})`);
		for (const [app, path] of [
			['top', '/?embed=1'],
			['geo', '/geo?embed=1'],
			['ws', '/ws?embed=1'],
			['mis', '/mis?embed=1']
		]) {
			const src = await win(p, app).locator('iframe').getAttribute('src');
			ok(src?.endsWith(path), `${app}: el iframe carga ${src}`);
		}
		// La vista dentro de la ventana, sin la cabecera de la web.
		const frame = p.frameLocator('section.win[data-app="geo"] iframe');
		await frame.locator('html[data-embed="1"]').waitFor({ state: 'attached', timeout: 15000 });
	});

	await step('5 · Mosaico (Alt+T): cuatro ventanas sin solaparse', async () => {
		await p
			.locator('[data-ui="os"] .layer[role=group]')
			.first()
			.click({ position: { x: 5, y: 5 }, force: true })
			.catch(() => {});
		await p.keyboard.press('Alt+KeyT');
		await p.waitForTimeout(500);
		const ws = await wins(p);
		ok(ws.length === 4, `hay ${ws.length} ventanas`);
		for (let i = 0; i < ws.length; i++)
			for (let j = i + 1; j < ws.length; j++) {
				const a = ws[i],
					b = ws[j];
				const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
				const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
				ok(ox <= 2 || oy <= 2, `${a.app} y ${b.app} se solapan`);
			}
		const area = ws.reduce((s, w) => s + w.w * w.h, 0);
		ok(area > W.width * W.height * 0.6, 'el mosaico no llena el escritorio');
	});

	await step('6 · Carpeta «Mercados» con Wall Street dentro', async () => {
		// Minimiza las ventanas para ver los iconos.
		for (const app of ['top', 'geo', 'ws', 'mis']) await win(p, app).locator('[data-btn="min"]').click();
		await p
			.locator('[data-ui="os"] .layer[role=group]')
			.first()
			.click({ button: 'right', position: { x: 700, y: 600 } });
		await p.locator('[data-ui="os-menu"] [role=menuitem]', { hasText: 'Nueva carpeta' }).click();
		const input = p.locator('[data-ui="os"] input.rename');
		await input.waitFor({ timeout: 3000 });
		await input.fill('Mercados');
		await input.press('Enter');
		const folder = icon(p, 'Mercados');
		await folder.waitFor({ timeout: 3000 });
		const from = await icon(p, 'Wall Street').locator('button.hit').boundingBox();
		const to = await folder.locator('button.hit').boundingBox();
		ok(from && to, 'no se ven los iconos');
		await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await p.mouse.down();
		for (let i = 1; i <= 10; i++)
			await p.mouse.move(
				from.x + from.width / 2 + ((to.x - from.x) * i) / 10,
				from.y + from.height / 2 + ((to.y - from.y) * i) / 10
			);
		await p.mouse.up();
		await icon(p, 'Wall Street').waitFor({ state: 'detached', timeout: 3000 });
		await folder.locator('button.hit').dblclick();
		// Las carpetas del escritorio se abren en Archivos.
		const fw = win(p, 'archivos');
		await fw.waitFor({ timeout: 3000 });
		const title = (await fw.locator('[data-ui="os-name"]').innerText()).trim();
		ok(title === 'Mercados', `la ventana se llama ${title}`);
		await fw.getByText('Wall Street', { exact: true }).first().waitFor({ timeout: 3000 });
		await fw.locator('[data-btn="close"]').click();
	});

	await step('7 · Notas: una nota nueva', async () => {
		await spot(p, 'Notas', 'Notas');
		const notes = win(p, 'notas');
		await notes.waitFor({ timeout: 5000 });
		await notes.locator('button.new').click();
		const ed = notes.locator('.editor[contenteditable]');
		await ed.click();
		await p.keyboard.type('Revisar el IPC de mañana');
		await p.waitForTimeout(800);
		const saved = await p.evaluate(() =>
			Object.keys(localStorage).some(
				(k) => k.startsWith('arc-os-note-') && localStorage.getItem(k)!.includes('Revisar el IPC')
			)
		);
		ok(saved, 'la nota no se guarda');
	});

	await step('8 · Mapa operacional y Expediente', async () => {
		await spot(p, 'Mapa operacional', 'Mapa operacional');
		const map = win(p, 'mapa-op');
		await map.waitFor({ timeout: 5000 });
		await map.locator('nav.layers[aria-label="Capas"]').waitFor({ timeout: 5000 });
		await spot(p, 'Expediente', 'Expediente');
		const dos = win(p, 'expediente');
		await dos.waitFor({ timeout: 5000 });
		await dos.locator('p.msg, section.start').first().waitFor({ timeout: 8000 });
	});

	await step('9 · Buscador universal: un valor', async () => {
		await p.keyboard.press('Control+Space');
		const input = p.locator('.spot input[role=combobox]');
		await input.fill('NVDA');
		const opts = p.locator('#os-spot-list li[role=option]');
		await opts.first().waitFor({ timeout: 3000 });
		const texts = await opts.allInnerTexts();
		ok(
			texts.some((t) => /NVDA|Nvidia/i.test(t)),
			`sin NVDA en: ${texts.slice(0, 4).join(' | ')}`
		);
		await p.keyboard.press('Escape');
		await p.locator('.spot').waitFor({ state: 'detached', timeout: 3000 });
	});

	// Lo que tiene que volver igual al recargar.
	const snapshot = async () => ({
		// App, minimizada o no, y caja exacta: al recargar, el mosaico y lo encajado vuelven al px (relayout solo
		// recoloca las que se salen).
		wins: (
			await p.$$eval('section.win[data-ui="os-win"]', (els) =>
				els.map((e) => {
					const h = e as HTMLElement;
					return `${e.getAttribute('data-app')} ${h.style.left},${h.style.top} ${h.style.width}×${h.style.height}${e.classList.contains('min') ? ' (min)' : ''}`;
				})
			)
		).sort(),
		title: await p.$$eval('section.win [data-ui="os-name"]', (els) => els.map((e) => e.textContent?.trim()).sort()),
		notes: await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('arc-os-note-')).length),
		icons: (await p.$$eval('[data-ui="os"] .icon .name', (els) => els.map((e) => e.textContent?.trim()))).sort(),
		wall: await p.evaluate(() => document.querySelector('.desktop .wall:not(.preview)')?.getAttribute('style') ?? ''),
		name: await p.evaluate(() => localStorage.getItem('arc-os-name'))
	});
	let before: Awaited<ReturnType<typeof snapshot>> | null = null;

	await step('10 · Recargar: vuelve todo igual y sin pasar otra vez por la bienvenida', async () => {
		await p.waitForTimeout(500);
		before = await snapshot();
		await p.reload();
		await p.locator('section.win[data-ui="os-win"]').first().waitFor({ state: 'attached', timeout: 8000 });
		ok(!(await p.locator('.first[role=dialog]').count()), 'vuelve a salir la bienvenida');
		ok(!(await p.locator('[role=dialog][aria-label^="Pantalla de bloqueo"]').count()), 'vuelve a salir el bloqueo');
		await p.waitForTimeout(500);
		const after = await snapshot();
		ok(
			JSON.stringify(after) === JSON.stringify(before),
			`antes ${JSON.stringify(before)}\n después ${JSON.stringify(after)}`
		);
	});

	await step('11 · Salir al Terminal clásico y volver con OS', async () => {
		await p.locator('button.tray-btn[aria-label="Panel de control"]').click();
		await p.getByRole('button', { name: 'Volver a la web clásica' }).first().click();
		await p.waitForURL((u) => !u.pathname.startsWith('/os'), { timeout: 5000 });
		ok((await p.evaluate(() => localStorage.getItem('arc-shell'))) === 'clasico', 'arc-shell no queda en «clasico»');
		const cmd = p.locator('input#cmd');
		await cmd.waitFor({ timeout: 5000 });
		await cmd.fill('OS');
		await cmd.press('Enter');
		await p.waitForURL((u) => u.pathname.startsWith('/os'), { timeout: 5000 });
		await p.locator('section.win[data-ui="os-win"]').first().waitFor({ state: 'attached', timeout: 8000 });
		ok(
			!(await p.locator('button.tray-btn[aria-label="Panel de control"][aria-expanded="true"]').count()),
			'el Panel de control sigue abierto al volver'
		);
		const back = await snapshot();
		ok(JSON.stringify(back.wins) === JSON.stringify(before?.wins), `al volver: ${back.wins.join(', ')}`);
	});

	await step('12 · La nota sigue en Notas tras recargar', async () => {
		const notes = win(p, 'notas');
		await notes.waitFor();
		await notes.getByText('Revisar el IPC de mañana').first().waitFor({ timeout: 3000 });
	});

	await step('13 · Escritorio nuevo con su ventana, que vuelve al recargar', async () => {
		// Con las ventanas apartadas («Mostrar escritorio»), clic derecho en el escritorio → «Escritorio nuevo».
		await p.locator('nav.mando button[aria-label="Mostrar escritorio"]').click();
		await p
			.locator('[data-ui="os"] .layer[role=group]')
			.first()
			.click({ button: 'right', position: { x: 500, y: 300 } });
		await p.locator('[data-ui="os-menu"] [role=menuitem]', { hasText: 'Escritorio nuevo' }).click();
		await p.waitForTimeout(300);
		ok(!(await wins(p)).length, 'el escritorio nuevo no empieza vacío');
		await pad(p, 'Calculadora');
		await win(p, 'calculadora').waitFor();
		await p.waitForTimeout(500);
		await p.reload();
		await win(p, 'calculadora').waitFor({ timeout: 8000 });
		ok(
			(await wins(p)).map((w) => w.app).join() === 'calculadora',
			`tras recargar se ven: ${(await wins(p)).map((w) => w.app).join()}`
		);
		await p.keyboard.press('Alt+Digit1');
		await win(p, 'notas').waitFor({ state: 'attached', timeout: 3000 });
	});

	await step('14 · Buscador universal: NVDA con Enter abre su ficha', async () => {
		const n = (await wins(p)).length;
		await p.keyboard.press('Control+Space');
		await p.locator('.spot input[role=combobox]').fill('NVDA');
		await p.locator('#os-spot-list li[role=option]').first().waitFor();
		await p.keyboard.press('Enter');
		await p.waitForTimeout(800);
		const after = await wins(p);
		ok(p.url().includes('/os'), `sale de Arc OS a ${p.url()}`);
		ok(after.length === n + 1, `no se abre ninguna ventana (${after.map((w) => w.app).join()})`);
	});

	await step('15 · Salir desde el buscador y volver con «Cambiar al Modo OS»', async () => {
		await spot(p, 'Salir al Terminal clásico', 'Salir al Terminal clásico');
		await p.waitForURL((u) => !u.pathname.startsWith('/os'), { timeout: 5000 });
		await p.getByRole('button', { name: 'Más opciones' }).first().click();
		await p.getByText('Cambiar al Modo OS').first().click();
		await p.waitForURL((u) => u.pathname.startsWith('/os'), { timeout: 5000 });
		ok((await p.evaluate(() => localStorage.getItem('arc-shell'))) === 'os', 'arc-shell no queda en «os»');
		// Con el Modo OS elegido, la portada lleva a /os (una vez por pestaña: en una nueva).
		const tab = await context.newPage();
		await tab.goto(ROOT + '/');
		await tab.waitForURL((u) => u.pathname.startsWith('/os'), { timeout: 5000 });
		await tab.close();
	});

	await browser.close();
} finally {
	server.kill();
}

for (const e of errors) failures.push(e);
if (failures.length) {
	console.error(`\n${failures.length} fallos:\n- ${failures.join('\n- ')}`);
	process.exit(1);
}
console.log('\nTodos los recorridos pasan.');
