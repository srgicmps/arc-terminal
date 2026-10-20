/// <reference types="node" />
// Prueba de humo de Arc OS en el escritorio (la llama scripts/smoke.ts): /os a 1024 px con 12 ventanas.
// Falla si:
// - las pestañas de la barra se pisan entre ellas o con el nivel de alerta;
// - una ventana minimizada sigue pintando su vista (el iframe a 60 fps en segundo plano);
// - al restaurarla, la vista se ha recargado o no vuelve a pintar;
// - hay excepciones sin capturar.
import type { Browser } from 'playwright-core';

/** Una vista (iframe) y once herramientas, que cargan poco. */
const APPS = ['eco', 'notas', 'calculadora', 'reloj', 'calendario', 'monitor', 'registros', 'terminal', 'vigilancia', 'cronologia', 'archivos', 'paquetes'];

export async function osChecks(browser: Browser, root: string): Promise<string[]> {
	const failures: string[] = [];
	const wins = APPS.map((app, i) => ({ uid: `w${i + 1}`, app, x: 16 + i * 24, y: 16 + i * 16, w: 560, h: 380, z: i + 1 }));
	const state = { v: 1, desks: [{ id: 'd1', name: 'Uno', wins }], active: 'd1', seq: wins.length + 1 };
	const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
	await context.addInitScript((s) => {
		if (sessionStorage.getItem('arc-smoke-os')) return;
		sessionStorage.setItem('arc-smoke-os', '1');
		localStorage.setItem('arc-shell', 'os');
		localStorage.setItem('arc-welcome', JSON.stringify({ v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: '' }));
		// Sin arranque ni asistente de bienvenida.
		localStorage.setItem('arc-os-system', JSON.stringify({ boot: false, sounds: false }));
		localStorage.setItem('arc-os-skin', 'mando');
		localStorage.setItem('arc-os-desks', s);
	}, JSON.stringify(state));
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.hostname === 'localhost' && !url.pathname.startsWith('/api/') ? route.continue() : route.fulfill({ status: 200, body: '' });
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => failures.push(`/os con 12 ventanas: excepción: ${e.message}`));
	try {
		// Con 12 ventanas cargando sus vistas, la red puede no quedarse quieta 500 ms seguidos en un runner cargado:
		// se espera a la página y a las ventanas, y lo de «sin red» es solo un margen con tope, no una condición.
		await page.goto(root + '/os', { waitUntil: 'load' });
		await page.waitForSelector('[data-os-layer] iframe', { timeout: 20000 });
		await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

		const overlap = await page.evaluate(() => {
			const tabs = [...document.querySelectorAll('.tabs li')].map((b) => b.getBoundingClientRect());
			const level = document.querySelector('.level')?.getBoundingClientRect();
			const bad = tabs.findIndex((r, i) => (i < tabs.length - 1 && r.right > tabs[i + 1].left + 1) || (level && r.right > level.left + 1));
			return { n: tabs.length, bad };
		});
		if (overlap.n !== APPS.length) failures.push(`/os: la barra enseña ${overlap.n} pestañas y hay ${APPS.length} ventanas`);
		if (overlap.bad >= 0) failures.push(`/os a 1024 px: la pestaña ${overlap.bad + 1} se pisa con la siguiente o con el nivel de alerta`);

		const frame = page.frames().find((f) => f.url().includes('embed=1'));
		if (!frame) throw new Error('/os: la ventana de ECO no tiene su vista');
		await frame.waitForLoadState('load');
		/** Fotogramas que pinta la vista en 1 s, y la marca que se le deja (si se recarga, se pierde). */
		const paint = () =>
			frame.evaluate(
				() =>
					new Promise<{ raf: number; mark: unknown }>((done) => {
						let n = 0;
						const step = () => (n++, requestAnimationFrame(step));
						requestAnimationFrame(step);
						setTimeout(() => done({ raf: n, mark: (window as unknown as { arcMark?: string }).arcMark }), 1000);
					})
			);
		await frame.evaluate(() => ((window as unknown as { arcMark?: string }).arcMark = 'viva'));
		await page.locator('[data-btn=min]').first().click();
		await page.waitForTimeout(600);
		const hidden = await paint();
		if (hidden.raf > 2) failures.push(`/os: una ventana minimizada sigue pintando su vista (${hidden.raf} fotogramas en 1 s)`);
		await page.locator('.tabs button').first().click();
		await page.waitForTimeout(600);
		const back = await paint();
		if (back.mark !== 'viva') failures.push('/os: al restaurar una ventana minimizada, su vista se ha recargado');
		if (back.raf < 5) failures.push(`/os: la ventana restaurada no vuelve a pintar (${back.raf} fotogramas en 1 s)`);
	} catch (error) {
		failures.push(String(error));
	}
	await context.close();
	return failures;
}
