// PREGUNTA (cloud/ask.ts) con un binding de Workers AI de mentira: quién puede, el tope diario, qué datos se eligen,
// la comprobación de cifras y el contador en una D1 de verdad (SQLite).
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../src/lib/gseries.ts';
import { clearKeyCache } from './access.ts';
import {
	answerOf,
	ASK_LIMITS,
	clearAskCache,
	compact,
	d1AskStore,
	figures,
	handleAsk,
	memoryAskStore,
	MODEL,
	NO_SE,
	pickData,
	unsupported,
	type AskEnv
} from './ask.ts';
import { sqliteD1 } from './d1sqlite.ts';
import { resetSchema } from './schema.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(() => {
	clearKeyCache();
	clearAskCache();
	resetSchema();
});

const AT = '2026-10-20T11:32:19.833Z';
const NOW = Date.parse('2026-10-20T15:00:00Z');
const CATALOG: CatalogEntry[] = [
	{ id: 'euribor-12m', ds: 'ecb', label: 'Euríbor a 12 meses', unit: '%', geo: 'EA', from: '1999-01', n: 4 },
	{ id: 'ecb-dfr', ds: 'ecb', label: 'Facilidad de depósito', unit: '%', geo: 'EA', from: '1999-01', n: 3 },
	{ id: 'ipc-es', ds: 'ine', label: 'IPC de España', unit: '%', from: '2020-01', n: 3 }
];
/** 41 provincias por orden alfabético: Madrid, la última; la del diésel más barato, la 27 (ninguna de las dos entre las 12 primeras). */
const PROVINCES = [
	...Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: `Provincia ${i}`, count: 100, lat: 40, lon: -3, avg: { g95: 1.5, diesel: 1.4 }, min: { g95: 1.4, diesel: i === 27 ? 1.199 : 1.3 } })),
	{ id: '28', name: 'Madrid', count: 800, lat: 40.4, lon: -3.7, avg: { g95: 1.533, diesel: 1.452 }, min: { g95: 1.399, diesel: 1.319 } }
];
const hm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/**
 * Como power.json de REE: el PVPC de hoy por horas (24) y el mayorista cada 15 minutos de hoy y mañana (192), en hora
 * de Madrid. Lo más barato del PVPC, a las 3:00. Lo más barato de mañana, a las 15:30 (0,3 €/MWh); lo más caro, a las 21:00; el último punto (23:45), 125.
 */
