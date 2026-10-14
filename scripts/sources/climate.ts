// Clima del planeta, sin clave:
// - Copernicus Climate Pulse (ERA5): temperatura media mundial del aire a 2 m, diaria desde 1940, con su
//   anomalía frente a 1991–2020. Sale con unos 2 días de retraso. Licencia libre citando a Copernicus.
//   https://pulse.climate.copernicus.eu
// - NOAA GML: CO₂ diario medido en Mauna Loa (Hawái). Dominio público. https://gml.noaa.gov/ccgg/trends/
// Si una de las dos falla, el panel sale con la otra; si fallan las dos, es un error.
import { parseCo2, parseEra5, summarizeCo2, summarizeTemp, type ClimateData } from '../../src/lib/climate.ts';
import { getText, type Source } from '../lib.ts';

const ERA5 = 'https://sites.ecmwf.int/data/climatepulse/data/series/era5_daily_series_2t_global.csv';
const CO2 = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv';

export const climate: Source<ClimateData> = {
	name: 'climate',
	label: 'Temperatura mundial y CO₂ · Copernicus (ERA5) y NOAA (Mauna Loa)',
	// Las dos series son diarias: una vez al día sobra.
	maxAgeMinutes: 1440,
	async fetch() {
		const [temp, co2] = await Promise.allSettled([
			getText(ERA5).then((csv) => summarizeTemp(parseEra5(csv))),
			getText(CO2).then((csv) => summarizeCo2(parseCo2(csv)))
		]);
		const data: ClimateData = {
			temp: temp.status === 'fulfilled' ? temp.value : null,
			co2: co2.status === 'fulfilled' ? co2.value : null
		};
		if (temp.status === 'rejected') console.log(`  climate · ERA5: ${temp.reason}`);
		if (co2.status === 'rejected') console.log(`  climate · CO₂: ${co2.reason}`);
		if (!data.temp && !data.co2) throw new Error('ni ERA5 ni Mauna Loa devuelven datos');
		return data;
	}
};
