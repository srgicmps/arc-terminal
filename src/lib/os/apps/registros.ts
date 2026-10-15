// App «Centro de registros» de Arc OS: actualizaciones de las fuentes, avisos al móvil, notificaciones y lo que ha
// pasado en esta sesión, en una sola tabla con filtros y CSV (src/lib/os/apps/logs/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'registros',
	name: 'Centro de registros',
	icon: '☰',
	desc: 'Registro de descargas de las fuentes, avisos enviados, notificaciones y la sesión, con filtros y CSV',
	load: () => import('./logs/Logs.svelte'),
	size: { w: 860, h: 600 },
	order: 32
};

export default app;
