// App «Fondo de pantalla» de Arc OS (src/lib/os/system/wall/): galería, color, degradado, tus imágenes,
// fondo por escritorio, presentación y pantalla de bloqueo. Id «wallpaper» («fondos» ya es el comando FONDOS).
import type { ToolApp } from '../apps.ts';

const app: ToolApp = {
	id: 'wallpaper',
	name: 'Fondo de pantalla',
	icon: '▨',
	desc: 'Fondos incluidos y vivos, color, degradado, tus imágenes, uno por escritorio y presentación',
	load: () => import('../system/wall/WallpaperApp.svelte'),
	size: { w: 720, h: 680 },
	order: 60
};

export default app;
