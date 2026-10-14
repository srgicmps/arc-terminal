// Paro y PIB de EE. UU., Reino Unido, Japón y China para las tablas de ECO, con los mismos id que Eurostat
// («unemployment-gb», «gdp-us»…). Datos de la OCDE, vía DBnomics: la API de la OCDE da 500 a los runners de
// GitHub (ver oecd.ts). Sin clave; reutilización libre citando a la OCDE. Una descarga al día.
// DBnomics actualiza su copia cada pocos meses: estos datos van por detrás de los de Eurostat y la tabla enseña
// el periodo de cada fila. El paro y el IPC de EE. UU. salen de la fuente bls, que va al día; el IPC de los
// demás, de la inflación del G20 (oecd.ts). China no tiene serie de paro en la OCDE.
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, num, type Source } from '../lib.ts';

const API = 'https://api.db.nomics.world/v22/series/OECD';

interface Wanted {
	/** Prefijo del id (como en eurostat.ts) y etiqueta. */
	id: string;
	label: string;
	dataset: string;
	/** Código de la serie con «{}» donde va el país. */
	code: string;
	/** País en la OCDE → geo en la web. */
	areas: Record<string, string>;
	/** Cuántos periodos se guardan (como en eurostat.ts). */
	keep: number;
	url: string;
}

export const WANTED: Wanted[] = [
	{
		id: 'unemployment',
		label: 'Paro',
		dataset: 'DSD_LFS@DF_IALFS_UNE_M',
		code: '{}.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M',
		areas: { GBR: 'GB', JPN: 'JP' },
		keep: 25,
		url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_LFS%40DF_IALFS_UNE_M&df[ag]=OECD.SDD.TPS'
	},
	{
		id: 'gdp',
		label: 'PIB, trimestral',
		dataset: 'DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_G20',
		code: 'Q.Y.{}.S1.S1.B1GQ._Z._Z._Z.PC.L.G1.T0102',
		areas: { USA: 'US', GBR: 'GB', JPN: 'JP', CHN: 'CN' },
		keep: 12,
		url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_NAMAIN1%40DF_QNA_EXPENDITURE_GROWTH_G20&df[ag]=OECD.SDD.NAD'
	}
];

interface DbnomicsDoc {
	series_code?: string;
	period?: string[];
	value?: (number | string | null)[];
}

/** Las series de una respuesta de DBnomics (un doc por país), con los id de la web. */
export function parseG4(w: Wanted, body: { series?: { docs?: DbnomicsDoc[] } }): Series[] {
	return Object.entries(w.areas).flatMap(([area, geo]) => {
		const doc = body.series?.docs?.find((d) => d.series_code === w.code.replace('{}', area));
		const points: Point[] = (doc?.period ?? []).flatMap((t, i) => {
			const v = num(doc?.value?.[i]);
			// Meses («2026-04») o trimestres («2026-Q1»), como en Eurostat.
			return /^\d{4}-(\d{2}|Q[1-4])$/.test(t) && v !== null ? [{ t, v }] : [];
		});
		if (!points.length) return [];
		return [{ id: `${w.id}-${geo.toLowerCase()}`, label: w.label, unit: '%', geo, points: points.slice(-w.keep), source: 'OCDE vía DBnomics', url: w.url }];
	});
}

export const oecdG4: Source<SeriesData> = {
	name: 'oecd-g4',
	label: 'Paro y PIB de EE. UU., Reino Unido, Japón y China · OCDE vía DBnomics',
	maxAgeMinutes: 1435,
	async fetch() {
		// Una petición por dataset; si falla una, se quedan las series de la otra.
		const results = await Promise.allSettled(
			WANTED.map(async (w) => {
				const codes = w.code.replace('{}', Object.keys(w.areas).join('+'));
				return parseG4(w, await getJson(`${API}/${w.dataset}/${codes}?observations=1&metadata=false`));
			})
		);
		const series = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
		if (!series.length) {
			const reason = results.find((r) => r.status === 'rejected')?.reason;
			throw new Error(`DBnomics no trae ninguna serie${reason ? `: ${(reason as Error).message}` : ''}`);
		}
		return { series };
	}
};
