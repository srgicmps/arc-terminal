// App «Terminal» de Arc OS: la barra de comandos como consola (src/lib/os/terminal/). Lo que abre, en una ventana.
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'terminal',
	name: 'Terminal',
	icon: '›_',
	desc: 'La barra de comandos como consola: historial, Tab, cálculos y respuestas rápidas',
	load: () => import('../terminal/TerminalApp.svelte'),
	size: { w: 720, h: 440 },
	single: false,
	order: 5
};

export default app;
