// App «Calculadora» de Arc OS: normal, financiera y divisas (src/lib/os/apps/calc/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'calculadora',
	name: 'Calculadora',
	icon: '±',
	desc: 'Normal, financiera (interés compuesto, préstamos) y divisas con los cambios del BCE',
	load: () => import('./calc/Calculator.svelte'),
	size: { w: 420, h: 600 },
	order: 20
};

export default app;
