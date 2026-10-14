// Paneles plegados (M20): tocar el título de un panel lo pliega y se recuerda en este navegador, por vista
// y panel («/eco|Inflación»). Como un store de Pinia con persistencia en localStorage.

const KEY = 'arc-folded';

export const folded = $state({ keys: [] as string[], ready: false });

/** Se llama al arrancar en el navegador (desde el layout). */
export function initFolded() {
	if (folded.ready) return;
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		if (Array.isArray(saved)) folded.keys = saved.filter((k): k is string => typeof k === 'string');
	} catch {}
	folded.ready = true;
}

export const foldKey = (route: string | null, title: string) => `${route ?? ''}|${title}`;

export const isFolded = (key: string) => folded.keys.includes(key);

export function toggleFold(key: string) {
	folded.keys = isFolded(key) ? folded.keys.filter((k) => k !== key) : [...folded.keys, key];
	try {
		localStorage.setItem(KEY, JSON.stringify(folded.keys));
	} catch {}
}
