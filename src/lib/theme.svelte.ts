// Tema claro / oscuro. Tres modos: «auto» (sigue al sistema), «light» (día) y «dark» (noche).
// El modo se guarda en este navegador. El script en línea de src/app.html lo aplica antes de pintar
// la página, para que no parpadee; aquí se mantiene sincronizado mientras la web está abierta.

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'arc-theme';
const COLORS = { dark: '#080a0d', light: '#f5f4f0' };

export const theme = $state({
	mode: 'auto' as ThemeMode,
	/** El tema que se ve de verdad (en «auto», el del sistema). */
	resolved: 'dark' as 'light' | 'dark'
});

function systemLight() {
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
}

function apply() {
	theme.resolved = theme.mode === 'auto' ? (systemLight() ? 'light' : 'dark') : theme.mode;
	const root = document.documentElement;
	if (theme.mode === 'auto') delete root.dataset.theme;
	else root.dataset.theme = theme.mode;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme.resolved]);
}

/** Se llama al arrancar en el navegador (desde el layout). Devuelve la limpieza del listener. */
export function initTheme() {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === 'light' || saved === 'dark' || saved === 'auto') theme.mode = saved;
	} catch {}
	apply();
	const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
	const onChange = () => theme.mode === 'auto' && apply();
	media?.addEventListener('change', onChange);
	return () => media?.removeEventListener('change', onChange);
}

/** Auto → Día → Noche → Auto. */
export function cycleTheme() {
	theme.mode = theme.mode === 'auto' ? 'light' : theme.mode === 'light' ? 'dark' : 'auto';
	try {
		localStorage.setItem(KEY, theme.mode);
	} catch {}
	apply();
}
