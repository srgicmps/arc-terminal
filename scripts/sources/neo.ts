// Asteroides que pasan cerca de la Tierra en los próximos 30 días, según el Center for Near Earth Object
// Studies (CNEOS) de la NASA: API Close Approach Data (cad.api), sin clave. Datos públicos de la NASA/JPL.
// https://ssd-api.jpl.nasa.gov/doc/cad.html · Se pide una vez cada 6 horas.
import type { NeoPass } from '../../src/lib/types.ts';
import { getJson, list, num, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export const CAD_URL =
	'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=10LD&date-min=now&date-max=%2B30&sort=dist&diameter=true&fullname=true';

/** Una distancia lunar en unidades astronómicas (384 400 km). */
const LD_AU = 0.00256955529;
const MAX = 15;

const MONTHS: Record<string, string> = {
	Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

/** «2026-Oct-15 00:01» (TDB, casi UTC) → ISO; null si no se entiende. */
export function cadDate(value: unknown): string | null {
	const m = String(value ?? '').match(/^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})$/);
	if (!m || !MONTHS[m[2]]) return null;
	return `${m[1]}-${MONTHS[m[2]]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
}

/** Diámetro en metros a partir de la magnitud absoluta H y un albedo (fórmula estándar: D = 1329 km / √p · 10^(−H/5)). */
const fromH = (h: number, albedo: number) => (1329 / Math.sqrt(albedo)) * 10 ** (-h / 5) * 1000;

export function parseCad(body: Raw): NeoPass[] {
	const fields = list<string>(body?.fields);
	const at = (row: unknown[], name: string) => row[fields.indexOf(name)];
	return list<unknown[]>(body?.data)
		.map((row): NeoPass | null => {
			const date = cadDate(at(row, 'cd'));
			const dist = num(at(row, 'dist'));
			if (!date || dist === null) return null;
			const diameter = num(at(row, 'diameter'));
			const h = num(at(row, 'h'));
			const size =
				diameter !== null
					? { min: Math.round(diameter * 1000), max: Math.round(diameter * 1000), measured: true }
					: h !== null
						? { min: Math.round(fromH(h, 0.25)), max: Math.round(fromH(h, 0.05)), measured: false }
						: null;
			return {
				des: String(at(row, 'des') ?? '').trim(),
				date,
				ld: Math.round((dist / LD_AU) * 100) / 100,
				speed: num(at(row, 'v_rel')),
				size
			};
		})
		.filter((p): p is NeoPass => p !== null && !!p.des)
		.sort((a, b) => a.ld - b.ld)
		.slice(0, MAX);
}

export const neo: Source<NeoPass[]> = {
	name: 'neo',
	label: 'Asteroides que pasan cerca en 30 días · NASA JPL CNEOS',
	maxAgeMinutes: 6 * 60,
	// Hay semanas sin ninguno a menos de 10 distancias lunares.
	allowEmpty: true,
	async fetch() {
		return parseCad(await getJson<Raw>(CAD_URL));
	}
};
