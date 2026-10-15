// App «Monitor del sistema» de Arc OS: ventanas, fuentes de datos como procesos y rendimiento (src/lib/os/apps/monitor/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'monitor',
	name: 'Monitor del sistema',
	icon: '▥',
	desc: 'Apps abiertas, fuentes de datos como procesos (estado, última descarga) y rendimiento',
	load: () => import('./monitor/Monitor.svelte'),
	size: { w: 760, h: 560 },
	order: 30
};

export default app;
