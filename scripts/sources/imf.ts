// FMI: previsiones de crecimiento e inflación del World Economic Outlook (WEO), vía la API DataMapper,
// sin clave. https://www.imf.org/external/datamapper/api/help
// Respuesta: {"values":{"NGDP_RPCH":{"USA":{"2026":1.8,"2027":2.1}}},"api":{…}}. Si falta un país o un
// año, sencillamente no aparece: se guarda como null.
import type { ImfData, ImfRow } from '../../src/lib/types.ts';
import { getJson, madridDay, num, type Source } from '../lib.ts';

const API = 'https://www.imf.org/external/datamapper/api/v1';

// Código del FMI → nombre. EURO es el grupo «Euro area» y WEOWORLD la región «World».
const AREAS: Record<string, string> = {
	WEOWORLD: 'Mundo',
	USA: 'EE. UU.',
	EURO: 'Zona euro',
	DEU: 'Alemania',
	ESP: 'España',
	GBR: 'Reino Unido',
	JPN: 'Japón',
	CHN: 'China',
	IND: 'India',
	BRA: 'Brasil'
};

const MONTHS: Record<string, string> = {
	january: 'enero',
	february: 'febrero',
	march: 'marzo',
	april: 'abril',
	may: 'mayo',
	june: 'junio',
	july: 'julio',
	august: 'agosto',
	september: 'septiembre',
	october: 'octubre',
	november: 'noviembre',
	december: 'diciembre'
};

/** «World Economic Outlook (October 2026)» → «octubre de 2026»; si no encaja, null. */
export function edition(source: unknown): string | null {
	const m = /World Economic Outlook \((\w+) (\d{4})\)/i.exec(String(source ?? ''));
	const month = m && MONTHS[m[1].toLowerCase()];
	return month ? `${month} de ${m[2]}` : null;
}

/** Valores de un indicador para los años pedidos: { USA: [1.8, 2.1], … }. */
async function indicator(id: string, years: [number, number]): Promise<Record<string, [number | null, number | null]>> {
	const url = `${API}/${id}/${Object.keys(AREAS).join('/')}?periods=${years.join(',')}`;
	const body = await getJson(url);
	const byArea = body?.values?.[id] ?? {};
	const out: Record<string, [number | null, number | null]> = {};
	for (const code of Object.keys(AREAS)) {
		const v = byArea[code];
		if (v && typeof v === 'object') out[code] = [num(v[years[0]]), num(v[years[1]])];
	}
	return out;
}

export const imf: Source<ImfData> = {
	name: 'imf',
	label: 'Previsiones de crecimiento e inflación · FMI (WEO)',
	// El WEO sale dos veces al año (abril y octubre) con una actualización en enero y julio: una vez al día sobra.
	maxAgeMinutes: 1440,
	async fetch() {
		const year = Number(madridDay().slice(0, 4));
		const years: [number, number] = [year, year + 1];
		const [gdp, cpi, meta] = await Promise.all([
			indicator('NGDP_RPCH', years),
			indicator('PCPIPCH', years),
			// La edición es un extra: si los metadatos fallan, la tabla sale igual.
			getJson(`${API}/indicators`).catch(() => null)
		]);

		const empty: [null, null] = [null, null];
		const rows: ImfRow[] = Object.entries(AREAS)
			.map(([code, name]) => ({ code, name, gdp: gdp[code] ?? empty, cpi: cpi[code] ?? empty }))
			.filter((r) => [...r.gdp, ...r.cpi].some((v) => v !== null));
		if (!rows.length) throw new Error('el FMI no devuelve previsiones');

		const ind = meta?.indicators ?? {};
		return {
			edition: edition(ind.NGDP_RPCH?.source) ?? edition(ind.PCPIPCH?.source),
			years,
			rows
		};
	}
};
