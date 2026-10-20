/// <reference types="node" />
// Prueba de humo de todas las vistas (`pnpm smoke`, después de `pnpm build`). Arranca `vite preview`, abre
// cada vista de build/, las experiencias de build/x/ y la ficha de NVDA a 390 y 1280 px con Chromium, y falla si:
// - hay errores en la consola o excepciones sin capturar;
// - a 390 px la página es más ancha que la pantalla (scroll horizontal);
// - sale «NaN», «undefined», «Infinity» o «[object Object]» en el texto de la vista;
// - la vista no tiene paneles o alguno dice «… todavía» (le faltan sus datos). Una fuente que ha respondido
//   sin nada que contar (hoy no hay terremotos ni avisos) tiene que decirlo con otro aviso, sin «todavía».
// Además avisa (sin fallar) si una vista pesa más de WEIGHT_LIMIT: lo que descarga de la propia web
// (HTML, JS, CSS y datos) comprimido con gzip, como lo sirve GitHub Pages; sin TradingView ni otras webs.
// También avisa (sin fallar, de momento) de los fallos de accesibilidad de axe-core en contraste y nombres de
// controles, enlaces e imágenes (AXE_RULES), a 390 px, y de las vistas que saltan al cargar (CLS de más de CLS_LIMIT).
// En Sencillo falla si, ya arrancada la vista, queda algún panel sin data-essential: Panel los quita con `gone` y su
// CSS los esconde antes de arrancar, y las dos cosas tienen que decir lo mismo.
// Las peticiones a otras webs (TradingView, fuentes…) se contestan vacías: así la prueba no depende de la red.
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { launch, preview, viewPaths } from './browser.ts';
import { osChecks } from './smoke-os.ts';

/** En WebKit (SMOKE_BROWSER) solo se mira la web clásica en el móvil: lo que cambia con Safari es el diseño. */
const WEBKIT = !!process.env.SMOKE_BROWSER;
/** Con las experiencias (/x/<id>, en su propia carpeta de build/). */
const PATHS = (process.env.SMOKE_ONLY ? process.env.SMOKE_ONLY.split(',') : [...viewPaths(), ...viewPaths('build/x').map((p) => `/x${p}`), '/s?sym=NVDA']).filter((p) => !WEBKIT || p !== '/os');
/** SMOKE_WIDTHS y SMOKE_MODES (separados por comas) acotan la pasada; SMOKE_STYLE fija una estética con tema claro y
 *  acento azul (como el iPhone de Sergi). Los usa el paso de WebKit del CI. */
const WIDTHS = process.env.SMOKE_WIDTHS ? process.env.SMOKE_WIDTHS.split(',').map(Number) : [390, 1280];
/** Los dos modos (src/lib/modo.ts): Sencillo enseña menos paneles y letra mayor; Terminal, todo. */
const MODES = process.env.SMOKE_MODES ? process.env.SMOKE_MODES.split(',') : ['sencillo', 'terminal'];
const STYLE = process.env.SMOKE_STYLE ?? '';

/** Vistas de texto, sin paneles, y el Modo OS (/os: un escritorio con ventanas). Las experiencias (/x/<id>) tampoco usan Panel. */
const NO_PANELS = new Set(['/help', '/doc', '/bienvenida', '/os']);
/** Salto máximo razonable al cargar (CLS, a 390 px): de 0,1 para arriba, Google lo da por «mejorable». */
const CLS_LIMIT = 0.1;
/** Peso máximo razonable de una vista en el móvil (4G), en bytes gzip. */
const WEIGHT_LIMIT = 300 * 1024;
/** Sin aviso de peso: Arc OS no tiene tope (scripts/weight.ts → EXEMPT). */
const NO_WEIGHT_LIMIT = new Set(['/os']);
/**
 * Datos que solo existen en la web publicada: notify-log.json lo escribe scripts/notify.ts en la pasada del cron,
 * nunca en los PR. Si faltan aquí, su 404 no cuenta como fallo (Arc OS lo pide para sus avisos).
 */
const ONLY_PUBLISHED = ['/data/notify-log.json'];
/**
 * Reglas de axe-core que se miran: contraste, que todo control, enlace e imagen tenga nombre o etiqueta, que lo que
 * hace scroll se pueda alcanzar con el teclado, ARIA bien formado y título y lengua de la página.
 */
const AXE_RULES = [
	'color-contrast', 'label', 'select-name', 'button-name', 'link-name', 'image-alt', 'input-button-name', 'aria-input-field-name',
	'scrollable-region-focusable', 'nested-interactive', 'aria-allowed-attr', 'aria-valid-attr-value', 'aria-required-children',
	'aria-required-parent', 'empty-table-header', 'document-title', 'html-has-lang', 'frame-title', 'list', 'listitem'
];
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

