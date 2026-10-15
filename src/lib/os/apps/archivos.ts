// App «Archivos» de Arc OS: explorador de vistas, notas, valores, escritorios y favoritos (src/lib/os/apps/files/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'archivos',
	name: 'Archivos',
	icon: '🗀',
	desc: 'Explorador: apps, notas, valores de MIS, escritorios y favoritos; tus carpetas, accesos directos y papelera',
	load: () => import('./files/Files.svelte'),
	size: { w: 900, h: 580 },
	single: false,
	order: 12
};

export default app;
