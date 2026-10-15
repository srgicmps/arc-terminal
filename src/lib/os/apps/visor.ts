// App «Visor» de Arc OS: imágenes y PDF de tu dispositivo, sin subirlos ni guardarlos (src/lib/os/apps/viewer/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'visor',
	name: 'Visor',
	icon: '▨',
	desc: 'Imágenes y PDF de tu dispositivo: zoom, giro y varias a la vez. No se suben ni se guardan',
	load: () => import('./viewer/Viewer.svelte'),
	size: { w: 820, h: 600 },
	single: false,
	order: 40
};

export default app;
