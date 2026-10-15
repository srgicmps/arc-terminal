// App «Ajustes» de Arc OS: apariencia, escritorio, avisos, cuenta, idioma y región, atajos (src/lib/os/apps/settings/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'ajustes',
	name: 'Ajustes',
	icon: '⚙',
	desc: 'Apariencia, escritorio, avisos, cuenta, idioma y región y atajos de teclado, en un sitio',
	load: () => import('./settings/Settings.svelte'),
	size: { w: 860, h: 600 },
	order: 10
};

export default app;
