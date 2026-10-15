// Datos de los widgets del escritorio de Arc OS: /data/muro.json (titulares y cotizaciones), /data/os.json
// (luz por horas) y el tiempo de «Tu sitio» (Open-Meteo, con la caché de localweather.ts). Se piden al montar
// el escritorio y cada 5 min.
import { asset } from '$app/paths';
import type { SourceStatus } from '../../data.ts';
import type { WallData } from '../../exp/muro.ts';
import { fetchLocal, type LocalWeather } from '../../localweather.ts';
import type { Place } from '../../place.ts';
import type { HourPrice } from '../../power.ts';

export const wdata = $state({
	wall: null as WallData | null,
	power: [] as HourPrice[],
	weather: null as LocalWeather | null,
	/** Estado de las fuentes (/data/status.json), para los widgets del sistema. */
	status: [] as SourceStatus[]
});

async function getJson<T>(name: string): Promise<T | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		return r.ok ? (((await r.json()) as { data: T }).data ?? null) : null;
	} catch {
		return null;
	}
}

export async function refreshWidgets(place: Place) {
	const [wall, os, weather, status] = await Promise.all([
		getJson<WallData>('muro'),
		getJson<{ power: HourPrice[] }>('os'),
		fetchLocal(place).catch(() => null),
		getJson<SourceStatus[]>('status')
	]);
	wdata.status = status ?? [];
	wdata.wall = wall;
	wdata.power = os?.power ?? [];
	wdata.weather = weather;
}
