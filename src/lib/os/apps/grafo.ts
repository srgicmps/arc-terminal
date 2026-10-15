// App «Grafo» de Arc OS (Centro de mando): países, líderes, bancos centrales, valores, sanciones, sucesos y
// temas de IMP enlazados por los titulares (src/lib/os/apps/grafo/ y la lógica en intel/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'grafo',
	name: 'Grafo de entidades',
	icon: '⌬',
	desc: 'Quién sale con quién en los titulares: países, líderes, bancos, valores, sanciones y sucesos enlazados',
	load: () => import('./grafo/Grafo.svelte'),
	size: { w: 1040, h: 700 },
	order: 200
};

export default app;
