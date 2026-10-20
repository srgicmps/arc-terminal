/// <reference types="node" />
// Core Web Vitals de laboratorio en el móvil (`pnpm vitals`, después de `pnpm build` y con static/data). Abre TOP, GEO,
// WS y FUEL a 390×844 con Chromium, la CPU 4 veces más lenta y una 4G lenta, sin service worker, y mide:
// - LCP: cuándo se pinta lo más grande de la vista (bueno, hasta 2,5 s);
// - CLS: cuánto salta la vista mientras carga (bueno, hasta 0,1), como lo cuenta web.dev: la peor ráfaga de saltos
//   (sessionCls), no la suma de todos;
// - TBT aproximado: lo que el hilo principal pasa bloqueado (tareas de más de 50 ms). Sin nadie tocando la pantalla no
//   hay INP, y el TBT es lo que más se le parece en el laboratorio.
// Tres cargas en frío por vista y perfil (Terminal y Sencillo); se queda la mediana. Solo AVISA (::warning) si una vista
// pasa de su presupuesto (BUDGETS) y deja una tabla en el resumen de la Action. Nunca falla: es una medida de
// laboratorio (vite preview, sin Access ni CDN, en un runner compartido) y no se compara una a una con la de los usuarios.
// TradingView y las demás webs de fuera se contestan vacías (varían mucho y no dependen de nosotros), igual que /api/*
// (Pages Functions, que en vite preview no existen). Google Fonts, no: el salto al cambiar de letra es real.
// VITALS_VIEWS (por comas), VITALS_RUNS, VITALS_PROFILES (terminal,sencillo) y VITALS_PORT (4322) cambian la pasada.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Umbrales de «bueno» de web.dev: LCP en ms, CLS sin unidad. */
export interface Budget {
	lcp: number;
	cls: number;
}
export const GOOD: Budget = { lcp: 2500, cls: 0.1 };

/**
 * Excepciones al presupuesto, en modo trinquete: una vista que ya pase de «bueno» lleva aquí su medida de partida +15 %,
 * para que el aviso salte cuando empeora y no en cada PR; cuando baje de «bueno», se le quita. Las demás usan GOOD.
 * Hoy no hay ninguna: en el runner de GitHub (octubre de 2026) las cuatro vistas cargan en 1,4-1,8 s y saltan como mucho
 * 0,06. Los 5,7 s de GEO de la medida de partida eran el aviso «No se ha podido cargar TradingView», que salía porque se
 * cortaba su script; y TOP y WS ya no saltan al cargar desde #619 y #621.
 */
export const BUDGETS: Record<string, Budget> = {};
export const budgetFor = (path: string): Budget => BUDGETS[path] ?? GOOD;

/** Perfiles que se miden: modo y estética fijados para que la medida no cambie sola (app.html decide sin ellos). */
export const PROFILES = [
	{ id: 'terminal', name: 'Terminal', modo: 'terminal', style: 'terminal' },
	// Lo que ve quien llega nuevo: Sencillo con Grafito (app.html, sin nada guardado).
	{ id: 'sencillo', name: 'Sencillo', modo: 'sencillo', style: 'grafito' }
] as const;
export type Profile = (typeof PROFILES)[number];

/** Lo que se queda de una vista en un perfil (medianas). */
export interface Vitals {
	lcp: number;
	cls: number;
	tbt: number;
	/** KB de la propia web que descarga (comprimidos, como llegan por la red). */
	selfKB: number;
	/** false si Google Fonts no cargó en alguna de las cargas: el LCP puede salir más alto. */
	fonts: boolean;
	/** Qué es el LCP (en la carga de la mediana): «p.sum «Riesgo: risk-off…»». */
	el?: string;
}
export interface Row {
	path: string;
	profile: string;
	vitals: Vitals;
	budget: Budget;
}

