// FMI: previsiones de crecimiento e inflación del World Economic Outlook (WEO), vía la API DataMapper,
// sin clave. https://www.imf.org/external/datamapper/api/help
// Respuesta: {"values":{"NGDP_RPCH":{"USA":{"2026":1.8,"2027":2.1}}},"api":{…}}. Si falta un país o un
// año, sencillamente no aparece: se guarda como null.
import type { ImfCountry, ImfData, ImfRow } from '../../src/lib/types.ts';
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

// Los países del G20 (más España, invitada permanente) para la tabla ECST, en el orden en que salen.
export const G20: Record<string, string> = {
	USA: 'EE. UU.',
	CHN: 'China',
	DEU: 'Alemania',
	JPN: 'Japón',
	IND: 'India',
	GBR: 'Reino Unido',
	FRA: 'Francia',
	ITA: 'Italia',
	BRA: 'Brasil',
	CAN: 'Canadá',
	RUS: 'Rusia',
	MEX: 'México',
	AUS: 'Australia',
	KOR: 'Corea del Sur',
	ESP: 'España',
	IDN: 'Indonesia',
	TUR: 'Turquía',
	SAU: 'Arabia Saudí',
	ARG: 'Argentina',
	ZAF: 'Sudáfrica'
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

type ByArea = Record<string, [number | null, number | null]>;

/** Todos los códigos que se piden, sin repetir: los de la tabla de previsiones y los del G20. */
const CODES = [...new Set([...Object.keys(AREAS), ...Object.keys(G20)])];

/** Valores de un indicador para los años pedidos: { USA: [1.8, 2.1], … }. */
async function indicator(id: string, years: [number, number], codes = CODES): Promise<ByArea> {
	const url = `${API}/${id}/${codes.join('/')}?periods=${years.join(',')}`;
	const body = await getJson(url);
	const byArea = body?.values?.[id] ?? {};
	const out: ByArea = {};
	for (const code of codes) {
		const v = byArea[code];
		if (v && typeof v === 'object') out[code] = [num(v[years[0]]), num(v[years[1]])];
	}
	return out;
}

/** Una fila por país del G20 con el dato del año en curso; fuera los que no traen ninguno. */
export function g20Rows(ind: Record<'gdp' | 'cpi' | 'unemployment' | 'debt' | 'balance', ByArea>): ImfCountry[] {
	const now = (by: ByArea, code: string) => by[code]?.[0] ?? null;
	return Object.entries(G20)
		.map(([code, name]) => ({
			code,
			name,
			gdp: now(ind.gdp, code),
			cpi: now(ind.cpi, code),
			unemployment: now(ind.unemployment, code),
			debt: now(ind.debt, code),
			balance: now(ind.balance, code)
		}))
		.filter((r) => [r.gdp, r.cpi, r.unemployment, r.debt, r.balance].some((v) => v !== null));
}

export const imf: Source<ImfData> = {
	name: 'imf',
	label: 'Previsiones de crecimiento e inflación · FMI (WEO)',
	// El WEO sale dos veces al año (abril y octubre) con una actualización en enero y julio: una vez al día sobra.
	maxAgeMinutes: 1440,
	async fetch() {
		const year = Number(madridDay().slice(0, 4));
		const years: [number, number] = [year, year + 1];
		// Paro, deuda y saldo público solo hacen falta para la tabla del G20: si fallan, sale sin esas columnas.
		const optional = (id: string) => indicator(id, years, Object.keys(G20)).catch((): ByArea => ({}));
		const [gdp, cpi, unemployment, debt, balance, meta] = await Promise.all([
			indicator('NGDP_RPCH', years),
			indicator('PCPIPCH', years),
			optional('LUR'),
			optional('GGXWDG_NGDP'),
			optional('GGXCNL_NGDP'),
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
			rows,
			g20: g20Rows({ gdp, cpi, unemployment, debt, balance })
		};
	}
};