const POWER = {
	pvpc: Array.from({ length: 24 }, (_, h) => ({ t: `2026-10-20T${hm(h)}:00.000+02:00`, v: h === 3 ? 48.29 : h === 19 ? 372.29 : 150 + h })),
	spot: ['2026-10-20', '2026-10-21'].flatMap((day) =>
		Array.from({ length: 96 }, (_, i) => ({ t: `${day}T${hm(Math.floor(i / 4), (i % 4) * 15)}:00.000+02:00`, v: 120 + (i % 9) }))
	),
	history: [{ date: '2026-10-20', avg: 0.2208, min: 0.0483, max: 0.3723 }]
};
POWER.spot[96 + 62].v = 0.3;
POWER.spot[96 + 84].v = 299;
POWER.spot[191].v = 125;
/** Como quakes.json del USGS: 80 sismos, del más nuevo al más viejo. El más fuerte (6,9) es de hace 4 días, el 77.º. */
const QUAKES = Array.from({ length: 80 }, (_, i) => ({
	id: `us${i}`,
	mag: i === 76 ? 6.9 : i === 7 ? 6.3 : 4.5 + (i % 5) / 10,
	place: i === 76 ? '76 km al NE de Ozernovskiy, Russia' : i === 7 ? '197 km al NO de Port-Olry, Vanuatu' : `Lugar ${i}`,
	time: new Date(Date.parse('2026-10-20T10:40:00Z') - i * 75 * 60_000).toISOString(),
	url: `https://earthquake.usgs.gov/earthquakes/eventpage/us${i}`,
	tsunami: false,
	lon: 150,
	lat: -15,
	depth: 10
}));
const FILES: Record<string, unknown> = {
	'/data/g/series.json': { name: 'g/series', fetchedAt: AT, data: CATALOG },
	'/data/status.json': {
		name: 'status',
		fetchedAt: AT,
		data: [
			{ name: 'ecb', label: 'BCE' },
			{ name: 'fuel-es', label: 'Gasolineras de España' }
		]
	},
	'/data/ecb.json': {
		name: 'ecb',
		fetchedAt: AT,
		data: {
			series: [
				{
					id: 'euribor-12m',
					label: 'Euríbor a 12 meses',
					unit: '%',
					points: [
						{ t: '2026-07-01', v: 2.08 },
						{ t: '2026-08-01', v: 2.11 },
						{ t: '2026-09-01', v: 2.137 },
						{ t: '2026-10-20', v: 2.153 }
					]
				},
				{ id: 'ecb-dfr', label: 'Facilidad de depósito', unit: '%', points: [{ t: '2025-06-11', v: 2 }, { t: '2026-06-11', v: 1.75 }, { t: '2026-09-17', v: 1.75 }] }
			]
		}
	},
	'/data/fuel-es.json': {
		name: 'fuel-es',
		fetchedAt: AT,
		data: {
			sourceDate: '20/10/2026 10:00:00',
			avg: { g95: 1.521, diesel: 1.437 },
			provinces: PROVINCES,
			// Como lo guarda scripts/sources/fuel.ts: medio año, y cada día con la media de cada provincia por su id.
			history: Array.from({ length: 180 }, (_, d) => ({
				date: new Date(NOW - (179 - d) * 86_400_000).toISOString().slice(0, 10),
				avg: { g95: 1.5, diesel: d === 100 ? 1.611 : 1.437 },
				provinces: Object.fromEntries(PROVINCES.map((p) => [p.id, p.avg]))
			}))
		}
	},
	'/data/oilbulletin.json': { name: 'oilbulletin', fetchedAt: AT, data: { date: '2026-10-12', rows: [{ code: 'ES', name: 'España', diesel: { tax: 1.389, net: 0.882 } }] } },
	'/data/power.json': { name: 'power', fetchedAt: AT, data: POWER },
	'/data/quakes.json': { name: 'quakes', fetchedAt: AT, data: QUAKES }
};

/** Un Workers AI de mentira: apunta lo que recibe y contesta lo que se le diga. */
function fakeAi(reply: (system: string, question: string) => unknown = () => ({ response: NO_SE })) {
	const calls: { model: string; system: string; question: string; input: Record<string, unknown> }[] = [];
	return {
		calls,
		async run(model: string, input: Record<string, unknown>) {
			const [system, user] = input.messages as { content: string }[];
			calls.push({ model, system: system.content, question: user.content, input });
			return reply(system.content, user.content);
		}
	};
}

const assets = {
	async fetch(url: string) {
		const file = FILES[new URL(url).pathname];
		return file ? Response.json(file) : new Response('no', { status: 404 });
	}
};

const env = (ai = fakeAi()): AskEnv & { AI: ReturnType<typeof fakeAi> } => ({ ...ENV, AI: ai, ASSETS: assets });

