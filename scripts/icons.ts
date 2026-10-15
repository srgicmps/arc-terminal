// Rehace los iconos de la app (PWA) y las pantallas de arranque del iPhone a partir del logo.
// Uso: node scripts/icons.ts (necesita Chromium; en la nube, PLAYWRIGHT_BROWSERS_PATH o CHROMIUM_PATH).
// El logo es el de static/favicon.svg: si cambia, se edita allí y se vuelve a lanzar este script.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

/** Fondo de la app (--bg de tokens.css): los PNG no pueden leer variables. */
const BG = '#080a0d';
const svg = await readFile('static/favicon.svg', 'utf8');

/** [archivo, ancho, alto, tamaño del logo respecto al lado corto] */
const ICONS: [string, number, number, number][] = [
	['icon-192.png', 192, 192, 0.72],
	['icon-512.png', 512, 512, 0.72],
	// Maskable: Android recorta un círculo; el logo va dentro del 80 % central.
	['icon-maskable-512.png', 512, 512, 0.56],
	['apple-touch-icon.png', 180, 180, 0.68],
	// Pantallas de arranque de iOS (apple-touch-startup-image), en vertical. Ver src/app.html.
	['splash-1290x2796.png', 1290, 2796, 0.22],
	['splash-1179x2556.png', 1179, 2556, 0.22],
	['splash-1170x2532.png', 1170, 2532, 0.22],
	['splash-1125x2436.png', 1125, 2436, 0.22],
	['splash-828x1792.png', 828, 1792, 0.22]
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const [file, w, h, k] of ICONS) {
	const size = Math.round(Math.min(w, h) * k);
	await page.setViewportSize({ width: w, height: h });
	await page.setContent(
		`<body style="margin:0;height:100vh;display:grid;place-items:center;background:${BG}">` +
			svg.replace('<svg ', `<svg width="${size}" height="${size}" `) +
			'</body>'
	);
	await writeFile(`static/${file}`, await page.screenshot({ type: 'png' }));
	console.log(file);
}
await browser.close();
