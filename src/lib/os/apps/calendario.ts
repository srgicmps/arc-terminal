// App «Calendario» de Arc OS: festivos, datos, resultados, tus alarmas y tus eventos (src/lib/os/apps/cal/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'calendario',
	name: 'Calendario',
	icon: '⊞',
	desc: 'El mes con festivos, publicaciones de datos, resultados de tus valores, tus alarmas y tus eventos',
	load: () => import('./cal/Calendar.svelte'),
	size: { w: 860, h: 560 },
	order: 35
};

export default app;
