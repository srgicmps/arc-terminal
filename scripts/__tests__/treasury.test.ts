import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uscurve, usdebt } from '../sources/treasury.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('usdebt', () => {
	it('lee la deuda (la API la da de más reciente a más antigua) y la ordena', async () => {
		mockFetch(() => ({
			data: [
				{ record_date: '2026-10-10', tot_pub_debt_out_amt: '38100000000000.12' },
				{ record_date: '2026-10-09', tot_pub_debt_out_amt: 'null' },
				{ record_date: '2026-10-08', tot_pub_debt_out_amt: '38000000000000.00' }
			]
		}));
		const { series } = await usdebt.fetch(undefined);
		expect(series[0]).toMatchObject({ id: 'debt-us', unit: '$', geo: 'US' });
		expect(series[0].points).toEqual([
			{ t: '2026-10-08', v: 38e12 },
			{ t: '2026-10-10', v: 38100000000000.12 }
		]);
	});

	it('falla si no hay datos', async () => {
		mockFetch(() => ({ data: [] }));
		await expect(usdebt.fetch(undefined)).rejects.toThrow('sin datos de deuda');
	});
});

// Feed XML de la curva diaria: Atom con propiedades OData (m:properties, d:BC_10YEAR…).
const curveFeed = (entries: [string, Record<string, string>][]) => `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">
${entries
	.map(
		([date, values]) => `<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>
${Object.entries(values)
	.map(([k, v]) => `<d:${k} m:type="Edm.Double">${v}</d:${k}>`)
	.join('\n')}
</m:properties></content></entry>`
	)
	.join('\n')}
</feed>`;

describe('uscurve', () => {
	it('junta el mes anterior y el actual, sin días repetidos y en orden', async () => {
		const fetch = mockFetch((url) => {
			if (url.endsWith('=202609'))
				return curveFeed([['2026-09-30', { BC_1MONTH: '4.10', BC_10YEAR: '4.05' }]]);
			if (url.endsWith('=202610'))
				return curveFeed([
					['2026-10-02', { BC_1MONTH: '4.12', BC_10YEAR: '4.10', BC_30YEAR: '4.60' }],
					['2026-10-01', { BC_1MONTH: '4.11', BC_10YEAR: '4.08' }]
				]);
			return undefined;
		});
		const data = await uscurve.fetch(undefined);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(data.tenors).toEqual(['1M', '3M', '6M', '1A', '2A', '5A', '10A', '30A']);
		expect(data.days.map((d) => d.date)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
		expect(data.days[2].values).toEqual([4.12, null, null, null, null, null, 4.1, 4.6]);
	});

	it('pide bien el mes anterior en enero', async () => {
		vi.setSystemTime(new Date('2026-01-31T10:00:00Z'));
		const fetch = mockFetch(() => curveFeed([['2026-01-30', { BC_10YEAR: '4' }]]));
		await uscurve.fetch(undefined);
		const urls = fetch.mock.calls.map((c) => String(c[0]).split('=').at(-1));
		expect(urls).toEqual(['202512', '202601']);
	});

	it('acepta un mes con un solo día y falla si la curva está vacía', async () => {
		mockFetch((url) => (url.endsWith('=202610') ? curveFeed([['2026-10-01', { BC_10YEAR: '4' }]]) : curveFeed([])));
		expect((await uscurve.fetch(undefined)).days).toHaveLength(1);
		mockFetch(() => curveFeed([]));
		await expect(uscurve.fetch(undefined)).rejects.toThrow('curva vacía');
	});
});
