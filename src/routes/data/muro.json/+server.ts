// Muro: lo justo para la pantalla de la tele (titulares de IMP, avisos gordos y la cinta de cotizaciones).
// Se genera al construir, y la web se publica cada 5-15 min: la vista lo vuelve a pedir cada 2 min.
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import { buildWall } from '#lib/exp/muro.ts';
import type { ImpData, Quake, Quote } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const [imp, quakes, quotes] = await Promise.all([dataset<ImpData>('imp'), dataset<Quake[]>('quakes'), dataset<Quote[]>('alert-quotes')]);
	const data = buildWall(imp?.data.current ?? [], quakes?.data ?? [], quotes?.data ?? [], Date.now());
	return json({ name: 'muro', fetchedAt: new Date().toISOString(), data });
}
