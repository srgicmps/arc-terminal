import { dataset } from '#lib/data.ts';
import type { SwpcData, WeatherData } from '#lib/types.ts';
import type { AirData, AlertsData } from '#lib/weather.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [weather, air, alerts, swpc] = await Promise.all([
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts'),
		dataset<SwpcData>('swpc')
	]);
	return { weather, air, alerts, swpc };
};
