// Respuestas instantáneas de la barra: datos, hipoteca, repostaje, horas, bolsas y bancos centrales.
import { describe, expect, it } from 'vitest';
import { findCommand } from '../cmdline.ts';
import { answerFor, answerNeeds, parseAmount, parseMortgage, plain, type AnswerCtx } from './answers.ts';

const series = (id: string, unit: string, points: [string, number][], source = 'BCE') => ({
	id,
	label: id,
	unit,
	source,
	points: points.map(([t, v]) => ({ t, v }))
});

const DATA: Record<string, unknown> = {
	ecb: { series: [series('euribor-12m', '%', [['2025-09', 2.172], ['2026-08', 2.4], ['2026-09', 2.45]])] },
	bde: { series: [series('premium-es-d', 'pb', [['2026-10-06', 60], ['2026-10-08', 58], ['2026-10-14', 63]], 'Banco de España')] },
	eurostat: { series: [series('unemployment-es', '%', [['2025-08', 11.4], ['2026-08', 10.5]], 'Eurostat'), series('unemployment-it', '%', [['2026-08', 6]], 'Eurostat')] },
	crypto: { coins: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', usd: 67000, eur: 58000, change24h: 1.23, marketCap: 1 }] },
	'fuel-es': {
		sourceDate: '',
		avg: { g95: 1.6, diesel: 1.5, g98: null, glp: null },
		provinces: [{ id: '28', name: 'Madrid', count: 1, lat: 0, lon: 0, avg: { g95: 1.6, diesel: 1.5 }, min: { g95: 1.459, diesel: 1.389 } }]
	},
	fuel: { sourceDate: '', stations: [{ prices: { g95: 1.62, diesel: 1.55 } }, { prices: { g95: 1.58, diesel: null } }] }
};

// Jueves 15 de octubre de 2026, 10:00 en Madrid (8:00 UTC).
const NOW = Date.parse('2026-10-15T08:00:00Z');
const ctx = (extra: Partial<AnswerCtx> = {}): AnswerCtx => ({ get: (n) => DATA[n], now: NOW, ...extra });
const ask = (raw: string, extra?: Partial<AnswerCtx>) => answerFor(raw, ctx(extra));

describe('respuestas de datos', () => {
	it('limpia la pregunta', () => expect(plain('  ¿Cuándo es el   próximo BCE? ')).toBe('cuando es el proximo bce'));

	it('euríbor, prima y paro, con su variación', () => {
		expect(ask('Euríbor')).toEqual({ code: 'EURÍBOR 12 M', desc: '2,450 % · sep 26 · +0,278 pp en un año · BCE', open: 'BTMM' });
		expect(ask('prima')?.desc).toBe('63 pb · 14 oct · +3 en una semana · Banco de España');
		expect(ask('paro es')?.desc).toBe('10,5 % · ago 26 · −0,9 pp en un año · Eurostat');
		expect(ask('paro italia')?.code).toBe('PARO ITALIA');
		expect(ask('paro')?.open).toBe('ECO Paro');
		expect(ask('paro marte')).toBeNull();
	});

	it('dice qué archivo hace falta y avisa mientras carga', () => {
		expect(answerNeeds('euribor')).toEqual(['ecb']);
		expect(answerNeeds('btc')).toEqual(['crypto']);
		expect(answerNeeds('llenar 50L', '28')).toEqual(['fuel-es']);
		expect(answerNeeds('NVDA')).toEqual([]);
		expect(answerFor('euribor', { get: () => undefined, now: NOW })?.desc).toBe('Cargando…');
		expect(answerFor('euribor', { get: () => null, now: NOW })?.desc).toBe('No se ha podido cargar el dato');
	});

	it('bitcoin', () => expect(ask('BTC')?.desc).toBe('67.000 $ · 58.000 € · +1,2 % en 24 h · CoinGecko'));

	it('no tapa los comandos ni los valores', () => {
		for (const raw of ['ECO', 'FUEL', 'NVDA', 'ES', 'WS', 'gasolina madrid']) expect(ask(raw)).toBeNull();
		// Las palabras de las respuestas no son comandos; «diésel» y «gasolina» son alias de FUEL, y su respuesta abre FUEL.
		for (const raw of ['prima', 'btc', 'hipoteca', 'llenar', 'hora']) expect(findCommand(raw)).toBeUndefined();
		// «euribor» es alias de BTMM (mercado monetario): su respuesta abre BTMM.
		expect(findCommand('euribor')?.code).toBe('BTMM');
		expect(findCommand('diesel')?.code).toBe('FUEL');
		expect(ask('diesel')?.open).toBe('FUEL');
	});
});

describe('hipoteca', () => {
	it('lee el capital, los años y el diferencial', () => {
		expect(parseAmount('150.000')).toBe(150000);
		expect(parseAmount('150k')).toBe(150000);
		expect(parseAmount('1,5')).toBe(1.5);
		expect(parseMortgage('hipoteca 150000 25a')).toEqual({ capital: 150000, years: 25, spread: 0.75 });
		expect(parseMortgage('hipoteca 200.000 30 anos 1,1')).toEqual({ capital: 200000, years: 30, spread: 1.1 });
		expect(parseMortgage('hipoteca mucho')).toBeNull();
	});

	it('calcula la cuota con el euríbor de hoy', () => {
		const a = ask('hipoteca 150000 25a');
		expect(a?.desc).toMatch(/^\d{3},\d{2} €\/mes · euríbor sep 26 2,450 % \+ 0,75 · /);
		expect(a?.open).toBe('ECO Tu hipoteca');
		expect(ask('hipoteca')?.desc).toMatch(/^Escribe capital y años/);
	});
});

describe('repostaje', () => {
	it('llena en la más barata de tu provincia', () => {
		expect(ask('llenar 50L', { fuelZone: '28' })).toEqual({
			code: '50 L',
			desc: 'gasolina 95 72,95 € (1,459 €/L) · diésel 69,45 € (1,389 €/L) en la más barata de Madrid',
			open: 'FUEL Madrid'
		});
		expect(ask('llenar 40 l diesel', { fuelZone: '28' })?.desc).toBe('diésel 55,56 € (1,389 €/L) en la más barata de Madrid');
	});

	it('en Menorca (o sin zona elegida), con sus gasolineras', () => {
		expect(ask('diésel')?.desc).toBe('diésel 1,550 €/L la más barata · media de España 1,500 en Menorca');
		expect(ask('llenar 10 gasolina')?.desc).toBe('gasolina 95 15,80 € (1,580 €/L) en la más barata de Menorca');
		expect(ask('llenar 900')?.desc).toMatch(/^Escribe los litros/);
	});
});

describe('horas, bolsas y bancos centrales', () => {
	it('la hora de otra ciudad y su bolsa', () => {
		expect(ask('hora tokio')).toEqual({ code: 'TOKIO', desc: '17:00 · +7 h respecto a Madrid · bolsa cerrada, abre en 16 h' });
		expect(ask('hora NY')?.desc).toBe('04:00 · −6 h respecto a Madrid · bolsa cerrada, abre en 5 h 30 min');
		expect(ask('qué hora es en Sídney')?.desc).toMatch(/^19:00 · \+9 h/);
		expect(ask('hora marte')?.desc).toMatch(/^No conozco/);
	});

	it('si la bolsa está abierta, hoy, mañana o un día de la semana', () => {
		expect(ask('¿Está abierta la bolsa?')?.desc).toBe('La bolsa de Madrid: abierta, cierra en 7 h 30 min');
		expect(ask('¿abre la bolsa mañana?')?.desc).toBe('Mañana (vie 16): La bolsa de Madrid abre de 09:00 a 17:30 (hora de Madrid)');
		expect(ask('abre wall street el sábado')?.desc).toBe('sáb 17: Wall Street cerrada: fin de semana');
		// Navidad: el viernes 25 de diciembre de 2026 no hay bolsa.
		const xmas = answerFor('abre la bolsa mañana', { get: () => undefined, now: Date.parse('2026-12-24T10:00:00Z') });
		expect(xmas?.desc).toMatch(/cerrada: festivo/);
	});

	it('el próximo BCE y la próxima Fed', () => {
		expect(ask('¿Cuándo es el próximo BCE?')).toMatchObject({ code: 'BCE', open: 'CAL' });
		expect(ask('proxima fed')?.desc).toMatch(/^Próxima decisión de tipos: .+ · (hoy|mañana|en \d+ días)$/);
	});
});

describe('Intro', () => {
	it('lo que abre una respuesta es un comando, no otra respuesta', () => {
		const raws = ['euribor', 'prima', 'paro es', 'btc', 'us10y', 'hipoteca 150000 25a', 'llenar 50L', 'diesel', 'proximo bce'];
		for (const raw of raws) {
			const open = ask(raw, { fuelZone: '28' })?.open;
			expect(open, raw).toBeTruthy();
			expect(ask(open!), open).toBeNull();
		}
	});
});

describe('periodos y comparaciones de series', () => {
	it('«paro es 1a» compara con hace un año; si no hay tanto, lo dice', () => {
		expect(ask('paro es 1a')?.desc).toBe('11,4 % (ago 25) → 10,5 % (ago 26) · −0,9 pp · Eurostat');
		expect(ask('paro es 10a')?.desc).toBe('10,5 % · ago 26 · aquí solo hay datos desde ago 25 (11,4 %, −0,9 pp)');
		expect(answerNeeds('paro es 10a')).toEqual(['eurostat']);
	});

	it('«paro es vs it» y «es vs it paro»', () => {
		const want = { code: 'PARO', desc: 'España 10,5 % · Italia 6,0 % · diferencia +4,5 pp · ago 26 · Eurostat', open: 'ECO Paro' };
		expect(ask('paro es vs it')).toEqual(want);
		expect(ask('ES vs IT paro')).toEqual(want);
		expect(answerNeeds('inflacion es vs de')).toEqual(['eurostat']);
	});

	it('«NVDA desde 2024-01-01»: sin cierres, lo dice y da lo que hay', () => {
		const perf = { symbols: { NVDA: { '5Day': 1.5, '52Week': 80.12 } } };
		const a = answerFor('NVDA desde 2024-01-01', { get: (n) => (n === 'perf' ? perf : undefined), now: NOW });
		expect(a).toEqual({ code: 'NVDA', desc: 'Sin histórico de cierres para calcular desde 2024-01-01. Rentabilidad: 5 días +1,5 % · 1 año +80,1 %', open: 'NVDA 60M' });
		expect(answerFor('NVDA desde 2024-01-01', { get: () => null, now: NOW })?.desc).toMatch(/Intro abre el gráfico \(5 años\)$/);
	});
});