async function call(
	e: AskEnv,
	store: ReturnType<typeof memoryAskStore> | null,
	{ method = 'POST', body, raw, claims = { email: 'ana@x.es' } as Record<string, unknown> | null, origin }: { method?: string; body?: unknown; raw?: string; claims?: Record<string, unknown> | null; origin?: string } = {}
) {
	const headers: Record<string, string> = {};
	if (claims) headers['cf-access-jwt-assertion'] = await k.sign(claims);
	if (origin) headers.origin = origin;
	if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
	const request = new Request('https://arcterminal.dev/api/ask', {
		method,
		headers,
		body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
	});
	const res = await handleAsk(request, e, store, k.certs, NOW);
	return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const ask = (e: AskEnv, store: ReturnType<typeof memoryAskStore>, q: string) => call(e, store, { body: { q } });

describe('/api/ask: quién y cuándo', () => {
	it('sin Workers AI, sin los archivos o sin base: 503 «sin configurar» (y no llama a nada)', async () => {
		const store = memoryAskStore();
		expect(await call({ ...ENV, ASSETS: assets }, store, { body: { q: 'luz' } })).toEqual({ status: 503, body: { error: 'sin configurar' } });
		expect(await call({ ...ENV, AI: fakeAi() }, store, { body: { q: 'luz' } })).toEqual({ status: 503, body: { error: 'sin configurar' } });
		expect((await call(env(), null, { body: { q: 'luz' } })).status).toBe(503);
		expect(store.rows.size).toBe(0);
	});

	it('sin JWT, desde otra web o con un token de servicio: fuera', async () => {
		const store = memoryAskStore();
		const ai = fakeAi();
		expect((await call(env(ai), store, { body: { q: 'euríbor' }, claims: null })).status).toBe(401);
		expect((await call(env(ai), store, { body: { q: 'euríbor' }, origin: 'https://malo.example' })).status).toBe(403);
		expect((await call(env(ai), store, { body: { q: 'euríbor' }, claims: { common_name: 'svc' } })).status).toBe(403);
		expect(ai.calls).toEqual([]);
	});

	it('GET: cuántas lleva hoy, el tope y el modelo', async () => {
		expect(await call(env(), memoryAskStore(), { method: 'GET' })).toEqual({ status: 200, body: { used: 0, limit: 20, model: MODEL } });
	});

	it('pregunta que no vale: 415, 400 o 413, sin gastar IA', async () => {
		const store = memoryAskStore();
		const ai = fakeAi();
		const e = env(ai);
		const res = await call(e, store, { body: undefined, method: 'POST' });
		expect(res.status).toBe(415);
		expect((await call(e, store, { raw: '{roto' })).status).toBe(400);
		expect((await call(e, store, { body: { q: '   ' } })).status).toBe(400);
		expect((await call(e, store, { body: { q: 'x'.repeat(ASK_LIMITS.question + 1) } })).status).toBe(413);
		expect((await call(e, store, { raw: JSON.stringify({ q: 'luz', pad: 'x'.repeat(3000) }) })).status).toBe(413);
		expect((await call(e, store, { method: 'PUT', body: { q: 'luz' } })).status).toBe(405);
		expect(ai.calls).toEqual([]);
	});
});

describe('/api/ask: respuestas', () => {
	it('«euríbor»: manda la serie del BCE con su hora, en español, y devuelve la respuesta y sus fuentes', async () => {
		const store = memoryAskStore();
		const ai = fakeAi(() => ({ response: 'El euríbor a 12 meses está en el 2,15 % (20 de octubre de 2026), frente al 2,08 % de julio.' }));
		const res = await ask(env(ai), store, '¿Cómo está el euríbor?');
		expect(res).toEqual({
			status: 200,
			body: {
				answer: 'El euríbor a 12 meses está en el 2,15 % (20 de octubre de 2026), frente al 2,08 % de julio.',
				sources: [{ name: 'ecb', label: 'BCE', fetchedAt: AT }],
				used: 1,
				limit: 20
			}
		});
		const [c] = ai.calls;
		expect(c.model).toBe(MODEL);
		expect(c.question).toBe('¿Cómo está el euríbor?');
		expect(c.system).toContain('español');
		expect(c.system).toContain(NO_SE);
		expect(c.system).toContain(`[BCE · datos del ${AT}]`);
		expect(c.system).toContain('Euríbor a 12 meses');
		expect(c.system).toContain('2.153');
		// Solo la serie que se pide, no el archivo entero.
		expect(c.system).not.toContain('Facilidad de depósito');
		expect(c.input.max_completion_tokens).toBe(ASK_LIMITS.tokens);
	});

	it('una cifra que no está en los datos: se descarta y sale «No lo sé», marcada como rechazada', async () => {
		const store = memoryAskStore();
		const ai = fakeAi(() => ({ choices: [{ message: { content: 'El euríbor está en el 3,9 %.' } }] }));
		const res = await ask(env(ai), store, 'euríbor hoy');
		expect(res.body).toMatchObject({ answer: NO_SE, rejected: true, used: 1 });
		expect([...store.rows.values()]).toEqual([{ n: 1, rejected: 1 }]);
	});

	it('si el modelo dice que no lo sabe, sale tal cual, sin marcarla', async () => {
		const store = memoryAskStore();
		const res = await ask(env(fakeAi(() => ({ response: 'No lo sé con los datos de hoy.' }))), store, '¿Y el euríbor en 2030?');
		expect(res.body).toMatchObject({ answer: NO_SE, used: 1 });
		expect(res.body.rejected).toBe(false);
	});

	it('«diésel en Madrid»: gasolineras de España primero, con Madrid dentro aunque no sea de las primeras', async () => {
		const ai = fakeAi(() => ({ response: 'En Madrid, el diésel cuesta de media 1,452 €/l; el más barato, 1,319 €/l.' }));
		const res = await ask(env(ai), memoryAskStore(), '¿Cuánto cuesta el diésel en Madrid?');
		expect((res.body.sources as { name: string }[]).map((s) => s.name)).toEqual(['fuel-es', 'oilbulletin']);
		expect(ai.calls[0].system).toContain('"name":"Madrid"');
		expect(res.body.answer).toContain('1,452');
	});

	it('«dónde está más barato el diésel»: la lista dice que va recortada y trae el extremo, calculado con todas', async () => {
		const ai = fakeAi();
		await ask(env(ai), memoryAskStore(), '¿Dónde está más barato el diésel?');
		const { system } = ai.calls[0];
		expect(system).toContain('"recorte":"se ven 12 de 41"');
		expect(system).toContain('"min.diesel":{"menor":{"v":1.199,"de":"Provincia 27"}');
		// El historial también: su día más caro, aunque no esté entre los últimos.
		expect(system).toMatch(/"recorte":"se ven \d+ de 180","extremos":\{"avg\.diesel":\{"menor":\{"v":1\.437,"de":"[\d-]+"\},"mayor":\{"v":1\.611/);
		// Las provincias de cada día del historial van por id, sin nombre: fuera (no dejaban sitio a las de hoy).
		expect(system).not.toContain('"provinces":{');
	});

	it('«a qué hora será más barata la luz mañana»: la luz alrededor de ahora y lo más barato y lo más caro de cada día', async () => {
		const store = memoryAskStore();
		const ai = fakeAi(() => ({ response: 'Mañana, 21 de octubre, lo más barato será a las 15:30, a 0,3 €/MWh.' }));
		const res = await ask(env(ai), store, '¿A qué hora será más barata la luz mañana?');
		expect(res.body.answer).toBe('Mañana, 21 de octubre, lo más barato será a las 15:30, a 0,3 €/MWh.');
		const { system } = ai.calls[0];
		// Ahora son las 17:00 en Madrid: entran los cuartos de hora de alrededor, no los últimos de mañana.
		expect(system).toContain('AHORA: martes, 20 de octubre de 2026, 17:00, hora de Madrid (2026-10-20T15:00 UTC).');
		expect(system).toContain('{"t":"2026-10-20T17:00:00.000+02:00","v":125}');
		expect(system).not.toContain('2026-10-21T23:45');
		expect(system).toContain('"recorte":"se ven 12 de 192","por_dia":[{"dia":"2026-10-20"');
		expect(system).toContain('{"dia":"2026-10-21","puntos":96,"media":');
		expect(system).toContain('"min":{"t":"2026-10-21T15:30:00.000+02:00","v":0.3},"max":{"t":"2026-10-21T21:00:00.000+02:00","v":299}');
		// Del PVPC (solo hoy), lo más barato del día, aunque sea de madrugada y no entre en la lista.
		expect(system).toContain('"min":{"t":"2026-10-20T03:00:00.000+02:00","v":48.29}');
		expect(system).not.toContain('{"t":"2026-10-20T03:00:00.000+02:00","v":48.29},{');
		// «A las 23:45, 125,5 €/MWh» (el último punto, que no entra): se descarta.
		const wrong = fakeAi(() => ({ response: 'Mañana lo más barato será a las 23:45, a 125,5 €/MWh.' }));
		expect((await ask(env(wrong), store, '¿A qué hora será más barata la luz mañana?')).body).toMatchObject({ answer: NO_SE, rejected: true });
	});

	it('«el terremoto más fuerte de la semana»: el de 6,9 de hace 4 días sale en los extremos, aunque no entre en la lista', async () => {
		const ai = fakeAi(() => ({ response: 'El más fuerte fue uno de 6,9 a 76 km al NE de Ozernovskiy (Rusia), el 16 de octubre.' }));
		const res = await ask(env(ai), memoryAskStore(), '¿Cuál ha sido el terremoto más fuerte esta semana?');
		expect(res.body.answer).toContain('6,9');
		const { system } = ai.calls[0];
		expect(system).toContain('"recorte":"se ven 12 de 80"');
		expect(system).toContain('"mag":{"menor":{"v":4.5,');
		expect(system).toContain('"mayor":{"v":6.9,"de":"76 km al NE de Ozernovskiy, Russia · 2026-10-16T');
		// Las reglas: qué quiere decir el recorte y que, sin extremos, «el mayor» no se sabe.
		expect(system).toContain('solo enseña 12 de sus 80 elementos');
		expect(system).toContain(`salvo con sus «extremos» o su «por_dia», que se calculan con todos los elementos. Si no salen ahí, contesta exactamente: «${NO_SE}»`);
	});

	it('si ningún dato de hoy trata de eso: «No lo sé», sin llamar a la IA ni contar', async () => {
		const store = memoryAskStore();
		const ai = fakeAi();
		const res = await ask(env(ai), store, '¿Quién ganó el Mundial de 1982?');
		expect(res.body).toEqual({ answer: NO_SE, sources: [], used: 0, limit: 20 });
		expect(ai.calls).toEqual([]);
	});

	it('tope: 20 al día; la 21 da 429 sin llamar a la IA, y al día siguiente vuelve a haber', async () => {
		const store = memoryAskStore();
		const ai = fakeAi();
		for (let i = 0; i < ASK_LIMITS.perDay; i++) expect((await ask(env(ai), store, 'euríbor')).status).toBe(200);
		expect(await ask(env(ai), store, 'euríbor')).toEqual({ status: 429, body: { error: 'tope diario', used: 20, limit: 20 } });
		expect(ai.calls).toHaveLength(ASK_LIMITS.perDay);
		// Otra persona tiene su propio tope.
		expect((await call(env(ai), store, { body: { q: 'euríbor' }, claims: { email: 'bob@x.es' } })).status).toBe(200);
		const tomorrow = new Request('https://arcterminal.dev/api/ask', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'cf-access-jwt-assertion': await k.sign({ email: 'ana@x.es' }) },
			body: JSON.stringify({ q: 'euríbor' })
		});
		expect((await handleAsk(tomorrow, env(ai), store, k.certs, NOW + 86_400_000)).status).toBe(200);
	});

	it('si Workers AI falla (cuota agotada): 503 y la pregunta no cuenta', async () => {
		const store = memoryAskStore();
		const ai = fakeAi(() => {
			throw new Error('4006: daily free allocation exceeded');
		});
		expect(await ask(env(ai), store, 'euríbor')).toEqual({ status: 503, body: { error: 'la IA no responde' } });
		expect(await store.used('ana@x.es', '2026-10-20')).toBe(0);
	});
});

describe('elegir los datos', () => {
	it('por los atajos de G, el nombre de la serie y los alias de los comandos', () => {
		expect(pickData('¿Cómo está el euríbor?', CATALOG)).toEqual({ ds: ['ecb', 'nyfed'], series: [CATALOG[0]] });
		expect(pickData('Facilidad de depósito del BCE', CATALOG).series.map((s) => s.id)).toEqual(['ecb-dfr']);
		expect(pickData('¿Sube el IPC?', CATALOG).ds[0]).toBe('ine');
		expect(pickData('precio del diésel', CATALOG).ds).toEqual(['fuel-es', 'oilbulletin']);
		expect(pickData('¿Cuánto cuesta hoy la luz?', CATALOG).ds).toEqual(['power']);
		expect(pickData('¿Cómo va el bitcoin?', CATALOG).ds).toEqual(['crypto', 'vix', 'news-ws']);
		expect(pickData('Resumen de LUZ', []).ds).toEqual(['power']);
		expect(pickData('¿Quién ganó el Mundial?', CATALOG)).toEqual({ ds: [], series: [] });
	});

	it('el país de la pregunta manda: «paro en Alemania» es el alemán; «en España» no elige un tema', () => {
		const paro = (geo: string): CatalogEntry => ({ id: `unemployment-${geo.toLowerCase()}`, ds: 'eurostat', label: 'Paro', unit: '%', geo, from: '2020-01', n: 9 });
		const bund: CatalogEntry = { id: 'bond10-de', ds: 'ecb', label: 'Bono alemán a 10 años', unit: '%', geo: 'DE', from: '2020-01', n: 9 };
		const catalog = [paro('ES'), paro('DE'), paro('US'), bund];
		expect(pickData('paro en Alemania', catalog).series.map((s) => s.id)).toEqual(['unemployment-de']);
		// «paro» solo: el atajo PARO (España), no el de cada país.
		expect(pickData('¿Cómo está el paro?', catalog).series.map((s) => s.id)).toEqual(['unemployment-es']);
		expect(pickData('¿Cuánto cuesta el diésel en España?', catalog).ds).toEqual(['fuel-es', 'oilbulletin']);
	});

	it('las cifras del nombre cuentan: «bono a 10 años» no es el de 1 mes', () => {
		const curve = (tenor: string): CatalogEntry => ({ id: `uscurve-${tenor}`, ds: 'uscurve', label: `Bono de EE. UU. · ${tenor.replace(/A$/, ' años').replace(/M$/, ' meses')}`, unit: '%', from: '2025-09-02', n: 9 });
		const catalog = [curve('1M'), curve('3M'), curve('2A'), curve('10A'), curve('30A')];
		expect(pickData('¿A cuánto está el bono a 10 años de EE. UU.?', catalog).series.map((s) => s.id)).toEqual(['uscurve-10A']);
	});

	it('como mucho cuatro archivos', () => {
		expect(pickData('luz, diésel, bitcoin, terremotos y euríbor', CATALOG).ds).toHaveLength(ASK_LIMITS.datasets);
	});

	it('compact: cabe en el presupuesto, una serie pasada por el final y con sus extremos, y lo que nombra la pregunta delante', () => {
		// 300 meses desde 2001: el máximo, en julio de 2008; el último, en diciembre de 2025.
		const points = Array.from({ length: 300 }, (_, i) => ({ t: `${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, v: i === 90 ? 5.393 : 2 + i / 1000 + 0.000123 }));
		const text = compact({ points, url: 'https://x' }, 400, '', NOW);
		expect(text.length).toBeLessThanOrEqual(400);
		expect(text).not.toContain('https://x');
		expect(text).toContain('{"t":"2025-12","v":2.2991}');
		expect(text).toContain('"recorte":"se ven 8 de 300","extremos":{"v":{"menor":{"v":2.0001,"de":"2001-01"},"mayor":{"v":5.393,"de":"2008-07"}}}');
		const list = Array.from({ length: 50 }, (_, i) => ({ name: i === 42 ? 'Madrid' : `P${i}`, v: i }));
		expect(compact(list, 200, 'gasolina en Madrid')).toContain('Madrid');
		// Lo que cabe entero no lleva recorte.
		expect(compact(list.slice(0, 3), 200)).toBe('[{"name":"P0","v":0},{"name":"P1","v":1},{"name":"P2","v":2}]');
	});

	it('compact: una previsión (de hoy en adelante) empieza por hoy, y un campo igual en todos no sale en los extremos', () => {
		const days = Array.from({ length: 30 }, (_, i) => ({ date: new Date(NOW + i * 86_400_000).toISOString().slice(0, 10), max: 20 + (i % 3), code: 1 }));
		const text = compact(days, 2_000, '', NOW);
		expect(text.startsWith('[{"date":"2026-10-20","max":20,"code":1}')).toBe(true);
		expect(text).toContain('"recorte":"se ven 12 de 30","extremos":{"max":{"menor":{"v":20,"de":"2026-10-20"},"mayor":{"v":22,"de":"2026-10-22"}}}');
	});
});

describe('comprobar las cifras', () => {
	it('lee cifras en español y en inglés, con miles, decimales y «millones»', () => {
		const read = (s: string) => figures(s).map((f) => f.readings.map((r) => r.v));
		expect(read('1.234,5 y 2,35 % y 0.5')).toEqual([[1234.5], [2.35], [0.5]]);
		expect(read('1.234')).toEqual([[1.234, 1234]]);
		expect(read('1.234.567')).toEqual([[1234567]]);
		expect(read('1,2 millones')).toEqual([[1_200_000]]);
		expect(read('3 mil millones')).toEqual([[3e9]]);
	});

	it('vale si está en los datos (redondeada), en la pregunta o en una fecha; si no, se señala', () => {
		const ctx = '{"v":2.153,"t":"2026-10-20","total":1234567,"cambio":-0.81851}';
		expect(unsupported('Está en el 2,15 % el 20/10/2026.', ctx)).toEqual([]);
		expect(unsupported('Unos 1,2 millones; baja un 0,8 %.', ctx)).toEqual([]);
		expect(unsupported('Está en el 2,2 %.', ctx)).toEqual([]);
		expect(unsupported('Está en el 2,16 %.', ctx)).toEqual(['2,16']);
		expect(unsupported('Está en el 3,9 %.', ctx)).toEqual(['3,9']);
		expect(unsupported('A 12 meses, 2,15 %.', ctx, 'euríbor a 12 meses')).toEqual([]);
	});

	it('answerOf: { response } o choices, sin Markdown ni «pensamientos»', () => {
		expect(answerOf({ response: '**Sube** un 2 %' })).toBe('Sube un 2 %');
		expect(answerOf({ choices: [{ message: { content: '<think>a ver</think> Baja.' } }] })).toBe('Baja.');
		expect(answerOf({ choices: [{ message: { content: null } }] })).toBe('');
		expect(answerOf(null)).toBe('');
	});
});

describe('contador en D1', () => {
	it('el tope no se salta con preguntas a la vez, «failed» la devuelve y lo viejo se borra', async () => {
		const db = sqliteD1();
		const store = d1AskStore(db);
		const takes = await Promise.all(Array.from({ length: 25 }, () => store.take('ana@x.es', '2026-10-20', 20)));
		expect(takes.filter(Boolean)).toHaveLength(20);
		expect(await store.used('ana@x.es', '2026-10-20')).toBe(20);
		await store.settle('ana@x.es', '2026-10-20', 'failed');
		await store.settle('ana@x.es', '2026-10-20', 'rejected');
		expect(db.raw.prepare('SELECT n, rejected FROM ask_count').all()).toEqual([{ n: 19, rejected: 1 }]);
		// Un mes y pico después, la fila de hoy ya no está.
		await store.take('ana@x.es', '2026-12-01', 20);
		expect(db.raw.prepare('SELECT day FROM ask_count').all()).toEqual([{ day: '2026-12-01' }]);
	});
});
