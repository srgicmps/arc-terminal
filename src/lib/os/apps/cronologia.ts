// Arc OS: la herramienta «Línea de tiempo». Carriles apilados con un eje de tiempo común: sucesos de IMP,
// terremotos y desastres, avisos, datos macro, resultados, bancos centrales y mini-series de mercados.
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'cronologia',
	name: 'Línea de tiempo',
	icon: '⟿',
	desc: 'Sucesos y mercados en un mismo eje de tiempo: zoom, cursor común y detalle de cada suceso',
	load: () => import('./cronologia/Timeline.svelte'),
	size: { w: 1080, h: 640 },
	order: 2030
};

export default app;
