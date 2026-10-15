// App «Notas» de Arc OS: notas con formato básico, guardadas en tu cuenta (src/lib/os/apps/notes/).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'notas',
	name: 'Notas',
	icon: '✎',
	desc: 'Tus notas con formato básico: títulos, listas, enlaces. Se guardan en tu cuenta',
	load: () => import('./notes/Notes.svelte'),
	size: { w: 820, h: 560 },
	order: 15
};

export default app;