// Para probar solo unas vistas: SMOKE_ONLY=/x/zen,/eco pnpm smoke
const { server, root: ROOT } = await preview(4317);
const failures: string[] = [];
const warnings: string[] = [];
/** Fallos de accesibilidad por vista (axe-core): solo avisan. */
const a11y: string[] = [];
/** Vistas que saltan al cargar (CLS): solo avisan. */
const shifts: string[] = [];

try {
	const browser = await launch();
	for (const mode of MODES)
	for (const width of WIDTHS) {
		const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
		await context.addInitScript(
			([m, style]) => {
				localStorage.setItem('arc-modo', m);
				// Saltos al cargar (CLS): se suman todos desde el primer pintado. Aquí nadie toca la pantalla antes de medir,
				// pero con el móvil emulado Chromium marca como «con toque reciente» (hadRecentInput) lo que pasa en el
				// primer medio segundo, que es justo el salto al arrancar: por eso no se descartan. WebKit no lo mide.
				const w = window as unknown as { __cls: number };
				w.__cls = 0;
				if (PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
					new PerformanceObserver((list) => {
						for (const e of list.getEntries() as (PerformanceEntry & { value: number })[]) w.__cls += e.value;
					}).observe({ type: 'layout-shift', buffered: true });
				}
				if (!style) return;
				localStorage.setItem('arc-style', style);
				localStorage.setItem('arc-theme', 'light');
				localStorage.setItem('arc-accent', 'blue');
			},
			[mode, STYLE]
		);
		// Peso y accesibilidad se miran una vez, en el primer modo.
		const first = mode === MODES[0];
		await context.route('**/*', (route) => {
			const url = new URL(route.request().url());
			// /api/* son Pages Functions: en vite preview no existen. Una respuesta vacía (sin JSON) es «sin cuenta».
			const local = url.hostname === 'localhost' && !url.pathname.startsWith('/api/');
			return local ? route.continue() : route.fulfill({ status: 200, body: '' });
		});
		// La primera vez, la portada lleva a la bienvenida: se comprueba aquí y luego se da por vista.
		const fresh = await context.newPage();
		await fresh.goto(ROOT + '/', { waitUntil: 'networkidle' });
		if (!WEBKIT) await fresh.waitForURL(/\/bienvenida\?primera=1$/, { timeout: 5000 }).catch(() => failures.push(`/ a ${width} px: la primera vez no lleva a la bienvenida`));
		await fresh.close();
		await context.addInitScript(() => {
			if (!localStorage.getItem('arc-welcome')) localStorage.setItem('arc-welcome', JSON.stringify({ v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: '' }));
		});
		for (const path of PATHS) {
			const where = `${path} a ${width} px (${mode})`;
			const page = await context.newPage();
			page.on('console', (m) => {
				// WebKit escribe en la consola cada 404 de /api/* (aquí no hay Pages Functions) y los avisos del widget de
				// TradingView: no dicen nada del diseño, que es lo que mira esa pasada.
				if (m.type() !== 'error' || WEBKIT) return;
				if (/ 404 /.test(m.text()) && ONLY_PUBLISHED.some((f) => m.location().url.endsWith(f))) return;
				failures.push(`${where}: consola: ${m.text()} (${m.location().url})`);
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
				// clientWidth, no innerWidth: en el móvil, innerWidth crece con la página si algo se sale y la resta da 0.
				scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				// Qué se sale: se oculta cada hijo por turnos y se baja por el que quita el scroll.
				culprit: (() => {
					const root = document.documentElement;
					const over = () => root.scrollWidth - root.clientWidth;
					if (over() <= 0) return '';
					const path: string[] = [];
					let el: Element = document.body;
					for (let depth = 0; depth < 14; depth++) {
						const before = over();
						const kid = [...el.children].find((c) => {
							const h = c as HTMLElement;
							const prev = h.style.display;
							h.style.display = 'none';
							const gone = over() < before;
							h.style.display = prev;
							return gone;
						});
						if (!kid) break;
						const cls = [...kid.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 2).join('.');
						path.push(kid.tagName.toLowerCase() + (cls ? '.' + cls : '') + (kid.getAttribute('data-ui') ? `[${kid.getAttribute('data-ui')}]` : ''));
						el = kid;
					}
					return path.slice(-5).join(' > ') + ` «${(el.textContent ?? '').trim().slice(0, 40)}»`;
				})(),
				// Campos con letra de menos de 16 px: Safari del iPhone amplía la página al tocarlos (app.css lo evita).
				zoom: [...document.querySelectorAll<HTMLElement>('input, select, textarea')]
					.filter((e) => !/^(checkbox|radio|range|color|button|submit|hidden)$/.test((e as HTMLInputElement).type) && e.offsetParent)
					.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
					.map((e) => e.id || e.getAttribute('aria-label') || e.tagName.toLowerCase()),
				// Pestañas de arriba (TOP, ECO… y «Más»): todas del mismo alto. Un botón estirado por el mínimo táctil
				// de app.css descolocaba la fila entera.
				keys: [...new Set([...document.querySelectorAll('.keys .key')].map((e) => Math.round(e.getBoundingClientRect().height)))],
				panels: document.querySelectorAll('section.panel').length,
				cls: (window as unknown as { __cls?: number }).__cls ?? 0,
				// Sencillo, sin «Ver todos» ni modo TV: los paneles que no son esenciales ya no están (`gone` en Panel).
				stray: document.documentElement.matches("[data-modo='sencillo']:not([data-all], [data-tv])")
					? [...document.querySelectorAll("[data-ui='panel']:not([data-essential])")].map((s) => s.querySelector('h2')?.textContent?.trim() || '?')
					: [],
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
			if (width < 600 && check.scroll > 0) failures.push(`${where}: scroll horizontal de ${check.scroll} px (${check.culprit})`);
			if (width < 600) for (const f of new Set(check.zoom)) failures.push(`${where}: el campo «${f}» tiene letra de menos de 16 px (el iPhone amplía al tocarlo)`);
			if (check.keys.length > 1) failures.push(`${where}: pestañas de arriba de alturas distintas (${check.keys.join(', ')} px)`);
			if (!NO_PANELS.has(path) && !path.startsWith('/x/') && !check.panels) failures.push(`${where}: sin paneles`);
			for (const text of check.missing) failures.push(`${where}: panel sin datos («${text}»)`);
			for (const text of check.glitches) failures.push(`${where}: «${text}» en la vista`);
			// Una línea por vista: si la vista no ha llegado a arrancar, salen todos sus paneles no esenciales.
			if (check.stray.length) {
				const n = check.stray.length;
				const names = `«${check.stray.slice(0, 3).join('», «')}»${n > 3 ? '…' : ''}`;
				failures.push(`${where}: en Sencillo ${n === 1 ? 'sigue montado un panel no esencial' : `siguen montados ${n} paneles no esenciales`} (${names}): el CSS de Panel los esconde, pero \`gone\` no los quita`);
			}
			if (width < 600 && check.cls > CLS_LIMIT) shifts.push(`${path} (${mode}): ${check.cls.toFixed(2).replace('.', ',')}`);
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
			if (width < 600 && first && weight > WEIGHT_LIMIT && !NO_WEIGHT_LIMIT.has(path)) {
				warnings.push(`${path} pesa ${Math.round(weight / 1024)} KB (gzip, sin terceros); el límite es ${WEIGHT_LIMIT / 1024} KB`);
			}
			await page.close();
		}
		await context.close();
	}
	// Arc OS en el escritorio, con 12 ventanas (scripts/smoke-os.ts).
	if (!WEBKIT) failures.push(...(await osChecks(browser, ROOT)));
	// La pasada acotada de WebKit solo mira el móvil.
	if (!WEBKIT) await keyboard(browser);
	if (!WEBKIT) await bienvenida(browser);
	await browser.close();
} catch (error) {
	failures.push(String(error));
} finally {
	server.kill();
}

/**
 * Teclado (una vez, a 1280 px en modo Sencillo): el primer Tab va a «Saltar al contenido», Esc con un ⓘ abierto solo
 * lo cierra (antes también llevaba a la portada) y saltar a un panel que Sencillo oculta lo enseña y baja hasta él.
 */
async function keyboard(browser: Awaited<ReturnType<typeof launch>>) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	await context.addInitScript(() => {
		localStorage.setItem('arc-modo', 'sencillo');
		localStorage.setItem('arc-welcome', JSON.stringify({ v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: '' }));
	});
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.hostname === 'localhost' && !url.pathname.startsWith('/api/') ? route.continue() : route.fulfill({ status: 200, body: '' });
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => failures.push(`teclado: excepción: ${e.message}`));
	await page.goto(ROOT + '/eco', { waitUntil: 'networkidle' });
	await page.keyboard.press('Tab');
	const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
	if (first !== 'Saltar al contenido') failures.push(`teclado: el primer Tab va a «${first}», no a «Saltar al contenido»`);
	const term = page.locator('button.i').first();
	if (await term.count()) {
		await term.focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
		if (new URL(page.url()).pathname !== '/eco') failures.push(`teclado: Esc con un ⓘ abierto lleva a ${new URL(page.url()).pathname}`);
		if ((await term.getAttribute('aria-expanded')) !== 'false') failures.push('teclado: Esc no cierra el ⓘ');
	}
	await page.goto(ROOT + '/eco#panel=Paro%20juvenil', { waitUntil: 'networkidle' });
	await page.waitForTimeout(800);
	const top = await page.evaluate(() => {
		const panel = [...document.querySelectorAll('section.panel')].find((s) => /paro juvenil/i.test(s.querySelector('h2')?.textContent ?? ''));
		// Sin cajas: está, pero el CSS de Sencillo lo esconde (<html> sin data-all: «Ver todos» no ha pasado por setAll).
		return panel?.getClientRects().length ? Math.round(panel.getBoundingClientRect().top) : null;
	});
	if (top === null || Math.abs(top) > 200) failures.push(`teclado: /eco#panel=Paro juvenil en Sencillo no enseña ni baja al panel (${top})`);
	await context.close();
}

