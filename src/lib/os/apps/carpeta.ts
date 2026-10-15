// App «Carpeta» de Arc OS: una carpeta del escritorio (o la papelera) en una ventana, como un explorador sencillo
// (src/lib/os/fs/Folder.svelte). Cada ventana enseña una carpeta (su path, «/<id>»); se pueden abrir varias.
import type { ToolApp } from '../apps.ts';
import { folderTitle } from '../fs/desk.ts';

const app: ToolApp = {
	id: 'carpeta',
	name: 'Carpeta',
	icon: '▤',
	desc: 'Tus carpetas del escritorio y la papelera',
	load: () => import('../fs/Folder.svelte'),
	size: { w: 640, h: 440 },
	single: false,
	order: 90,
	title: folderTitle
};

export default app;