/** Mediana; con un número par de valores, la media de los dos del centro. */
export function median(values: number[]): number {
	if (!values.length) return NaN;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Un salto de la vista (layout-shift sin que nadie haya tocado la pantalla): cuándo (ms) y cuánto. */
export interface Shift {
	t: number;
	v: number;
}

/**
 * CLS como lo cuenta web.dev: los saltos se agrupan en «ventanas de sesión» (cada salto a menos de 1 s del anterior y
 * la ventana de 5 s como mucho) y el CLS es la ventana que más suma. Así, dos saltos pequeños separados no se suman.
 */
export function sessionCls(shifts: Shift[]): number {
	let worst = 0;
	let sum = 0;
	let first = 0;
	let last = 0;
	[...shifts]
		.sort((a, b) => a.t - b.t)
		.forEach((s, i) => {
			if (i > 0 && s.t - last < 1000 && s.t - first < 5000) sum += s.v;
			else {
				sum = s.v;
				first = s.t;
			}
			last = s.t;
			worst = Math.max(worst, sum);
		});
	return worst;
}

/** Qué pasa del presupuesto (estrictamente por encima: igual, no avisa). */
export function overBudget(v: Pick<Vitals, 'lcp' | 'cls'>, b: Budget): ('LCP' | 'CLS')[] {
	const out: ('LCP' | 'CLS')[] = [];
	if (v.lcp > b.lcp) out.push('LCP');
	if (v.cls > b.cls) out.push('CLS');
	return out;
}

/** «1,7 s», «0,129», con coma decimal. */
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
export const shift = (cls: number) => cls.toFixed(3).replace('.', ',');
/** Sin ceros de más: «2,5», «0,1». */
const plain = (n: number) => String(n).replace('.', ',');
/** Un presupuesto: «2,5 s · 0,1». */
const limit = (b: Budget) => `${plain(b.lcp / 1000)} s · ${plain(b.cls)}`;
/** ¿Usa la vista el presupuesto «bueno» de siempre (no tiene uno propio en BUDGETS)? */
const isGood = (b: Budget) => b.lcp === GOOD.lcp && b.cls === GOOD.cls;
/** Nombre de la vista como en la barra de comandos: «/» es TOP. */
export const viewName = (path: string) => (path === '/' ? 'TOP' : path.replace(/^\//, '').toUpperCase());

/**
 * Tabla en Markdown para el resumen de la Action. Seis columnas cortas para que se lea a 390 px: los presupuestos propios
 * (BUDGETS), si hay alguno, van en una nota debajo y no en una columna más.
 */
export function summaryTable(rows: Row[], runs = 3): string {
	const mark = (over: boolean) => (over ? ' ⚠' : '');
	const lines = rows.map(({ path, profile, vitals: v, budget: b }) => {
		const over = overBudget(v, b);
		const lcp = `${seconds(v.lcp)}${mark(over.includes('LCP'))}${v.fonts ? '' : ' ¹'}`;
		return `| ${viewName(path)} | ${profile} | ${lcp} | ${shift(v.cls)}${mark(over.includes('CLS'))} | ${seconds(v.tbt)} | ${v.selfKB} |`;
	});
	// Una vez por vista, aunque salga en los dos perfiles.
	const own = [...new Map(rows.filter((r) => !isGood(r.budget)).map((r) => [r.path, `${viewName(r.path)}, ${limit(r.budget)}`])).values()];
	const fonts = rows.some((r) => !r.vitals.fonts) ? ['', '¹ Google Fonts no cargó en alguna carga: el LCP puede salir más alto.'] : [];
	return [
		'### Core Web Vitals en el móvil (laboratorio)',
		'',
		`390×844, CPU 4x y 4G lenta (150 ms, 1,6 Mbps), sin service worker ni TradingView; mediana de ${runs} ${runs === 1 ? 'carga' : 'cargas'} en frío.`,
		'Terminal: modo y estética Terminal. Sencillo: modo Sencillo con Grafito, lo que ve quien llega nuevo.',
		'',
		'| Vista | Perfil | LCP | CLS | TBT | KB |',
		'|---|---|--:|--:|--:|--:|',
		...lines,
		'',
		`⚠ pasa del presupuesto (solo avisa). Bueno, según web.dev: LCP hasta ${plain(GOOD.lcp / 1000)} s y CLS hasta ${plain(GOOD.cls)}.`,
		...(own.length ? [`Presupuesto propio (LCP · CLS), su medida de partida +15 % (BUDGETS en scripts/vitals.ts): ${own.join('; ')}.`] : []),
		'TBT (aproximado): lo que pasan de 50 ms las tareas largas hasta 4 s después de cargar; sin nadie tocando la pantalla, es lo que más se parece al INP.',
		'KB: lo que descarga de la propia web, comprimido como llega por la red.',
		...fonts
	].join('\n');
}

/** Un aviso por vista y perfil que pasa de su presupuesto. */
export function warnings(rows: Row[]): string[] {
	return rows.flatMap(({ path, profile, vitals: v, budget: b }) => {
		const over = overBudget(v, b);
		if (!over.length) return [];
		const parts = over.map((k) => (k === 'LCP' ? `LCP ${seconds(v.lcp)} (presupuesto ${seconds(b.lcp)})` : `CLS ${shift(v.cls)} (presupuesto ${shift(b.cls)})`));
		const what = over.includes('LCP') && v.el ? `; el LCP es ${v.el}` : '';
		const fonts = v.fonts ? '' : '; Google Fonts no cargó en esta pasada y puede subir el LCP';
		return [`${viewName(path)} (${profile}): ${parts.join(' y ')} en el móvil con la CPU 4x y 4G lenta${what}${fonts}`];
	});
}

/** Una carga en frío: lo que miden los observadores de la página y lo que baja por la red. */
interface Run {
	lcp: number;
	cls: number;
	tbt: number;
	el: string;
	selfBytes: number;
	fontsOk: boolean;
}

async function main() {
	const { launch, preview } = await import('./browser.ts');
	const VIEWS = (process.env.VITALS_VIEWS ?? '/,/geo,/ws,/fuel').split(',').map((v) => v.trim()).filter(Boolean);
	const RUNS = Math.max(1, Number(process.env.VITALS_RUNS ?? 3) || 3);
	// 4322, libre: del 4317 al 4321 son de smoke, e2e-os, tv-shots, compare, smoke-vistas-os y smoke-sw.
	const PORT = Number(process.env.VITALS_PORT ?? 4322);
	const wanted = process.env.VITALS_PROFILES?.split(',').map((p) => p.trim());
	const profiles = PROFILES.filter((p) => !wanted || wanted.includes(p.id));
	const started = Date.now();
	const root = `http://localhost:${PORT}`;
	// Si ya hay algo en el puerto (un vite preview de antes), se mediría esa web y no la de ahora.
	if (await fetch(`${root}/`).then(() => true, () => false)) throw new Error(`el puerto ${PORT} ya está ocupado; prueba con otro (VITALS_PORT)`);
	const { server } = await preview(PORT);
	const browser = await launch();
	const rows: Row[] = [];
	const failed: string[] = [];

	async function load(path: string, profile: Profile): Promise<Run> {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
			colorScheme: 'dark',
			userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
			serviceWorkers: 'block'
		});
		try {
			await context.addInitScript(
				([modo, style]) => {
					try {
						localStorage.setItem('arc-welcome', JSON.stringify({ v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: '' }));
						localStorage.setItem('arc-modo', modo);
						localStorage.setItem('arc-style', style);
						// Los avisos de una sola vez (Modo OS a los 3 s, «Instalar» a los 4 s) se dan por vistos: según cuándo
						// llegaran, serían o no lo más grande pintado y el LCP bailaría de una carga a otra.
						localStorage.setItem('arc-os-invite', '1');
						localStorage.setItem('arc-install-hint', 'no');
					} catch {}
					const w = window as unknown as { __vitals: { lcp: number; shifts: Shift[]; tbt: number; el: string } };
					w.__vitals = { lcp: 0, shifts: [], tbt: 0, el: '' };
					const watch = (type: string, fn: (e: PerformanceEntry) => void) => {
						if (PerformanceObserver.supportedEntryTypes?.includes(type)) new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true });
					};
					watch('largest-contentful-paint', (e) => {
						w.__vitals.lcp = e.startTime;
						// Qué es (etiqueta, clase y el principio del texto), para el aviso.
						const el = (e as PerformanceEntry & { element: Element | null }).element;
						const cls = el ? [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 2).map((c) => '.' + c).join('') : '';
						const text = (el?.textContent ?? '').trim().replace(/\s+/g, ' ');
						w.__vitals.el = el ? `${el.tagName.toLowerCase()}${cls}${text ? ` «${text.slice(0, 30)}${text.length > 30 ? '…' : ''}»` : ''}` : '';
					});
					// Cada salto por separado: el CLS (la peor ventana de sesión) se calcula después, en sessionCls.
					watch('layout-shift', (e) => {
						const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
						if (!s.hadRecentInput) w.__vitals.shifts.push({ t: s.startTime, v: s.value });
					});
					watch('longtask', (e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)));
				},
				[profile.modo, profile.style]
			);
			// Lo de fuera, salvo Google Fonts, y /api/* («sin cuenta») se contestan vacíos. Vacíos y no cortados: con el
			// script de TradingView cortado, la vista pinta «No se ha podido cargar TradingView» y ese texto pasaba a ser el
			// LCP (los 5,7 s de GEO de la medida de partida). Vacío, el widget se da por cargado, como en el móvil, donde
			// lo que pinta TradingView va en su iframe y no cuenta en el LCP de la página.
			await context.route(
				(url) => (url.origin === root ? url.pathname.startsWith('/api/') : !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)),
				(route) => route.fulfill({ status: 200, body: '' })
			);
			const page = await context.newPage();
			const cdp = await context.newCDPSession(page);
			await cdp.send('Network.enable');
			await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
			await cdp.send('Network.emulateNetworkConditions', {
				offline: false,
				latency: 150,
				downloadThroughput: (1.6 * 1024 * 1024) / 8,
				uploadThroughput: (750 * 1024) / 8
			});
			const urls = new Map<string, string>();
			let selfBytes = 0;
			let fontsOk = true;
			const isFont = (u: string) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
			cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));
			cdp.on('Network.loadingFinished', (e) => {
				if ((urls.get(e.requestId) ?? '').startsWith(root)) selfBytes += e.encodedDataLength;
			});
			cdp.on('Network.loadingFailed', (e) => {
				if (isFont(urls.get(e.requestId) ?? '')) fontsOk = false;
			});
			await page.goto(root + path, { waitUntil: 'load', timeout: 60_000 });
			// Sin tocar nada: el LCP y los saltos que llegan después del «load» (datos, mapas, letra) también cuentan.
			await page.waitForTimeout(4000);
			const { shifts, ...m } = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; shifts: Shift[]; tbt: number; el: string } }).__vitals);
			return { ...m, cls: sessionCls(shifts), selfBytes, fontsOk };
		} finally {
			await context.close();
		}
	}

	try {
		for (const path of VIEWS)
			for (const profile of profiles) {
				try {
					const runs: Run[] = [];
					for (let i = 0; i < RUNS; i++) runs.push(await load(path, profile));
					const pick = (k: 'lcp' | 'cls' | 'tbt' | 'selfBytes') => median(runs.map((r) => r[k]));
					const lcp = pick('lcp');
					const vitals: Vitals = {
						lcp: Math.round(lcp),
						cls: Number(pick('cls').toFixed(3)),
						tbt: Math.round(pick('tbt')),
						selfKB: Math.round(pick('selfBytes') / 1024),
						fonts: runs.every((r) => r.fontsOk),
						// El de la carga más cercana a la mediana.
						el: runs.reduce((a, b) => (Math.abs(b.lcp - lcp) < Math.abs(a.lcp - lcp) ? b : a)).el
					};
					rows.push({ path, profile: profile.name, vitals, budget: budgetFor(path) });
					console.log(`${viewName(path).padEnd(5)} ${profile.name.padEnd(9)} LCP ${seconds(vitals.lcp)} · CLS ${shift(vitals.cls)} · TBT ${seconds(vitals.tbt)} · ${vitals.selfKB} KB`);
				} catch (error) {
					failed.push(`${viewName(path)} (${profile.name}): ${String(error).split('\n')[0]}`);
				}
			}
	} finally {
		await browser.close().catch(() => {});
		server.kill();
	}

	const table = summaryTable(rows, RUNS);
	console.log(`\n${table}\n`);
	if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
	// ::warning:: hace que GitHub enseñe el aviso en el resumen de la Action y en el PR. El texto del LCP viene de los
	// datos: un «%» o un salto de línea romperían el comando.
	const escape = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
	for (const w of warnings(rows)) console.log(`::warning title=Core Web Vitals::${escape(w)}`);
	for (const f of failed) console.log(`::warning title=Core Web Vitals::no se ha podido medir ${escape(f)}`);
	const secs = Math.round((Date.now() - started) / 1000);
	console.log(`Core Web Vitals: ${rows.length} medidas (${VIEWS.length} vistas × ${profiles.length} perfiles × ${RUNS} cargas) en ${Math.floor(secs / 60)} min ${secs % 60} s`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		await main();
	} catch (error) {
		// Nunca pone el PR en rojo: si algo falla, se dice y ya.
		console.log(`::warning title=Core Web Vitals::no se ha podido medir: ${String(error).split('\n')[0]}`);
	}
	process.exit(0);
}
