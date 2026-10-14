/// <reference types="node" />
// Herramienta de los PR: compara cada vista del PR con la de main, con los mismos datos reales, a 390 px.
// Uso: `node scripts/compare-views.ts [carpeta]` después de `pnpm build`. La carpeta es main ya construido;
// sin ella, el script trae main a ../main (git worktree), le copia static/data y lo construye.
// Cuenta, por vista y por panel, las filas de tabla y los elementos de lista que se ven, saca una captura
// de página entera de cada versión en shots/vistas/ (la Action la sube como artefacto «vistas») y deja la
// tabla vista → filas antes/después en el registro, en el resumen de la Action y como aviso (::notice::).
// No falla nunca: es para revisar a ojo, no para frenar el PR.
import { execSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { COMMANDS } from '../src/lib/commands.ts';
import { launch, preview } from './browser.ts';

const PATHS = [...COMMANDS.map((c) => c.route), '/s?sym=NVDA'];
const mainDir = process.argv[2] ?? '../main';
if (!process.argv[2] && !existsSync(mainDir)) {
	const sh = (cmd: string, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
	sh('git fetch --depth 1 origin main');
	sh(`git worktree add ${mainDir} FETCH_HEAD`);
	cpSync('static/data', `${mainDir}/static/data`, { recursive: true });
	sh('pnpm install --frozen-lockfile', mainDir);
	sh('pnpm build --logLevel warn', mainDir);
}

/** Lo que se ve de una vista: total de filas y de elementos de lista, y lo mismo por panel. */
interface Count {
	rows: number;
	items: number;
	panels: Record<string, string>;
}

async function count(root: string, label: string): Promise<Record<string, Count>> {
	const browser = await launch();
	const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
	// La lista de MIS no puede salir vacía; las otras webs (TradingView…) se contestan vacías.
	await context.addInitScript(() => localStorage.setItem('arc-watchlist', JSON.stringify(['NVDA', 'AAPL', 'SAN'])));
	await context.route('**/*', (route) =>
		new URL(route.request().url()).hostname === 'localhost'
			? route.continue()
			: route.fulfill({ status: 200, body: '' })
	);
	const out: Record<string, Count> = {};
	for (const path of PATHS) {
		const page = await context.newPage();
		try {
			await page.goto(root + path, { waitUntil: 'networkidle' });
			await page.waitForTimeout(300);
			out[path] = await page.evaluate(() => {
				const seen = (e: Element) => (e as HTMLElement).offsetParent !== null;
				const rows = (el: ParentNode) =>
					[...el.querySelectorAll('tr')].filter((r) => r.querySelector('td') && seen(r)).length;
				const items = (el: ParentNode) => [...el.querySelectorAll('li')].filter(seen).length;
				const main = document.querySelector('main') ?? document.body;
				const panels: Record<string, string> = {};
				for (const p of main.querySelectorAll('section.panel')) {
					const name = p.querySelector('h2')?.textContent?.trim() || '?';
					let key = name;
					for (let i = 2; key in panels; i++) key = `${name} ${i}`;
					panels[key] = `${rows(p)}/${items(p)}`;
				}
				return { rows: rows(main), items: items(main), panels };
			});
			const file = `shots/vistas/${path.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'top'}-${label}.png`;
			await page.screenshot({ path: file, fullPage: true });
		} catch (error) {
			console.log(`${path} (${label}): ${String(error).split('\n')[0]}`);
		}
		await page.close();
	}
	await browser.close();
	return out;
}

mkdirSync('shots/vistas', { recursive: true });
const after = await preview(4319);
const before = await preview(4320, mainDir);
let now: Record<string, Count>, then: Record<string, Count>;
try {
	now = await count(after.root, 'despues');
	then = await count(before.root, 'antes');
} finally {
	after.server.kill();
	before.server.kill();
}

const lines = [
	'| Vista | Filas antes → después | Listas antes → después | |',
	'|---|---|---|---|',
	...PATHS.map((path) => {
		const a = then[path];
		const b = now[path];
		if (!a || !b) return `| \`${path}\` | ? | ? | sin datos |`;
		const changed = a.rows !== b.rows || a.items !== b.items;
		const panels = Object.keys({ ...a.panels, ...b.panels })
			.filter((k) => a.panels[k] !== b.panels[k])
			.map((k) => `${k}: ${a.panels[k] ?? '–'} → ${b.panels[k] ?? '–'}`)
			.join('; ');
		return `| \`${path}\` | ${a.rows} → ${b.rows} | ${a.items} → ${b.items} | ${changed ? `**cambia** ${panels}` : ''} |`;
	})
];
const table = lines.join('\n');
console.log(`\nFilas y listas por vista a 390 px (main → PR; por panel, filas/listas):\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY)
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Filas por vista (main → PR, 390 px)\n\n${table}\n`);
// El aviso se lee también por la API (anotaciones de la comprobación), sin descargar el registro.
console.log(
	`::notice title=Filas por vista (main → PR)::${table.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`
);
