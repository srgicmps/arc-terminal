// Datos de los widgets del escritorio de Arc OS: /data/muro.json (titulares y cotizaciones), /data/os.json
// (luz por horas) y el tiempo de «Tu sitio» (Open-Meteo, con la caché de localweather.ts). Se piden al montar
// el escritorio y cada 5 min (REFRESH_MS). Si una falla, se apunta por qué y cuándo se vuelve a intentar, para
// que el widget lo diga en vez de quedarse vacío.
import { asset } from '$app/paths';
import type { SourceStatus } from '../../data.ts';
import type { WallData } from '../../exp/muro.ts';
import { fetchLocal, type LocalWeather } from '../../localweather.ts';
import type { Place } from '../../place.ts';
import type { HourPrice } from '../../power.ts';

export const REFRESH_MS = 300_000;

/** De dónde sale cada cosa (para decir qué ha fallado). */
export type WidgetSource = 'muro' | 'os' | 'tiempo' | 'status';

export const wdata = $state({
	/** Ya ha terminado la primera lectura (antes, los widgets dicen «Cargando…»). */
	loaded: false,
	/** Lo que ha fallado en la última lectura y por qué («responde 404», «sin conexión»…). */
	failed: {} as Partial<Record<WidgetSource, string>>,
	/** Cuándo se vuelve a intentar (ms). */
	retry: 0,
	wall: null as WallData | null,
	power: [] as HourPrice[],
	weather: null as LocalWeather | null,
	/** Estado de las fuentes (/data/status.json), para los widgets del sistema. */
	status: [] as SourceStatus[]
});

type Got<T> = { data: T | null; error?: string };

async function getJson<T>(name: string): Promise<Got<T>> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		if (!r.ok) return { data: null, error: `responde ${r.status}` };
		const data = ((await r.json()) as { data?: T }).data ?? null;
		return data === null ? { data, error: 'aún sin datos' } : { data };
	} catch {
		return { data: null, error: 'sin conexión' };
	}
}

export async function refreshWidgets(place: Place) {
	const [wall, os, weather, status] = await Promise.all([
		getJson<WallData>('muro'),
		getJson<{ power: HourPrice[] }>('os'),
		fetchLocal(place).then(
			(data): Got<LocalWeather> => (data ? { data } : { data: null, error: 'Open-Meteo no responde' }),
			(): Got<LocalWeather> => ({ data: null, error: 'Open-Meteo no responde' })
		),
		getJson<SourceStatus[]>('status')
	]);
	wdata.status = status.data ?? [];
	wdata.wall = wall.data;
	wdata.power = os.data?.power ?? [];
	wdata.weather = weather.data;
	const failed: Partial<Record<WidgetSource, string>> = {};
	if (wall.error) failed.muro = wall.error;
	if (os.error) failed.os = os.error;
	if (weather.error) failed.tiempo = weather.error;
	if (status.error) failed.status = status.error;
	wdata.failed = failed;
	wdata.retry = Date.now() + REFRESH_MS;
	wdata.loaded = true;
}
