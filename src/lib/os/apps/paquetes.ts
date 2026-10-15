// App «Centro de paquetes» de Arc OS: instalar y quitar apps y widgets del escritorio (src/lib/os/apps/packages/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'paquetes',
	name: 'Centro de paquetes',
	icon: '⬢',
	desc: 'Instala y quita apps (vistas, experiencias, herramientas) y widgets del escritorio',
	load: () => import('./packages/Packages.svelte'),
	size: { w: 900, h: 600 },
	order: 35
};

export default app;
