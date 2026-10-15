// App «Ajustes» de Arc OS, al estilo de un panel de control: categorías con iconos, buscador y lista lateral
// (src/lib/os/apps/settings/). openApp('ajustes', '<sección>') abre una sección directa: ids en SECTION_IDS.
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'ajustes',
	name: 'Ajustes',
	icon: '⚙',
	desc: 'Panel de control: cuenta, apariencia, sistema, escritorio, datos, avisos y atajos, con buscador',
	load: () => import('./settings/Settings.svelte'),
	size: { w: 860, h: 600 },
	order: 10
};

export default app;
export { SECTION_IDS, type SectionId } from './settings/sections.ts';
