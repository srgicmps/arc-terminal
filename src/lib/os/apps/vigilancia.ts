// App «Vigilancia» de Arc OS: tus objetivos (países, valores, líderes y temas) con su nivel, sus titulares y lo
// nuevo desde tu última visita (src/lib/os/apps/vigilancia/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'vigilancia',
	name: 'Vigilancia',
	icon: '◎',
	desc: 'Tus objetivos (países, valores, líderes y temas): nivel, titulares y cambios desde tu última visita',
	load: () => import('./vigilancia/Vigilancia.svelte'),
	size: { w: 980, h: 680 },
	order: 35
};

export default app;
