// Tesoro de EE. UU.: deuda pública (Fiscal Data API, sin clave) y curva de tipos diaria (feed XML).
// https://fiscaldata.treasury.gov/api-documentation/ · https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
// Dominio público.
import { XMLParser } from 'fast-xml-parser';
import type { Auction, AuctionsData, SeriesData, YieldCurveData } from '../../src/lib/types.ts';
import { getJson, getText, list, madridDay, num, type Source } from '../lib.ts';

const DEBT_API =
	'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny';
const CURVE_FEED =
	'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=';

const TENORS: [string, string][] = [
	['BC_1MONTH', '1M'],
	['BC_3MONTH', '3M'],
	['BC_6MONTH', '6M'],
	['BC_1YEAR', '1A'],
	['BC_2YEAR', '2A'],
	['BC_5YEAR', '5A'],
	['BC_10YEAR', '10A'],
	['BC_30YEAR', '30A']
];

export const usdebt: Source<SeriesData> = {
	name: 'usdebt',
	label: 'Deuda pública · Tesoro de EE. UU. (Fiscal Data)',
	maxAgeMinutes: 355,
	async fetch() {
		const body = await getJson<{ data: Record<string, string>[] }>(
			`${DEBT_API}?sort=-record_date&page[size]=260&fields=record_date,tot_pub_debt_out_amt`
		);
		const points = body.data
			.map((d) => ({ t: d.record_date, v: num(d.tot_pub_debt_out_amt) }))
			.filter((p): p is { t: string; v: number } => p.v !== null)
			.reverse();
		if (!points.length) throw new Error('sin datos de deuda');
		return {
			series: [
				{
					id: 'debt-us',
					label: 'Deuda pública total',
					unit: '$',
					geo: 'US',
					points,
					source: 'Tesoro de EE. UU.',
					url: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/'
				}
			]
		};
	}
};

function month(offset: number): string {
	const d = new Date();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() + offset);
	return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });

async function curveMonth(yyyymm: string): Promise<YieldCurveData['days']> {
	const doc = xml.parse(await getText(CURVE_FEED + yyyymm));
	return list<any>(doc?.feed?.entry)
		.map((entry) => {
			const p = entry?.content?.properties ?? {};
			const date = String(p.NEW_DATE ?? '').slice(0, 10);
			return { date, values: TENORS.map(([key]) => num(p[key])) };
		})
		.filter((d) => d.date);
}

export const uscurve: Source<YieldCurveData> = {
	name: 'uscurve',
	label: 'Curva de tipos diaria · Tesoro de EE. UU.',
	maxAgeMinutes: 115,
	async fetch() {
		// Mes actual y anterior, para tener siempre al menos un mes de historia.
		const months = await Promise.all([curveMonth(month(-1)), curveMonth(month(0))]);
		const byDate = new Map(months.flat().map((d) => [d.date, d]));
		const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
		if (!days.length) throw new Error('curva vacía');
		return { tenors: TENORS.map(([, label]) => label), days };
	}
};

// ---------- Subastas de deuda (Fiscal Data, auctions_query) ----------
// Una fila por subasta. Las anunciadas que aún no se han hecho vienen con los resultados a «null».
// Solo bonos y notas (los de 2 a 30 años), que son los que mira el mercado; las letras salen cada semana.

const AUCTIONS_API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query';
const AUCTION_FIELDS = [
	'auction_date',
	'issue_date',
	'security_type',
	'security_term',
	'cusip',
	'reopening',
	'offering_amt',
	'high_yield',
	'bid_to_cover_ratio',
	'indirect_bidder_accepted',
	'comp_accepted',
	'floating_rate'
];

/** Cuántas subastas anteriores del mismo plazo hacen la media del bid-to-cover. */
export const BTC_LOOKBACK = 6;

type RawAuction = Record<string, string | undefined>;

/** De la fila de la API a una subasta. Separada para poder probarla. */
export function toAuction(r: RawAuction): Auction | null {
	if (!r.auction_date || !r.security_term) return null;
	const comp = num(r.comp_accepted);
	const indirect = num(r.indirect_bidder_accepted);
	// Las de tipo flotante (FRN) se marcan aparte: su bid-to-cover no se compara con el de las notas.
	const kind = r.floating_rate === 'Yes' ? 'FRN' : (r.security_type ?? '');
	return {
		date: r.auction_date,
		term: r.security_term,
		kind,
		reopening: r.reopening === 'Yes',
		offering: num(r.offering_amt),
		highYield: num(r.high_yield),
		bidToCover: num(r.bid_to_cover_ratio),
		indirectPct: comp && indirect !== null ? Math.round((indirect / comp) * 1000) / 10 : null
	};
}

/**
 * Separa las próximas (sin resultado y desde hoy) de las ya hechas, y a cada hecha le pone la media del
 * bid-to-cover de sus `BTC_LOOKBACK` subastas anteriores del mismo plazo y tipo (si hay al menos 3).
 */
export function splitAuctions(all: Auction[], today: string, recent = 10): AuctionsData {
	const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
	const upcoming = sorted.filter((a) => a.bidToCover === null && a.date >= today);
	const done = sorted.filter((a) => a.bidToCover !== null);
	const withAvg = done.map((a, i) => {
		const prev = done
			.slice(0, i)
			.filter((b) => b.term === a.term && b.kind === a.kind)
			.slice(-BTC_LOOKBACK)
			.map((b) => b.bidToCover!);
		const avg = prev.length >= 3 ? Math.round((prev.reduce((s, v) => s + v, 0) / prev.length) * 100) / 100 : null;
		return { ...a, avgBidToCover: avg };
	});
	return { upcoming, recent: withAvg.slice(-recent).reverse() };
}

export const auctions: Source<AuctionsData> = {
	name: 'auctions',
	label: 'Subastas de bonos y notas · Tesoro de EE. UU. (Fiscal Data)',
	maxAgeMinutes: 175,
	async fetch() {
		const params = new URLSearchParams({
			fields: AUCTION_FIELDS.join(','),
			filter: 'security_type:in:(Note,Bond)',
			sort: '-auction_date',
			// ~2 años: de sobra para tener 6 subastas anteriores de cada plazo (el de 20 años sale cada mes).
			'page[size]': '250'
		});
		const body = await getJson<{ data: RawAuction[] }>(`${AUCTIONS_API}?${params}`);
		const all = (body.data ?? []).map(toAuction).filter((a): a is Auction => a !== null);
		if (!all.length) throw new Error('sin subastas');
		return splitAuctions(all, madridDay());
	}
};
