// Carteras 13F de la SEC: lista de documentos → índice del expediente → information table.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareQuarters, funds, infoTableName, issuerName, parseInfoTable, pickFilings, type Holding } from '../sources/funds.ts';
import { mockFetch } from './mock.ts';

const UA = 'Prueba prueba@ejemplo.com';

beforeEach(() => {
	// Relojes falsos: la fuente hace una pausa de 150 ms entre peticiones.
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.stubEnv('SEC_USER_AGENT', UA);
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

async function run() {
	const result = funds.fetch(undefined).catch((error: Error) => error);
	await vi.runAllTimersAsync();
	return result;
}

/** Una línea <infoTable> como las de EDGAR. */
function row(name: string, cusip: string, value: number, shares: number, extra = '') {
	return `<infoTable>
		<nameOfIssuer>${name}</nameOfIssuer>
		<titleOfClass>COM</titleOfClass>
		<cusip>${cusip}</cusip>
		<value>${value}</value>
		<shrsOrPrnAmt><sshPrnamt>${shares}</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
		${extra}
		<investmentDiscretion>DFND</investmentDiscretion>
		<otherManager>4,8,11</otherManager>
		<votingAuthority><Sole>${shares}</Sole><Shared>0</Shared><None>0</None></votingAuthority>
	</infoTable>`;
}

const table = (rows: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${rows.join('\n')}
</informationTable>`;

/** /submissions/CIK##########.json: columnas paralelas, de lo más reciente a lo más antiguo. */
function submissions(name: string, cik: string, rows: { form: string; acc: string; filed: string; period?: string }[]) {
	return {
		cik,
		entityType: 'other',
		name,
		tickers: [],
		filings: {
			recent: {
				accessionNumber: rows.map((r) => r.acc),
				filingDate: rows.map((r) => r.filed),
				reportDate: rows.map((r) => r.period ?? ''),
				form: rows.map((r) => r.form),
				primaryDocument: rows.map(() => 'primary_doc.xml')
			},
			files: []
		}
	};
}

/** index.json de un expediente 13F: la portada y la information table, con nombres variables. */
const index = (table: string) => ({
	directory: {
		item: [
			{ 'last-modified': '2026-08-14 16:05:12', name: `0000950123-26-008000-index-headers.html`, type: 'text.gif', size: '' },
			{ 'last-modified': '2026-08-14 16:05:12', name: 'primary_doc.xml', type: 'text.gif', size: '2310' },
			{ 'last-modified': '2026-08-14 16:05:12', name: table, type: 'text.gif', size: '28456' }
		],
		name: '/Archives/edgar/data/1067983/000095012326008000',
		'parent-dir': '/Archives/edgar/data/1067983'
	}
});

describe('pickFilings', () => {
	it('toma los dos últimos 13F-HR y deja fuera enmiendas, avisos y otros formularios', () => {
		const body = submissions('BERKSHIRE HATHAWAY INC', '1067983', [
			{ form: '4', acc: 'a', filed: '2026-09-02' },
			{ form: '13F-HR/A', acc: 'b', filed: '2026-08-20', period: '2026-06-30' },
			{ form: '13F-HR', acc: 'c', filed: '2026-08-14', period: '2026-06-30' },
			{ form: 'SC 13G/A', acc: 'd', filed: '2026-06-01' },
			{ form: '13F-HR', acc: 'e', filed: '2026-05-15', period: '2026-03-31' },
			{ form: '13F-HR', acc: 'f', filed: '2026-02-14', period: '2025-12-31' }
		]);
		expect(pickFilings(body)).toEqual([
			{ accession: 'c', filed: '2026-08-14', period: '2026-06-30' },
			{ accession: 'e', filed: '2026-05-15', period: '2026-03-31' }
		]);
	});

	it('usa las enmiendas solo si no hay ningún original, y no repite trimestre', () => {
		const body = submissions('X', '1', [
			{ form: '13F-HR/A', acc: 'a', filed: '2026-08-20', period: '2026-06-30' },
			{ form: '13F-HR/A', acc: 'b', filed: '2026-08-18', period: '2026-06-30' },
			{ form: '13F-HR/A', acc: 'c', filed: '2026-05-20', period: '2026-03-31' }
		]);
		expect(pickFilings(body).map((f) => f.accession)).toEqual(['a', 'c']);
		expect(pickFilings({})).toEqual([]);
	});
});

describe('infoTableName', () => {
	it('encuentra la information table aunque cada gestor la llame distinto', () => {
		expect(infoTableName(index('form13fInfoTable.xml'))).toBe('form13fInfoTable.xml');
		expect(infoTableName(index('46994.xml'))).toBe('46994.xml');
		expect(infoTableName({ directory: { item: [{ name: 'primary_doc.xml' }] } })).toBeNull();
	});
});

describe('parseInfoTable', () => {
	it('suma las líneas del mismo CUSIP y marca aparte las opciones', () => {
		const xml = table([
			row('APPLE INC', '037833100', 40_000_000_000, 160_000_000),
			row('APPLE INC', '037833100', 17_250_000_000, 69_000_000),
			row('BANK AMER CORP', '060505104', 30_000_000_000, 650_000_000),
			row('NVIDIA CORPORATION', '67066G104', 1_800_000_000, 10_000_000, '<putCall>Put</putCall>')
		]);
		expect(parseInfoTable(xml, '2026-08-14')).toEqual([
			{ cusip: '037833100', name: 'Apple Inc', value: 57_250_000_000, shares: 229_000_000 },
			{ cusip: '060505104', name: 'Bank Amer Corp', value: 30_000_000_000, shares: 650_000_000 },
			{ cusip: '67066G104', name: 'Nvidia Corporation', value: 1_800_000_000, shares: 10_000_000, putCall: 'Put' }
		]);
	});

	it('antes de 2023 el valor va en miles de dólares', () => {
		const xml = table([row('APPLE INC', '037833100', 155_562_334, 894_802_319)]);
		expect(parseInfoTable(xml, '2022-11-14')[0].value).toBe(155_562_334_000);
		expect(parseInfoTable(xml, '2023-02-14')[0].value).toBe(155_562_334);
	});

	it('entiende el XML con prefijo de espacio de nombres (ns1:) y una sola línea', () => {
		const xml = `<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
			<ns1:infoTable><ns1:nameOfIssuer>SPDR S&amp;P 500 ETF TR</ns1:nameOfIssuer><ns1:cusip>78462f103</ns1:cusip>
			<ns1:value>1200</ns1:value><ns1:shrsOrPrnAmt><ns1:sshPrnamt>2</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt></ns1:infoTable>
		</ns1:informationTable>`;
		expect(parseInfoTable(xml, '2026-08-14')).toEqual([{ cusip: '78462F103', name: 'SPDR S&P 500 ETF TR', value: 1200, shares: 2 }]);
	});
});

describe('issuerName', () => {
	it('pasa a minúsculas los nombres, no las siglas, y quita «NEW» o «DEL» del final', () => {
		expect(issuerName('KRAFT HEINZ CO')).toBe('Kraft Heinz Co');
		expect(issuerName('CHEVRON CORP NEW')).toBe('Chevron Corp');
		expect(issuerName('AMAZON.COM INC')).toBe('Amazon.com Inc');
	});
});

describe('compareQuarters', () => {
	const h = (cusip: string, value: number, shares: number, putCall?: 'Put' | 'Call'): Holding => ({
		cusip,
		name: cusip,
		value,
		shares,
		...(putCall && { putCall })
	});

	it('mide compras y ventas por acciones a precio del trimestre, no por cambio de valor', () => {
		const previous = [h('AAPL', 100_000, 1000), h('BAC', 50_000, 1000), h('KO', 30_000, 500), h('OXY', 10_000, 200), h('NVDA', 5_000, 50, 'Put')];
		const current = [
			h('AAPL', 60_000, 400), // vende 600 a 150 → −90.000
			h('BAC', 80_000, 1000), // sube la bolsa, mismas acciones: ni compra ni venta
			h('KO', 36_000, 600), // compra 100 a 60 → +6.000
			h('CB', 20_000, 100), // nueva → +20.000
			h('NVDA', 5_000, 50) // la acción, nueva; el put se cierra
		];
		const { bought, sold } = compareQuarters(current, previous);
		expect(bought.map((m) => [m.cusip, m.value, m.status])).toEqual([
			['CB', 20_000, 'new'],
			['KO', 6_000, 'add'],
			['NVDA', 5_000, 'new']
		]);
		expect(bought[1].pct).toBeCloseTo(0.2);
		expect(bought[0].pct).toBeNull();
		// Las vendidas del todo se valoran al precio del trimestre anterior.
		expect(sold.map((m) => [m.cusip, m.value, m.status, m.putCall])).toEqual([
			['AAPL', -90_000, 'trim', undefined],
			['OXY', -10_000, 'exit', undefined],
			['NVDA', -5_000, 'exit', 'Put']
		]);
		expect(sold[0]).toMatchObject({ shares: -600, pct: -0.6 });
	});

	it('se queda con las 5 mayores de cada lado', () => {
		const current = Array.from({ length: 8 }, (_, i) => h(`N${i}`, (i + 1) * 1000, 10));
		const { bought, sold } = compareQuarters(current, []);
		expect(bought.map((m) => m.cusip)).toEqual(['N7', 'N6', 'N5', 'N4', 'N3']);
		expect(sold).toEqual([]);
	});
});

describe('funds', () => {
	const BRK = '1067983';
	const brk = submissions('BERKSHIRE HATHAWAY INC', BRK, [
		{ form: '13F-HR', acc: '0000950123-26-008000', filed: '2026-08-14', period: '2026-06-30' },
		{ form: '13F-HR', acc: '0000950123-26-005000', filed: '2026-05-15', period: '2026-03-31' }
	]);
	const now = table([
		row('APPLE INC', '037833100', 60_000_000_000, 250_000_000),
		row('AMERICAN EXPRESS CO', '025816109', 45_000_000_000, 151_610_700),
		row('COCA COLA CO', '191216100', 28_000_000_000, 400_000_000),
		row('CHUBB LIMITED', 'H1467J104', 9_000_000_000, 31_000_000)
	]);
	const before = table([
		row('APPLE INC', '037833100', 64_000_000_000, 300_000_000),
		row('AMERICAN EXPRESS CO', '025816109', 44_000_000_000, 151_610_700),
		row('COCA COLA CO', '191216100', 25_000_000_000, 400_000_000),
		row('BANK AMER CORP', '060505104', 4_000_000_000, 100_000_000)
	]);
	const route = (url: string) => {
		const base = `https://www.sec.gov/Archives/edgar/data/${BRK}`;
		if (url === 'https://data.sec.gov/submissions/CIK0001067983.json') return brk;
		if (url === `${base}/000095012326008000/index.json`) return index('infotable.xml');
		if (url === `${base}/000095012326008000/infotable.xml`) return now;
		if (url === `${base}/000095012326005000/index.json`) return index('46994.xml');
		if (url === `${base}/000095012326005000/46994.xml`) return before;
		return new Response('', { status: 404 });
	};

	it('guarda las mayores posiciones con su peso, el total, el trimestre y los cambios', async () => {
		const fetch = mockFetch(route);
		const data = (await run()) as Awaited<ReturnType<typeof funds.fetch>>;

		expect(data.funds).toHaveLength(1);
		const fund = data.funds[0];
		expect(fund).toMatchObject({
			key: 'BRK',
			name: 'Berkshire Hathaway',
			filer: 'BERKSHIRE HATHAWAY INC',
			period: '2026-06-30',
			filed: '2026-08-14',
			url: 'https://www.sec.gov/Archives/edgar/data/1067983/000095012326008000/0000950123-26-008000-index.htm',
			total: 142_000_000_000,
			count: 4,
			prev: { period: '2026-03-31', total: 137_000_000_000 }
		});
		expect(fund.top.map((p) => p.name)).toEqual(['Apple Inc', 'American Express Co', 'Coca Cola Co', 'Chubb Limited']);
		expect(fund.top[0].weight).toBeCloseTo(60 / 142);
		expect(fund.bought.map((m) => [m.name, m.status])).toEqual([['Chubb Limited', 'new']]);
		expect(fund.sold.map((m) => [m.name, m.status, m.value])).toEqual([
			['Apple Inc', 'trim', -12_000_000_000],
			['Bank Amer Corp', 'exit', -4_000_000_000]
		]);

		// Todas las peticiones llevan el User-Agent del secreto.
		for (const [, init] of fetch.mock.calls) {
			expect((init?.headers as Record<string, string>)['User-Agent']).toBe(UA);
		}
		// Los demás fondos dan 404 y se saltan.
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('funds · ARK: HTTP 404'));
	});

	it('sin trimestre anterior, guarda la cartera sin compras ni ventas', async () => {
		mockFetch((url) => (url.endsWith('/000095012326005000/index.json') ? new Response('', { status: 404 }) : route(url)));
		const data = (await run()) as Awaited<ReturnType<typeof funds.fetch>>;
		expect(data.funds[0]).toMatchObject({ count: 4, bought: [], sold: [] });
		expect(data.funds[0].prev).toBeUndefined();
	});

	it('avisa si el CIK es de otro gestor', async () => {
		mockFetch((url) => (url.endsWith('CIK0001067983.json') ? { ...brk, name: 'OTRA SA' } : route(url)));
		await run();
		expect(console.log).toHaveBeenCalledWith('::warning::funds · BRK: el CIK 0001067983 es de «OTRA SA»');
	});

	it('lanza un error si fallan todos los fondos', async () => {
		mockFetch(() => new Response('', { status: 403 }));
		const error = await run();
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('ningún fondo con datos');
	});
});
