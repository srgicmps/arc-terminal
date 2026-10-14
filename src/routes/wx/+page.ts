import { dataset } from '#lib/data.ts';
import type { ClimateData } from '#lib/climate.ts';
import type { WeatherData } from '#lib/types.ts';
import type { AirData, AlertsData } from '#lib/weather.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [weather, air, alerts, climate] = await Promise.all([
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts'),
		dataset<ClimateData>('climate')
	]);
	return { weather, air, alerts, climate };
};
