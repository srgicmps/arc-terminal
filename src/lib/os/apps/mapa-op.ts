// Herramienta de Arc OS: «Mapa operacional». Todas las capas de GEO (y las de la Sala de control) en un mapa a
// pantalla completa de la ventana, con filtros por capa, periodo y una línea de tiempo para rebobinar los sucesos.
// Parámetros opcionales en la ruta de la ventana: openApp('mapa-op', '?capas=quakes,storms&periodo=24h').
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'mapa-op',
	name: 'Mapa operacional',
	icon: '⌖',
	desc: 'Todas las capas de GEO en un mapa, con filtros y una línea de tiempo para rebobinar los sucesos',
	load: () => import('./mapa-op/MapaOp.svelte'),
	size: { w: 1180, h: 740 },
	order: 40
};

export default app;
