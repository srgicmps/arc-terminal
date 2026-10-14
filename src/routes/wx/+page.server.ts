import { dataset } from '#lib/data.ts';
import { trim } from '#lib/trim.ts';
import type { SwpcData, WeatherData } from '#lib/types.ts';
import type { AirData, AlertsData } from '#lib/weather.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [weather, air, alerts, swpc] = await Promise.all([
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts'),
		dataset<SwpcData>('swpc')
	]);
	// Tormentas solares: el aviso no pinta el Kp de 24 h.
	return { weather, air, alerts, swpc: trim(swpc, (d) => ({ ...d, kp24: [] })) };
};
