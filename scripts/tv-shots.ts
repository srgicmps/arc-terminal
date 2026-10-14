/// <reference types="node" />
// Herramienta de desarrollo: capturas de los widgets de TradingView en tema oscuro y claro, para revisar
// sus colores. Solo se ejecuta en los PR (la sesión de desarrollo no llega a tradingview.com). Guarda los
// PNG en shots/ (la Action los sube como artefacto) y escribe en el registro los colores que más se
// repiten en cada widget, junto a los tokens --panel y --line, para compararlos sin abrir las imágenes.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright-core';

const PORT = 4318;
const ROOT = `http://localhost:${PORT}/arc-terminal`;
const PAGES = ['/', '/ws', '/s?sym=NVDA', '/cal', '/mis'];
const THEMES = ['dark', 'light'] as const;

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

/** Los 3 colores más repetidos de una captura (agrupados de 8 en 8 por canal), con su parte del total. */
function topColors(page: Page, png: Buffer): Promise<string[]> {
	return page.evaluate(async (b64) => {
		const img = new Image();
		img.src = `data:image/png;base64,${b64}`;
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		const { data } = ctx.getImageData(0, 0, img.width, img.height);
		const counts = new Map<string, number>();
		for (let i = 0; i < data.length; i += 4) {
			const hex = [0, 1, 2].map((c) => (data[i + c] & 0xf8).toString(16).padStart(2, '0')).join('');
			counts.set(hex, (counts.get(hex) ?? 0) + 1);
		}
		const total = data.length / 4;
		return [...counts]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([hex, n]) => `#${hex} ${Math.round((n / total) * 100)} %`);
	}, png.toString('base64'));
}

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
mkdirSync('shots', { recursive: true });

try {
	await waitForServer();
	const browser = await launch();
	for (const theme of THEMES) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		await context.addInitScript((t) => {
			localStorage.setItem('arc-theme', t);
			localStorage.setItem('arc-watchlist', JSON.stringify(['NVDA', 'AAPL', 'SAN']));
		}, theme);
		for (const path of PAGES) {
			const page = await context.newPage();
			await page.goto(ROOT + path, { waitUntil: 'load' });
			const tokens = await page.evaluate(() => {
				const s = getComputedStyle(document.documentElement);
				return { panel: s.getPropertyValue('--panel').trim(), line: s.getPropertyValue('--line').trim() };
			});
			const widgets = page.locator('.tv');
			const n = await widgets.count();
			// Los widgets se cargan al acercarse a la vista: se recorren uno a uno.
			for (let i = 0; i < n; i++) {
				await widgets.nth(i).scrollIntoViewIfNeeded();
				await page.waitForTimeout(2500);
			}
			await page.waitForTimeout(4000);
			console.log(`\nSHOTS ${theme} ${path} · --panel ${tokens.panel} · --line ${tokens.line}`);
			for (let i = 0; i < n; i++) {
				const el = widgets.nth(i);
				const name = (await el.getAttribute('data-widget')) ?? `widget${i}`;
				await el.scrollIntoViewIfNeeded();
				const png = await el.screenshot();
				const file = `shots/${theme}-${path.replace(/\W+/g, '_') || 'top'}-${i}-${name}.png`;
				writeFileSync(file, png);
				console.log(`  ${name}: ${(await topColors(page, png)).join(' · ')}`);
			}
			await page.close();
		}
		await context.close();
	}
	await browser.close();
} finally {
	server.kill();
}
