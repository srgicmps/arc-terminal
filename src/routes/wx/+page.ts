import { dataset } from '#lib/data.ts';
import type { ShipsData, WeatherData } from '#lib/types.ts';
import type { AirData, AlertsData } from '#lib/weather.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [weather, air, alerts, ships] = await Promise.all([
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts'),
		dataset<ShipsData>('ais')
	]);
	return { weather, air, alerts, ships };
};
