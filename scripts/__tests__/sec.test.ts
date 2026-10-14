// SEC EDGAR: documentos de las empresas. La SEC exige un User-Agent con nombre y correo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sec } from '../sources/sec.ts';
import { mockFetch } from './mock.ts';

const UA = 'Prueba prueba@ejemplo.com';

beforeEach(() => {
	// Relojes falsos del todo: la fuente hace una pausa de 150 ms entre empresas.
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.stubEnv('SEC_USER_AGENT', UA);
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

/** Lanza la fuente y deja correr las pausas. */
async function run() {
	const result = sec.fetch(undefined).catch((error: Error) => error);
	await vi.runAllTimersAsync();
	return result;
}

/** Forma de /submissions/CIK##########.json: columnas paralelas en filings.recent, de lo más reciente a lo más antiguo. */
function submissions(rows: { form: string; acc?: string; date?: string; doc?: string; items?: string }[], over: object = {}) {
	return {
		cik: '1045810',
		entityType: 'operating',
		name: 'NVIDIA CORP',
		tickers: ['NVDA'],
		exchanges: ['Nasdaq'],
		filings: {
			recent: {
				accessionNumber: rows.map((r) => r.acc ?? ''),
				filingDate: rows.map((r) => r.date ?? '2026-10-01'),
				form: rows.map((r) => r.form),
				primaryDocument: rows.map((r) => r.doc ?? ''),
				items: rows.map((r) => r.items ?? '')
			},
			files: []
		},
		...over
	};
}

const nvda = (body: object) => (url: string) => (url.endsWith('/CIK0001045810.json') ? body : undefined);

describe('sec', () => {
	it('lee los documentos, los describe y manda el User-Agent en cada petición', async () => {
		const form4 = (n: number) => ({ form: '4', acc: `0001045810-26-00010${n}`, doc: `xslF345X05/wk-form4_${n}.xml` });
		const fetch = mockFetch(
			nvda(
				submissions([
					{ form: '8-K', acc: '0001045810-26-000200', date: '2026-08-27', doc: 'nvda-20260827.htm', items: '2.02,9.01' },
					{ form: 'SC 13G', acc: '0001045810-26-000199' }, // no interesa
					...[1, 2, 3, 4, 5, 6].map(form4), // solo entran 5
					{ form: '10-Q', acc: '0001045810-26-000150', date: '2026-08-27', doc: 'nvda-20260727.htm' },
					{ form: '8-K/A', acc: '0001045810-26-000140', items: '5.02' }
				])
			)
		);
		const data = (await run()) as Awaited<ReturnType<typeof sec.fetch>>;

		expect(Object.keys(data.companies)).toEqual(['NVDA']);
		const { cik, name, filings } = data.companies.NVDA;
		expect(cik).toBe('0001045810');
		expect(name).toBe('NVIDIA CORP');
		expect(filings.map((f) => f.form)).toEqual(['8-K', 'Form 4', 'Form 4', 'Form 4', 'Form 4', 'Form 4', '10-Q', '8-K/A']);
		expect(filings[0]).toEqual({
			form: '8-K',
			date: '2026-08-27',
			desc: 'Resultados',
			url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000200/nvda-20260827.htm'
		});
		expect(filings[6].desc).toBe('Informe trimestral');
		// Sin documento principal: enlace al índice del expediente.
		expect(filings[7]).toMatchObject({
			desc: 'Cambios en la dirección o el consejo (corrección)',
			url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000140/0001045810-26-000140-index.htm'
		});

		// Una petición por empresa con CIK, todas con el User-Agent del secreto.
		expect(fetch.mock.calls.length).toBeGreaterThan(1);
		for (const [url, init] of fetch.mock.calls) {
			expect(String(url)).toMatch(/^https:\/\/data\.sec\.gov\/submissions\/CIK\d{10}\.json$/);
			expect((init?.headers as Record<string, string>)['User-Agent']).toBe(UA);
		}
	});

	it('avisa si el CIK no corresponde al valor, pero guarda los documentos', async () => {
		mockFetch(nvda(submissions([{ form: '10-K', acc: '0001-26-1' }], { tickers: ['OTRA'] })));
		const data = (await run()) as Awaited<ReturnType<typeof sec.fetch>>;
		expect(data.companies.NVDA.filings).toHaveLength(1);
		expect(console.log).toHaveBeenCalledWith('::warning::sec · NVDA: el CIK 0001045810 es de OTRA');
	});

	it('aguanta columnas ausentes y descarta los documentos sin número de registro', async () => {
		mockFetch(
			nvda({
				cik: 1045810,
				name: null,
				filings: { recent: { form: ['10-K', '8-K', null], accessionNumber: ['0001045810-26-000001', null, 'x'] } }
			})
		);
		const data = (await run()) as Awaited<ReturnType<typeof sec.fetch>>;
		expect(data.companies.NVDA).toEqual({
			cik: '0001045810',
			name: '',
			filings: [
				{
					form: '10-K',
					date: '',
					desc: 'Informe anual',
					url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000001/0001045810-26-000001-index.htm'
				}
			]
		});
	});

	it('se salta las empresas sin documentos o que fallan', async () => {
		mockFetch((url) => {
			if (url.endsWith('/CIK0001045810.json')) return submissions([{ form: '8-K', acc: '1-2-3', items: '8.01' }]);
			if (url.endsWith('/CIK0000320193.json')) return { cik: '320193', name: 'Apple Inc.', tickers: ['AAPL'] }; // sin filings
			return new Response('', { status: 403 });
		});
		const data = (await run()) as Awaited<ReturnType<typeof sec.fetch>>;
		expect(Object.keys(data.companies)).toEqual(['NVDA']);
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('sec · MSFT: HTTP 403'));
	});

	it('lanza un error si ninguna empresa trae documentos', async () => {
		mockFetch(() => ({}));
		const error = await run();
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('sin documentos');
	});
});
