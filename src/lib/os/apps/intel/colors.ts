// Colores y letra de los tokens, ya resueltos, para pintar en un <canvas> (que no entiende var() ni color-mix()).
// Se resuelven con un elemento de prueba: su `color` calculado siempre sale en rgb().
import type { Kind } from './model.ts';

export const KIND_TOKEN: Record<Kind, string> = {
	country: 'cmd-country',
	leader: 'cmd-leader',
	bank: 'cmd-bank',
	ticker: 'cmd-ticker',
	sanction: 'cmd-sanction',
	event: 'cmd-event',
	story: 'cmd-story'
};

const BASE = ['cmd-bg', 'cmd-grid', 'cmd-edge', 'cmd-edge-hot', 'cmd-halo', 'cmd-label', 'cmd-label-bg', 'muted', 'faint', 'line', 'amber'];

export interface Palette {
	color: Record<string, string>;
	mono: string;
	sans: string;
	/** Tamaños de letra en px. */
	xs: number;
	xxs: number;
	rMin: number;
	rMax: number;
}

export function readPalette(el: HTMLElement): Palette {
	const probe = document.createElement('span');
	probe.style.display = 'none';
	el.appendChild(probe);
	const color: Record<string, string> = {};
	for (const name of [...BASE, ...Object.values(KIND_TOKEN)]) {
		probe.style.color = `var(--${name})`;
		color[name] = getComputedStyle(probe).color;
	}
	probe.remove();
	const cs = getComputedStyle(el);
	const px = (name: string, fallback: number) => parseFloat(cs.getPropertyValue(`--${name}`)) || fallback;
	return {
		color,
		mono: cs.getPropertyValue('--mono').trim() || 'monospace',
		sans: cs.getPropertyValue('--sans').trim() || 'sans-serif',
		xs: px('fs-xs', 11),
		xxs: px('fs-xxs', 10),
		rMin: px('cmd-node-r', 5),
		rMax: px('cmd-node-r-max', 14)
	};
}

/** Vuelve a leer la paleta cuando cambian el tema, la estética o el acento. Devuelve cómo dejar de mirar. */
export function watchTheme(cb: () => void): () => void {
	const mo = new MutationObserver(cb);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-style', 'data-accent', 'data-modo', 'class'] });
	return () => mo.disconnect();
}
