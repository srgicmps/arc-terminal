import { dataset } from '#lib/data.ts';
import type { WeatherData } from '#lib/types.ts';
import type { AirData, AlertsData } from '#lib/weather.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [weather, air, alerts] = await Promise.all([
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts')
	]);
	return { weather, air, alerts };
};
