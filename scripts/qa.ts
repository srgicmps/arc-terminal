/// <reference types="node" />
// QA (borrador, no se mezcla): revisa cada vista a 390 y 1280 px, en tema oscuro y claro, y escribe en el
// registro: elementos que se salen de la pantalla, texto con poco contraste, zonas táctiles pequeñas,
// textos rotos («undefined», «NaN», «Invalid Date», «null») e imágenes locales que no cargan.
import { COMMANDS } from '../src/lib/commands.ts';
import { launch, preview } from './browser.ts';

const PATHS = [...COMMANDS.map((c) => c.route), '/s?sym=NVDA'];
const { server, root } = await preview(4319);
const browser = await launch();

for (const scheme of ['dark', 'light'] as const) {
	for (const width of [390, 1280]) {
		const mobile = width < 600;
		const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
		await context.route('**/*', (route) => {
			const url = new URL(route.request().url());
			return url.hostname === 'localhost' ? route.continue() : route.fulfill({ status: 200, body: '' });
		});
		for (const path of PATHS) {
			const page = await context.newPage();
			await page.goto(root + path, { waitUntil: 'networkidle' });
			await page.waitForTimeout(300);
			const r = await page.evaluate((mobile) => {
				const W = window.innerWidth;
				const desc = (el: Element) => {
					const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
					const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
					return `${el.tagName.toLowerCase()}${cls}${txt ? ` «${txt}»` : ''}`;
				};
				const clipped = (el: Element) => {
					for (let p = el.parentElement; p; p = p.parentElement) {
						const o = getComputedStyle(p).overflowX;
						if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
					}
					return false;
				};
				const visible = (el: Element) => {
					const s = getComputedStyle(el);
					const rect = el.getBoundingClientRect();
					return s.visibility !== 'hidden' && s.display !== 'none' && rect.width > 0 && rect.height > 0 && Number(s.opacity) > 0.05;
				};
				const all = [...document.querySelectorAll('body *')].filter((el) => !el.closest('iframe, svg, .sr, .tradingview-widget-container'));
				// 1. Se sale por la derecha sin un padre con scroll.
				const overflow = all
					.filter((el) => visible(el) && el.getBoundingClientRect().right > W + 1 && !clipped(el))
					.slice(0, 6)
					.map((el) => `${desc(el)} (${Math.round(el.getBoundingClientRect().right - W)} px)`);
				// 2. Contraste del texto con el fondo efectivo.
				const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
				const lum = ([r, g, b]: number[]) => {
					const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
					return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
				};
				const bgOf = (el: Element | null): number[] => {
					for (let p = el; p; p = p.parentElement) {
						const c = rgb(getComputedStyle(p).backgroundColor);
						if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c;
					}
					return rgb(getComputedStyle(document.body).backgroundColor);
				};
				const lowContrast: string[] = [];
				for (const el of all) {
					if (lowContrast.length >= 6) break;
					const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
					if (!hasText || !visible(el)) continue;
					const fg = rgb(getComputedStyle(el).color);
					const bg = bgOf(el);
					const a = lum(fg), b = lum(bg);
					const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
					if (ratio < 3) lowContrast.push(`${desc(el)} ${ratio.toFixed(2)}:1`);
				}
				// 3. Zonas táctiles pequeñas (solo móvil): botones, pestañas, selects, inputs, summary.
				const small = mobile
					? all
							.filter((el) => el.matches('button, select, input, summary, [role=button], [role=tab]') && visible(el))
							.filter((el) => {
								const r = el.getBoundingClientRect();
								return r.height < 24 || r.width < 24;
							})
							.slice(0, 6)
							.map((el) => {
								const r = el.getBoundingClientRect();
								return `${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`;
							})
					: [];
				// 4. Textos rotos.
				const text = document.body.innerText;
				const broken = [...text.matchAll(/.{0,30}\b(undefined|NaN|Invalid Date|null)\b.{0,30}/g)].map((m) => m[0]).slice(0, 5);
				// 5. Imágenes locales que no cargan.
				const images = [...document.images].filter((i) => i.src.includes('localhost') && i.complete && !i.naturalWidth).map((i) => i.src);
				return { overflow, lowContrast, small, broken, images };
			}, mobile);
			const where = `${path} · ${width} px · ${scheme}`;
			for (const [k, v] of Object.entries(r)) if (v.length) console.log(`QA ${where} · ${k}: ${v.join(' | ')}`);
			await page.close();
		}
		await context.close();
	}
}
await browser.close();
server.kill();
console.log('QA: fin');
