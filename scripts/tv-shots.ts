/// <reference types="node" />
// Herramienta de desarrollo: capturas de los widgets de TradingView en tema oscuro y claro, para revisar
// sus colores. Solo se ejecuta en los PR (la sesión de desarrollo no llega a tradingview.com). Guarda los
// PNG en shots/ (la Action los sube como artefacto) y escribe en el registro los colores que más se
// repiten en cada widget, junto a los tokens --panel y --line, para compararlos sin abrir las imágenes.
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Locator, Page } from 'playwright-core';
import { launch, preview } from './browser.ts';

const PAGES = ['/', '/ws', '/s?sym=NVDA', '/cal', '/mis'];
const THEMES = ['dark', 'light'] as const;

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

/** Principio del texto que muestra el widget dentro de su iframe (avisos como «símbolo no disponible»). */
async function frameText(el: Locator): Promise<string> {
	try {
		const frame = await (await el.locator('iframe').first().elementHandle())?.contentFrame();
		const text = (await frame?.locator('body').innerText({ timeout: 3000 })) ?? '';
		return text.replace(/\s+/g, ' ').trim().slice(0, 400);
	} catch {
		return '(sin texto)';
	}
}

const { server, root: ROOT } = await preview(4318);
mkdirSync('shots', { recursive: true });

try {
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
				await page.waitForTimeout(3000);
			}
			await page.waitForTimeout(6000);
			console.log(`\nSHOTS ${theme} ${path} · --panel ${tokens.panel} · --line ${tokens.line}`);
			// En WS, si hay selector de mapa de calor, una captura de cada mapa (comprueba que cargan).
			const maps = page.locator('.maps button');
			for (let m = 0; m < (await maps.count()); m++) {
				await maps.nth(m).click();
				await page.waitForTimeout(5000);
				const el = page.locator('.tv[data-widget$="heatmap"]').first();
				const png = await el.screenshot();
				const label = (await maps.nth(m).textContent())?.trim() ?? String(m);
				writeFileSync(`shots/${theme}-map-${label.replace(/\W+/g, '_')}.png`, png);
				console.log(`  mapa ${label}: ${(await topColors(page, png)).join(' · ')}`);
				if (theme === 'dark') console.log(`    texto: ${await frameText(el)}`);
			}
			// En WS, una captura de cada bolsa del panel «Los que más se mueven» (comprueba que el widget la admite).
			const hots = page.locator('.hot button');
			for (let h = 0; h < (await hots.count()); h++) {
				await hots.nth(h).click();
				await page.waitForTimeout(5000);
				const el = page.locator('.tv[data-widget="hotlists"]').first();
				const png = await el.screenshot();
				const label = (await hots.nth(h).textContent())?.trim() ?? String(h);
				writeFileSync(`shots/${theme}-hot-${label.replace(/\W+/g, '_')}.png`, png);
				console.log(`  bolsa ${label}: ${(await topColors(page, png)).join(' · ')}`);
				if (theme === 'dark') console.log(`    texto: ${await frameText(el)}`);
			}
			for (let i = 0; i < n; i++) {
				const el = widgets.nth(i);
				const name = (await el.getAttribute('data-widget')) ?? `widget${i}`;
				await el.scrollIntoViewIfNeeded();
				const png = await el.screenshot();
				const file = `shots/${theme}-${path.replace(/\W+/g, '_') || 'top'}-${i}-${name}.png`;
				writeFileSync(file, png);
				console.log(`  ${name}: ${(await topColors(page, png)).join(' · ')}`);
				if (theme === 'dark') console.log(`    texto: ${await frameText(el)}`);
			}
			await page.close();
		}
		await context.close();
	}
	await browser.close();
} finally {
	server.kill();
}
