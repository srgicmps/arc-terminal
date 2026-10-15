// Inicio de la app Sencilla: un poco de cada pestaña (lib/sencillo/load.ts), ya recortado al construir.
import { home, money, world } from '#lib/sencillo/load.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [m, h, w] = await Promise.all([money(), home(), world(2)]);
	return { money: m, home: { ...h, air: null }, important: w.important.slice(0, 3) };
};
