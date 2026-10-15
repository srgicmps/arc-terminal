// App «Reloj» de Arc OS: hora en el mundo, alarmas, cronómetro y temporizador (src/lib/os/apps/clock/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'reloj',
	name: 'Reloj',
	icon: '◷',
	desc: 'Hora en el mundo, alarmas (en tu cuenta), cronómetro y temporizador',
	load: () => import('./clock/Clock.svelte'),
	size: { w: 480, h: 560 },
	order: 25
};

export default app;
