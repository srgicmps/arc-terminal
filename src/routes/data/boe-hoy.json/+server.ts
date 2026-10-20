// TOP: el último sumario del BOE recortado a lo que hace falta para contar las palabras vigiladas (la fecha y
// el texto de cada disposición, sin enlaces). Se genera al construir la web, con el mismo boe.json que el
// panel «BOE de hoy», y lo pide el navegador solo si hay alguna palabra. Antes TOP bajaba boe-week.json entero
// (siete sumarios) para usar solo el primero.
import { json } from '@sveltejs/kit';
import { boeToday } from '#lib/boe.ts';
import { dataset } from '#lib/data.ts';
import type { BoeData } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const boe = await dataset<BoeData>('boe');
	return json({ name: 'boe-hoy', fetchedAt: boe?.fetchedAt ?? new Date().toISOString(), data: boe ? boeToday(boe.data) : null });
}
