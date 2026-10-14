// COT de la CFTC: posición neta de los especuladores en 7 futuros (ver src/lib/cot.ts). Sin clave.
// API Socrata pública de la CFTC (datos de dominio público del Gobierno de EE. UU.); sin clave, Socrata limita por IP
// sin publicar la cifra: aquí es una consulta cada 12 h. El informe sale los viernes con datos del martes.
import { COT_MARKETS, COT_URL, parseCot, type CotData, type CotRow } from '../../src/lib/cot.ts';
import { getJson, type Source } from '../lib.ts';

const FIELDS = [
	'report_date_as_yyyy_mm_dd',
	'cftc_contract_market_code',
	'open_interest_all',
	'noncomm_positions_long_all',
	'noncomm_positions_short_all'
];

export const cot: Source<CotData> = {
	name: 'cot',
	label: 'Posicionamiento en futuros (COT) · CFTC',
	maxAgeMinutes: 720,
	async fetch() {
		const codes = COT_MARKETS.map((m) => `'${m.code}'`).join(',');
		// Un año y una semana de informes de los 7 mercados (unas 370 filas).
		const params = new URLSearchParams({
			$select: FIELDS.join(','),
			$where: `cftc_contract_market_code in(${codes})`,
			$order: 'report_date_as_yyyy_mm_dd DESC',
			$limit: String(COT_MARKETS.length * 54)
		});
		const rows = await getJson<CotRow[]>(`${COT_URL}?${params}`);
		const data = parseCot(rows);
		if (!data) throw new Error('la CFTC no trae informes de los mercados seguidos');
		return data;
	}
};
