// Tesoro de EE. UU.: deuda pública (Fiscal Data API, sin clave) y curva de tipos diaria (feed XML).
// https://fiscaldata.treasury.gov/api-documentation/ · https://home.treasury.gov/treasury-daily-interest-rate-xml-feed
// Dominio público.
import { XMLParser } from 'fast-xml-parser';
import type { SeriesData, YieldCurveData } from '../../src/lib/types.ts';
import { getJson, getText, list, num, type Source } from '../lib.ts';

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
		// Mes actual y anterior, para tener siempre al menos un mes de historia, y los mismos meses de hace un
		// año, para comparar la curva de hoy con la de entonces (WS).
		const months = await Promise.all([-13, -12, -1, 0].map((m) => curveMonth(month(m))));
		const byDate = new Map(months.flat().map((d) => [d.date, d]));
		const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
		if (!days.length) throw new Error('curva vacía');
		return { tenors: TENORS.map(([, label]) => label), days };
	}
};
