// BIS (Banco de Pagos Internacionales): tipos de interés oficiales de los principales bancos centrales,
// dataset WS_CBPOL. API SDMX, sin clave. https://stats.bis.org/api-doc/v1/
// Uso libre citando la fuente: «BIS, Central bank policy rates».
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { parseCsv } from '../csv.ts';
import { getText, num, type Source } from '../lib.ts';

// Código del BIS → país y banco central. XM es la zona euro.
const BANKS: Record<string, string> = {
	US: 'EE. UU. · Fed',
	XM: 'Zona euro · BCE',
	GB: 'Reino Unido · BoE',
	JP: 'Japón · BoJ',
	CH: 'Suiza · BNS',
	CA: 'Canadá · BoC',
	AU: 'Australia · RBA',
	CN: 'China · PBoC',
	MX: 'México · Banxico',
	BR: 'Brasil · BCB',
	IN: 'India · RBI',
	TR: 'Turquía · TCMB'
};

export const bis: Source<SeriesData> = {
	name: 'bis',
	label: 'Tipos oficiales de los bancos centrales · BIS',
	// Los tipos cambian pocas veces al año y el BIS actualiza a diario: cada 12 horas sobra.
	maxAgeMinutes: 715,
	async fetch() {
		// Tres años de datos diarios, para encontrar el último cambio aunque haga tiempo.
		const start = `${new Date().getUTCFullYear() - 3}-01-01`;
		const url =
			`https://stats.bis.org/api/v1/data/WS_CBPOL/D.${Object.keys(BANKS).join('+')}/all` +
			`?startPeriod=${start}&detail=dataonly&format=csv`;
		const rows = parseCsv(await getText(url, { headers: { Accept: 'text/csv' } }));

		const byArea = new Map<string, { t: string; v: number }[]>();
		for (const r of rows) {
			const v = num(r.OBS_VALUE);
			if (!r.REF_AREA || !r.TIME_PERIOD || v === null) continue;
			byArea.set(r.REF_AREA, [...(byArea.get(r.REF_AREA) ?? []), { t: r.TIME_PERIOD, v }]);
		}

		const series: Series[] = Object.entries(BANKS).flatMap(([area, bank]) => {
			const daily = (byArea.get(area) ?? []).sort((a, b) => a.t.localeCompare(b.t));
			if (!daily.length) return [];
			// Solo los días en que cambia el tipo, con el mes como periodo: así la tabla enseña el último
			// cambio y cuándo fue, y el archivo pesa poco.
			const changes: Point[] = [];
			for (const p of daily) {
				if (changes.at(-1)?.v !== p.v) changes.push({ t: p.t.slice(0, 7), v: p.v });
			}
			// Sin cambios en todo el periodo: el único punto es el inicio de la descarga, no un cambio.
			// Se fecha con el último dato, como el resto de tablas.
			if (changes.length === 1) changes[0].t = daily[daily.length - 1].t.slice(0, 7);
			return [
				{
					id: `policy-${area.toLowerCase()}`,
					label: bank,
					unit: '%',
					geo: area === 'XM' ? 'EA' : area,
					points: changes,
					source: 'BIS',
					url: 'https://data.bis.org/topics/CBPOL'
				}
			];
		});
		if (!series.length) throw new Error('el BIS no devuelve tipos');
		return { series };
	}
};

// ---------- Precio de la vivienda (dataset WS_SPP, «selected residential property prices») ----------
// Clave: frecuencia . zona . N (nominal) o R (real, descontada la inflación) . 771 (variación interanual, %).
// Uso libre citando la fuente: «BIS, Residential property prices».

// Zonas en el orden de la tabla. XM es la zona euro.
export const HOUSING_AREAS: Record<string, string> = {
	US: 'EE. UU.',
	XM: 'Zona euro',
	ES: 'España',
	DE: 'Alemania',
	GB: 'Reino Unido',
	FR: 'Francia',
	IT: 'Italia',
	NL: 'Países Bajos',
	CN: 'China',
	JP: 'Japón',
	CA: 'Canadá',
	AU: 'Australia',
	KR: 'Corea del Sur'
};

export const HOUSING_URL = (start: string) =>
	`https://stats.bis.org/api/v1/data/WS_SPP/Q.${Object.keys(HOUSING_AREAS).join('+')}.N+R.771/all` +
	`?startPeriod=${start}&detail=dataonly&format=csv`;

/** Filas del CSV → una serie por zona y tipo («house-n-es», «house-r-es»), trimestres de más antiguo a más reciente. */
export function parseHousing(rows: Record<string, string>[]): Series[] {
	const byKey = new Map<string, Point[]>();
	for (const r of rows) {
		const v = num(r.OBS_VALUE);
		if (
			!r.REF_AREA ||
			!(r.VALUE === 'N' || r.VALUE === 'R') ||
			!/^\d{4}-Q[1-4]$/.test(r.TIME_PERIOD ?? '') ||
			v === null
		)
			continue;
		const key = `${r.VALUE}-${r.REF_AREA}`;
		byKey.set(key, [...(byKey.get(key) ?? []), { t: r.TIME_PERIOD, v }]);
	}
	return Object.entries(HOUSING_AREAS).flatMap(([area, name]) =>
		(['N', 'R'] as const).flatMap((kind) => {
			const points = (byKey.get(`${kind}-${area}`) ?? []).sort((a, b) => a.t.localeCompare(b.t));
			if (!points.length) return [];
			return [
				{
					id: `house-${kind.toLowerCase()}-${area.toLowerCase()}`,
					label: `${name} · ${kind === 'N' ? 'nominal' : 'real'}`,
					unit: '%',
					geo: area === 'XM' ? 'EA' : area,
					points,
					source: 'BIS',
					url: 'https://data.bis.org/topics/RPP'
				}
			];
		})
	);
}

export const housing: Source<SeriesData> = {
	name: 'housing',
	label: 'Precio de la vivienda en el mundo · BIS',
	// Datos trimestrales: una vez al día sobra.
	maxAgeMinutes: 1435,
	async fetch() {
		// Cinco años y medio de trimestres, para el minigráfico de 5 años aunque el último dato vaya con retraso.
		const start = `${new Date().getUTCFullYear() - 6}-Q1`;
		const series = parseHousing(parseCsv(await getText(HOUSING_URL(start), { headers: { Accept: 'text/csv' } })));
		if (!series.length) throw new Error('el BIS no devuelve precios de la vivienda');
		return { series };
	}
};