/**
 * BIENVENIDA la primera vez en el móvil (390×844, táctil, sin nada guardado): la primera pregunta se ve sin bajar (por
 * encima de la barra inferior), al abrir no se roba el foco ni se mueve la vista, el indicador de pasos es una sola
 * línea y, al pulsar «Siguiente» desde abajo, el foco va al título del paso nuevo y este se ve.
 */
async function bienvenida(browser: Awaited<ReturnType<typeof launch>>) {
	const where = '/bienvenida?primera=1 a 390×844';
	// Sin animación: el desplazamiento suave acabaría después de la comprobación.
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
	await context.route('**/*', (route) => {
		const url = new URL(route.request().url());
		return url.hostname === 'localhost' && !url.pathname.startsWith('/api/') ? route.continue() : route.fulfill({ status: 200, body: '' });
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => failures.push(`${where}: excepción: ${e.message}`));
	await page.goto(ROOT + '/bienvenida?primera=1', { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	// `fold`: dónde acaba lo visible, el borde de arriba de la barra inferior (o la pantalla, si no está).
	const open = await page.evaluate(() => {
		const fold = document.querySelector('nav.thumb')?.getBoundingClientRect().top || innerHeight;
		const q1 = document.getElementById('q1')?.getBoundingClientRect();
		const steps = [...document.querySelectorAll('.steps li')].filter((li) => li.getBoundingClientRect().width > 1);
		return {
			q1: q1 ? Math.round(q1.bottom) : null,
			fold: Math.round(fold),
			focus: document.activeElement === document.body ? '' : document.activeElement?.id || document.activeElement?.tagName,
			scroll: Math.round(scrollY),
			steps: steps.map((li) => li.getAttribute('aria-current') ?? '-').join(',')
		};
	});
	if (open.q1 === null || open.q1 > open.fold) failures.push(`${where}: «¿Qué te interesa?» acaba en y=${open.q1}, por debajo de la barra inferior (${open.fold})`);
	if (open.focus) failures.push(`${where}: al abrir, el foco ya está en «${open.focus}» (no se roba)`);
	if (open.scroll) failures.push(`${where}: al abrir, la vista ya ha bajado ${open.scroll} px`);
	if (open.steps !== 'step') failures.push(`${where}: el indicador de pasos enseña algo más que el paso actual (${open.steps})`);
	// Desde el final de la página, como quien ha bajado por los temas.
	await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	await page.click('.actions .go');
	const moved = await page.waitForFunction(() => document.activeElement?.id === 'q2', null, { timeout: 2000 }).then(
		() => true,
		() => false
	);
	if (!moved) failures.push(`${where}: tras «Siguiente», el foco está en «${await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)}», no en el título del paso 2`);
	const q2 = await page.evaluate(() => {
		const fold = document.querySelector('nav.thumb')?.getBoundingClientRect().top || innerHeight;
		const top = document.getElementById('q2')?.getBoundingClientRect().top;
		return { top: top === undefined ? null : Math.round(top), fold: Math.round(fold) };
	});
	if (q2.top === null || q2.top < 0 || q2.top >= q2.fold) failures.push(`${where}: tras «Siguiente», «¿Dónde estás?» queda fuera de la pantalla (top ${q2.top}, barra en ${q2.fold})`);
	await context.close();
}

// ::warning:: hace que GitHub muestre el aviso en el resumen de la Action.
for (const w of warnings) console.log(`::warning title=Peso de las vistas::${w}`);
for (const w of a11y) console.log(`::warning title=Accesibilidad (axe-core)::${w}`);
if (shifts.length) console.log(`::warning title=Saltos al cargar (CLS)::Más de ${String(CLS_LIMIT).replace('.', ',')} a 390 px: ${shifts.join(' · ')}`);
if (!a11y.length) console.log(`axe-core: sin fallos de ${AXE_RULES.length} reglas en ${PATHS.length} vistas a 390 px`);

if (failures.length) {
	console.log(`✗ Prueba de humo: ${failures.length} fallos\n${failures.map((f) => `  - ${f}`).join('\n')}`);
	process.exit(1);
}
console.log(`✓ Prueba de humo: ${PATHS.length} vistas a ${WIDTHS.join(' y ')} px, en modo ${MODES.join(' y ')}, sin errores`);
