// App «Expediente» de Arc OS (Centro de mando): la ficha de cualquier entidad con todo lo que Arc sabe de ella
// (src/lib/os/apps/expediente/). Se abre desde otra app con openDossier(kind, key) de intel/open.ts.
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'expediente',
	name: 'Expediente',
	icon: '▤',
	desc: 'Ficha de una entidad: resumen, datos clave, cronología, mapa y relaciones; se exporta a Markdown o JSON',
	load: () => import('./expediente/Expediente.svelte'),
	size: { w: 780, h: 680 },
	order: 210
};

export default app;
