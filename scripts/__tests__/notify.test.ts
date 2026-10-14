import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceHistory, SourceStatus } from '../../src/lib/data.ts';
import type { Quake, SeriesData } from '../../src/lib/types.ts';
import { appendSpan } from '../history.ts';
import {
	baselineLog,
	candidates,
	DAILY_LIMIT,
	encodeHeader,
	isQuiet,
	pickAlerts,
	RULES,
	runNotify,
	trim,
	usedToday,
	type Inputs,
	type NotifyLog
} from '../notify.ts';
import { mockFetch } from './mock.ts';

// 14 oct 2026, 12:00 en Madrid (CEST): no hay reunión del BCE ni de la Fed ese día.
const NOW = Date.parse('2026-10-14T10:00:00Z');
const HOUR = 3_600_000;
const TOPIC = 'arc-secreto-Xy9q7ZpL2';
const empty = (): NotifyLog => ({ entries: [], last: {} });

const quake = (id: string, mag: number, hoursAgo = 1, now = NOW): Quake => ({
	id,
	mag,
	place: 'Lugar de prueba',
	time: new Date(now - hoursAgo * HOUR).toISOString(),
	url: '',
	tsunami: false,
	alert: null,
	lat: 0,
	lon: 0,
	depth: 10
});

function down(name: string, runs: number, now = NOW): { status: SourceStatus; history: SourceHistory } {
	let spans = appendSpan(undefined, 'error', now - runs * 15 * 60_000);
	for (let i = 1; i < runs; i++) spans = appendSpan(spans, 'error', now - (runs - i) * 15 * 60_000);
	return {
		status: { name, label: `Etiqueta ${name}`, state: 'error', fetchedAt: null, error: 'HTTP 500' },
		history: { name, lastRun: '', history: spans }
	};
}

const series = (id: string, t: string, v: number): SeriesData => ({
	series: [
		{
			id,
			label: id,
			unit: '%',
			points: [
				{ t: '2026-07', v: 2 },
				{ t, v }
			],
			source: 'X'
		}
	]
});

const keys = (d: Inputs, log = empty(), now = NOW) => pickAlerts(d, log, now).send.map((a) => a.key);

describe('reglas', () => {
	it('RULES: terremoto y fuente caída arriba, luego BCE/Fed, IPC e IMP', () => {
		expect(RULES.map((r) => [r.type, r.priority])).toEqual([
			['quake', 50],
			['down', 50],
			['bank', 40],
			['ipc', 30],
			['imp', 20]
		]);
	});

	it('terremoto: M7 o más en las últimas 24 h, prioridad alta en ntfy', () => {
		const { alerts } = candidates({ quakes: [quake('a', 7.1), quake('b', 6.9), quake('c', 7.5, 30)] }, {}, NOW);
		expect(alerts.map((a) => a.key)).toEqual(['quake:a']);
		expect(alerts[0].priority).toBe('high');
		expect(alerts[0].title).toBe('Terremoto M7,1 · Lugar de prueba');
		expect(alerts[0].click).toBe('https://srgicmps.github.io/arc-terminal/geo');
	});

	it('fuente caída: cuando issues.ts abriría el issue (3 pasadas en error)', () => {
		const a = down('fred', 3);
		const b = down('bls', 2);
		const { alerts } = candidates({ status: [a.status, b.status], history: [a.history, b.history] }, {}, NOW);
		expect(alerts.map((x) => x.key)).toEqual([`down:fred:${a.history.history[0].t}`]);
		expect(alerts[0].priority).toBe('high');
		expect(alerts[0].body).not.toContain('HTTP 500');
	});

	it('IPC: la primera vez se apunta sin avisar; luego avisa de cada mes nuevo una sola vez', () => {
		const d = { ine: series('ipc-es', '2026-09', 2.9), bls: series('cpi-us', '2026-09', 3.1) };
		const first = pickAlerts(d, empty(), NOW);
		expect(first.send).toEqual([]);
		expect(first.baseline).toEqual({ 'ipc-es': '2026-09', 'cpi-us': '2026-09' });
		const after = pickAlerts(d, { entries: [], last: { 'ipc-es': '2026-08', 'cpi-us': '2026-09' } }, NOW);
		expect(after.send.map((a) => a.key)).toEqual(['ipc-es:2026-09']);
		expect(after.send[0].title).toBe('IPC de España: 2,9 %');
		expect(after.send[0].mark).toEqual(['ipc-es', '2026-09']);
		expect(after.send[0].priority).toBe('default');
	});

	it('BCE: el día de la reunión, desde las 14:15 de Madrid', () => {
		expect(keys({}, empty(), Date.parse('2026-10-29T13:00:00Z'))).toEqual([]); // 14:00 CET
		expect(keys({}, empty(), Date.parse('2026-10-29T13:20:00Z'))).toEqual(['bce:2026-10-29']);
		expect(keys({}, empty(), Date.parse('2026-10-30T10:00:00Z'))).toEqual([]);
	});

	it('Fed: 14:00 de Nueva York, que el 28 oct 2026 son las 19:00 en Madrid (EE. UU. aún no ha cambiado de hora)', () => {
		expect(keys({}, empty(), Date.parse('2026-10-28T17:55:00Z'))).toEqual([]);
		const { send } = pickAlerts({}, empty(), Date.parse('2026-10-28T18:05:00Z'));
		expect(send.map((a) => a.key)).toEqual(['fed:2026-10-28']);
		expect(send[0].body).toContain('19:00');
	});

	it('IMP: solo puntuación ≥ 11; sin imp.json no aplica', () => {
		const imp = {
			current: [
				{ k: 'x', title: 'Tema enorme', sources: ['a', 'b', 'c', 'd', 'e'], score: 11, official: 'BCE' },
				{ k: 'y', title: 'Tema normal', sources: ['a'], score: 10.9 }
			]
		};
		expect(keys({ imp })).toEqual(['imp:x']);
		expect(keys({})).toEqual([]);
		expect(keys({ imp: {} as never })).toEqual([]);
	});
});

