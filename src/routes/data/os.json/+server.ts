// Arc OS: lo justo para los widgets del escritorio que no salen ya en /data/muro.json: los precios de la luz
// por hora (PVPC) de hoy y mañana. Se genera al construir; los widgets lo piden al abrir el escritorio.
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import { days, hourly } from '#lib/power.ts';
import type { PowerData } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const power = await dataset<PowerData>('power');
	const hours = hourly(power?.data.pvpc ?? []);
	const keep = new Set(days(hours).slice(-2));
	return json({ name: 'os', fetchedAt: power?.fetchedAt ?? new Date().toISOString(), data: { power: hours.filter((h) => keep.has(h.day)) } });
}
