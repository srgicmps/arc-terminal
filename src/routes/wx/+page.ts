import { dataset } from '#lib/data.ts';
import type { WeatherData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ weather: await dataset<WeatherData>('weather') });