describe('límites', () => {
	it('una clave ya apuntada (enviada, fallida o vista) no se repite nunca', () => {
		const d = { quakes: [quake('a', 7.2), quake('b', 7.3)] };
		for (const s of ['sent', 'failed', 'baseline'] as const) {
			expect(keys(d, { entries: [{ k: 'quake:a', t: '2026-10-13T10:00Z', s }], last: {} })).toEqual(['quake:b']);
		}
	});

	it(`como mucho ${DAILY_LIMIT} al día (día de Madrid); los de ayer no cuentan`, () => {
		const d = { quakes: Array.from({ length: 25 }, (_, i) => quake(`q${i}`, 7.5, i / 10)) };
		expect(pickAlerts(d, empty(), NOW).send).toHaveLength(20);
		const log: NotifyLog = {
			entries: [
				...Array.from({ length: 18 }, (_, i) => ({ k: `old${i}`, t: '2026-10-14T06:30Z', s: 'sent' as const })),
				...Array.from({ length: 30 }, (_, i) => ({ k: `ayer${i}`, t: '2026-10-13T20:00Z', s: 'sent' as const })),
				...Array.from({ length: 30 }, (_, i) => ({ k: `vista${i}`, t: '2026-10-14T07:00Z', s: 'baseline' as const }))
			],
			last: {}
		};
		expect(usedToday(log, NOW)).toBe(18);
		const { send, held } = pickAlerts(d, log, NOW);
		expect(send).toHaveLength(2);
		expect(held).toHaveLength(23);
	});

	it('si no caben, salen antes los de mayor prioridad y, a igual prioridad, el más reciente', () => {
		const a = down('fred', 3); // empezó hace 45 min
		const d: Inputs = {
			quakes: [quake('viejo', 7.0, 5), quake('nuevo', 7.0, 0.5)],
			status: [a.status],
			history: [a.history],
			ine: series('ipc-es', '2026-09', 2.9),
			imp: { current: [{ k: 'x', title: 'T', sources: [], score: 20 }] }
		};
		const log: NotifyLog = {
			entries: Array.from({ length: DAILY_LIMIT - 3 }, (_, i) => ({
				k: `e${i}`,
				t: '2026-10-14T07:00Z',
				s: 'sent' as const
			})),
			last: { 'ipc-es': '2026-08' }
		};
		const { send, held } = pickAlerts(d, log, NOW);
		expect(send.map((x) => x.key)).toEqual(['quake:nuevo', `down:fred:${a.history.history[0].t}`, 'quake:viejo']);
		expect(held.map((x) => x.key)).toEqual(['ipc-es:2026-09', 'imp:x']);
		// Con hueco de sobra, el orden completo: 50, 50, 50, 30, 20.
		expect(keys(d, { entries: [], last: { 'ipc-es': '2026-08' } })).toEqual([
			'quake:nuevo',
			`down:fred:${a.history.history[0].t}`,
			'quake:viejo',
			'ipc-es:2026-09',
			'imp:x'
		]);
	});

	it('BCE (40) va por delante de IPC (30) e IMP (20)', () => {
		const now = Date.parse('2026-10-29T14:00:00Z'); // 15:00 en Madrid
		const d: Inputs = { ine: series('ipc-es', '2026-09', 2.9), imp: { current: [{ k: 'x', title: 'T', score: 12 }] } };
		const log: NotifyLog = {
			entries: Array.from({ length: DAILY_LIMIT - 1 }, (_, i) => ({
				k: `e${i}`,
				t: '2026-10-29T08:00Z',
				s: 'sent' as const
			})),
			last: { 'ipc-es': '2026-08' }
		};
		expect(keys(d, log, now)).toEqual(['bce:2026-10-29']);
	});

	it('franja de 23:00 a 8:00 en hora de Madrid', () => {
		expect(isQuiet(Date.parse('2026-10-14T20:59:00Z'))).toBe(false); // 22:59 CEST
		expect(isQuiet(Date.parse('2026-10-14T21:00:00Z'))).toBe(true); // 23:00 CEST
		expect(isQuiet(Date.parse('2026-10-14T05:59:00Z'))).toBe(true); // 07:59 CEST
		expect(isQuiet(Date.parse('2026-10-14T06:00:00Z'))).toBe(false); // 08:00 CEST
	});

	it('cambio de hora del 25 oct 2026: las 8:00 pasan de las 06:00 a las 07:00 UTC', () => {
		expect(isQuiet(Date.parse('2026-10-24T06:00:00Z'))).toBe(false); // sábado, 08:00 CEST
		expect(isQuiet(Date.parse('2026-10-25T06:00:00Z'))).toBe(true); // domingo, 07:00 CET
		expect(isQuiet(Date.parse('2026-10-25T06:59:00Z'))).toBe(true); // 07:59 CET
		expect(isQuiet(Date.parse('2026-10-25T07:00:00Z'))).toBe(false); // 08:00 CET
		expect(isQuiet(Date.parse('2026-10-25T21:59:00Z'))).toBe(false); // 22:59 CET
		expect(isQuiet(Date.parse('2026-10-25T22:00:00Z'))).toBe(true); // 23:00 CET
	});

	it('el límite diario cuenta por día de Madrid, también la noche del cambio de hora', () => {
		const log: NotifyLog = {
			entries: [
				{ k: 'a', t: '2026-10-24T21:59Z', s: 'sent' }, // 23:59 CEST del 24
				{ k: 'b', t: '2026-10-24T22:00Z', s: 'sent' }, // 00:00 CEST del 25
				{ k: 'c', t: '2026-10-25T22:59Z', s: 'sent' } // 23:59 CET del 25
			],
			last: {}
		};
		expect(usedToday(log, Date.parse('2026-10-25T12:00:00Z'))).toBe(2);
	});

	it('lo que surge de noche no se apunta: sale en la primera pasada desde las 8:00 si sigue siendo relevante', () => {
		const night = Date.parse('2026-10-25T03:00:00Z'); // 04:00 CET
		const d = { quakes: [quake('noche', 7.4, 0, night)] };
		const quiet = pickAlerts(d, empty(), night);
		expect(quiet.send).toEqual([]);
		expect(quiet.held.map((a) => a.key)).toEqual(['quake:noche']);
		expect(keys(d, empty(), Date.parse('2026-10-25T06:50:00Z'))).toEqual([]); // 07:50 CET
		expect(keys(d, empty(), Date.parse('2026-10-25T07:05:00Z'))).toEqual(['quake:noche']); // 08:05 CET
		// Si ya no es relevante (más de 24 h), se pierde.
		expect(keys(d, empty(), night + 25 * HOUR)).toEqual([]);
	});

	it('trim deja 7 días de intentos y conserva los periodos macro', () => {
		const log: NotifyLog = {
			entries: [
				{ k: 'viejo', t: '2026-10-06T09:00Z', s: 'sent' },
				{ k: 'nuevo', t: '2026-10-08T11:00Z', s: 'sent' }
			],
			last: { 'ipc-es': '2026-09' }
		};
		expect(trim(log, NOW)).toEqual({
			entries: [{ k: 'nuevo', t: '2026-10-08T11:00Z', s: 'sent' }],
			last: { 'ipc-es': '2026-09' }
		});
	});

	it('sin historial, todo lo de ahora queda como visto y no se envía nada', () => {
		const d = { quakes: [quake('a', 7.2)], ine: series('ipc-es', '2026-09', 2.9) };
		const log = baselineLog(d, NOW);
		expect(log.entries).toEqual([{ k: 'quake:a', t: '2026-10-14T10:00Z', s: 'baseline' }]);
		expect(log.last).toEqual({ 'ipc-es': '2026-09' });
		expect(keys(d, log)).toEqual([]);
	});

	it('el título con acentos va en RFC 2047', () => {
		expect(encodeHeader('BCE: decision')).toBe('BCE: decision');
		expect(encodeHeader('Fuente caída')).toBe(`=?UTF-8?B?${Buffer.from('Fuente caída').toString('base64')}?=`);
	});
});

describe('runNotify', () => {
	let dir: string;
	let logged: string[];

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'notify-'));
		logged = [];
		vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
		await writeFile(
			join(dir, 'quakes.json'),
			JSON.stringify({ name: 'quakes', fetchedAt: '', data: [quake('a', 7.2), quake('b', 7.6, 0.5)] })
		);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	const published = (log: NotifyLog) => ({ name: 'notify-log', fetchedAt: '', data: log });
	const written = async () => readFile(join(dir, 'notify-log.json'), 'utf8');

	it('sin NTFY_TOPIC no hace nada y lo dice sin más', async () => {
		const fetch = mockFetch(() => undefined);
		const lines = await runNotify({ topic: undefined, dir, now: NOW });
		expect(lines).toEqual(['ntfy: sin tema configurado (NTFY_TOPIC), no se envía nada']);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('envía con las cabeceras de ntfy; un 429 se descarta sin romper; el tema no sale en registros ni en el JSON', async () => {
		const calls: { url: string; init?: RequestInit }[] = [];
		mockFetch((url, init) => {
			if (url.endsWith('/data/notify-log.json')) return published(empty());
			if (url.startsWith('https://ntfy.sh/')) {
				calls.push({ url, init });
				// ntfy devuelve el tema en la respuesta: no debe acabar en ningún sitio.
				return calls.length === 1
					? Response.json({ topic: TOPIC }, { status: 200 })
					: new Response(`{"error":"limit","topic":"${TOPIC}"}`, { status: 429 });
			}
		});
		const lines = await runNotify({ topic: TOPIC, dir, now: NOW });
		expect(calls).toHaveLength(2);
		expect(calls[0].url).toBe(`https://ntfy.sh/${TOPIC}`);
		const headers = calls[0].init?.headers as Record<string, string>;
		expect(headers.Priority).toBe('high');
		expect(headers.Tags).toBe('warning');
		expect(headers.Click).toBe('https://srgicmps.github.io/arc-terminal/geo');
		expect(lines).toEqual(['ntfy · quake:b: enviado (200)', 'ntfy · quake:a: 429, se descarta']);
		const json = await written();
		expect(JSON.parse(json).data.entries).toEqual([
			{ k: 'quake:b', t: '2026-10-14T10:00Z', s: 'sent' },
			{ k: 'quake:a', t: '2026-10-14T10:00Z', s: 'failed' }
		]);
		for (const text of [...logged, ...lines, json]) expect(text).not.toContain(TOPIC);
	});

	it('un error de red con la URL en el mensaje se registra saneado', async () => {
		mockFetch((url) => {
			if (url.endsWith('/data/notify-log.json')) return published(empty());
			throw new Error(`connect ECONNREFUSED ${url}?auth=x`);
		});
		const lines = await runNotify({ topic: TOPIC, dir, now: NOW });
		expect(lines.some((l) => l.includes('sin respuesta') && l.includes('se descarta'))).toBe(true);
		for (const text of [...logged, await written()]) expect(text).not.toContain(TOPIC);
	});

	it('sin historial publicado no envía nada y apunta lo de ahora como visto', async () => {
		const fetch = mockFetch(() => undefined);
		await runNotify({ topic: TOPIC, dir, now: NOW });
		expect(fetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('ntfy.sh'))).toEqual([]);
		const json = await written();
		expect(JSON.parse(json).data.entries.map((e: { s: string }) => e.s)).toEqual(['baseline', 'baseline']);
		expect(json).not.toContain(TOPIC);
	});

	it('de noche no envía y no apunta nada', async () => {
		const night = Date.parse('2026-10-14T23:00:00Z'); // 01:00 CEST
		await writeFile(
			join(dir, 'quakes.json'),
			JSON.stringify({ name: 'quakes', fetchedAt: '', data: [quake('a', 7.2, 1, night)] })
		);
		const fetch = mockFetch((url) => (url.endsWith('/data/notify-log.json') ? published(empty()) : undefined));
		const lines = await runNotify({ topic: TOPIC, dir, now: night });
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(lines).toEqual(['ntfy: 1 avisos esperan (franja de 23:00 a 8:00)']);
		expect(JSON.parse(await written()).data.entries).toEqual([]);
	});
});
