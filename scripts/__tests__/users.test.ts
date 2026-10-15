import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GROUPS, OWNER_ONLY, parseConfig } from '../../src/lib/alertconfig.ts';
import { emptyLog, RULES, type Alert, type NotifyLog, type Rule } from '../alerts/rules.ts';
import { parseUsers, runUsers, type Engine, type RemoteUser } from '../alerts/users.ts';
import { baselineLog, HELLO, pickAlerts, runNotify, trim } from '../notify.ts';
import { minute } from '../history.ts';
import { mockFetch } from './mock.ts';

const NOW = Date.parse('2026-10-14T10:00:00Z'); // 12:00 en Madrid
const T_ANA = `arc-${'a'.repeat(32)}`;
const T_LUIS = `arc-${'b'.repeat(32)}`;
const user = (uid: string, topic: string, config: object): RemoteUser => ({
	uid,
	topic,
	config: parseConfig({ on: true, ...config })
});

/** Reglas de prueba: cada pasada saca avisos nuevos (el id lleva la hora). */
const rule = (type: string, level: 1 | 2 | 3 | 4, n = 1): Rule => ({
	type,
	level,
	run: (_d, { now }) =>
		Array.from({ length: n }, (_, i) => ({
			id: `${type}:${now}:${i}`,
			title: type,
			body: '',
			tags: '',
			click: '',
			time: now
		}))
});
const TEST_RULES = [rule('quake', 1), rule('ai', 2), rule('stock', 2, 5), rule('earnings', 3)];

function engine() {
	const sent: { topic: string; id: string }[] = [];
	const e: Engine = {
		pickAlerts,
		baselineLog,
		trim,
		hello: HELLO,
		minute,
		post: async (topic: string, alert: Alert) => {
			sent.push({ topic, id: alert.id });
			return { status: 200 };
		}
	};
	return { e, sent };
}

/** Dos pasadas: la primera da lo de ahora por visto (y el aviso de prueba); la segunda, lo nuevo. */
async function twoPasses(users: RemoteUser[], second = NOW + 15 * 60_000) {
	const { e, sent } = engine();
	const logs = await runUsers(users, {}, new Set(), {}, NOW, e, () => {}, TEST_RULES);
	const firsts = sent.splice(0);
	const after = await runUsers(users, {}, new Set(), logs, second, e, () => {}, TEST_RULES);
	return { firsts, sent, logs: after };
}

describe('runUsers', () => {
	it('cada usuario recibe solo lo suyo, y por su tema', async () => {
		const users = [
			user('a'.repeat(16), T_ANA, { groups: ['desastres'] }),
			user('b'.repeat(16), T_LUIS, { groups: ['tech'] })
		];
		const { firsts, sent } = await twoPasses(users);
		// Primera pasada: solo el aviso de prueba, uno a cada uno.
		expect(firsts.map((s) => [s.topic, s.id])).toEqual([
			[T_ANA, 'hello'],
			[T_LUIS, 'hello']
		]);
		expect(sent.filter((s) => s.topic === T_ANA).map((s) => s.id.split(':')[0])).toEqual(['quake']);
		expect(sent.filter((s) => s.topic === T_LUIS).map((s) => s.id.split(':')[0])).toEqual(['ai']);
	});

	it('respeta su tope diario y su nivel', async () => {
		// Al día siguiente (el aviso de prueba de hoy también cuenta en el tope).
		const { sent } = await twoPasses(
			[user('c'.repeat(16), T_ANA, { groups: ['mercados'], daily: 2, level: 2 })],
			NOW + 86_400_000
		);
		expect(sent.map((s) => s.id.split(':')[0])).toEqual(['stock', 'stock']);
	});

	it('en su silencio solo llegan los P1', async () => {
		const quiet = { from: '11:00', until: '13:00' };
		const { sent } = await twoPasses([user('d'.repeat(16), T_ANA, { groups: ['desastres', 'tech'], quiet })]);
		expect(sent.map((s) => s.id.split(':')[0])).toEqual(['quake']);
	});

	it('quien ya no está, pierde su historial', async () => {
		const { e } = engine();
		const logs: Record<string, NotifyLog> = { ['e'.repeat(16)]: emptyLog() };
		expect(await runUsers([], {}, new Set(), logs, NOW, e, () => {}, TEST_RULES)).toEqual({});
	});
});

describe('parseUsers', () => {
	it('descarta uids o temas raros y los que tienen los avisos apagados', () => {
		const ok = { uid: 'f'.repeat(16), topic: T_ANA, config: { on: true } };
		expect(
			parseUsers({ users: [ok, { ...ok, uid: 'x' }, { ...ok, topic: 'corto' }, { ...ok, config: { on: false } }] })
		).toHaveLength(1);
		expect(parseUsers(null)).toEqual([]);
	});
});

it('todas las reglas fijas están en algún grupo de AVISOS (o son solo de Sergi)', () => {
	const known = GROUPS.flatMap((g) => g.types as readonly string[]);
	expect(RULES.map((r) => r.type).filter((t) => !known.includes(t) && !OWNER_ONLY.includes(t))).toEqual([]);
});

describe('runNotify con usuarios', () => {
	let dir: string;
	let logged: string[];
	const quake = (id: string, minutesAgo: number) => ({
		id,
		mag: 7.4,
		place: 'Lugar de prueba',
		time: new Date(NOW - minutesAgo * 60_000).toISOString(),
		url: '',
		tsunami: false,
		alert: null,
		lat: 0,
		lon: 0,
		depth: 10
	});

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'notify-users-'));
		logged = [];
		vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
		vi.stubEnv('CF_ACCESS_CLIENT_ID', 'id.access');
		vi.stubEnv('CF_ACCESS_CLIENT_SECRET', 'secreto');
	});
	afterEach(async () => {
		vi.unstubAllEnvs();
		await rm(dir, { recursive: true, force: true });
	});

	it('reparte por usuario; los temas no salen en registros ni en archivos publicados', async () => {
		const users = [
			{ uid: '1'.repeat(16), topic: T_ANA, config: { on: true, groups: ['desastres'] } },
			{ uid: '2'.repeat(16), topic: T_LUIS, config: { on: true, groups: ['mercados'] } }
		];
		const calls: string[] = [];
		mockFetch((url, init) => {
			if (url.endsWith('/api/alerts?all=1')) {
				expect((init?.headers as Record<string, string>)['CF-Access-Client-Id']).toBe('id.access');
				return { users };
			}
			if (url.endsWith('/data/notify-log.json')) return { name: 'notify-log', fetchedAt: '', data: emptyLog() };
			if (url.startsWith('https://ntfy.sh/')) {
				calls.push(url);
				return Response.json({ topic: url.slice(16) });
			}
		});
		const data = join(dir, 'data');
		const cache = join(dir, 'cache', 'notify-log.json');
		await mkdir(data);
		await writeFile(
			join(data, 'quakes.json'),
			JSON.stringify({ name: 'quakes', fetchedAt: '', data: [quake('a', 30)] })
		);
		const lines1 = await runNotify({ topic: 'arc-sergi-secreto', dir: data, cache, now: NOW });
		// Primera vez de cada usuario: solo su aviso de prueba.
		expect(calls.filter((u) => u.endsWith(T_ANA) || u.endsWith(T_LUIS))).toHaveLength(2);
		await writeFile(
			join(data, 'quakes.json'),
			JSON.stringify({ name: 'quakes', fetchedAt: '', data: [quake('a', 45), quake('b', 5)] })
		);
		calls.length = 0;
		const lines2 = await runNotify({ topic: 'arc-sergi-secreto', dir: data, cache, now: NOW + 15 * 60_000 });
		// El terremoto nuevo: a Sergi y a Ana (desastres); a Luis (mercados), no.
		expect(calls.filter((u) => u.endsWith(T_ANA))).toHaveLength(1);
		expect(calls.filter((u) => u.endsWith(T_LUIS))).toHaveLength(0);
		const files = [
			...(await readdir(data)).map((f) => join(data, f)),
			...(await readdir(join(dir, 'cache'))).map((f) => join(dir, 'cache', f))
		];
		expect(await readdir(data)).not.toContain('notify-users.json');
		const texts = [...logged, ...lines1, ...lines2, ...(await Promise.all(files.map((f) => readFile(f, 'utf8'))))];
		for (const t of texts) {
			expect(t).not.toContain(T_ANA);
			expect(t).not.toContain(T_LUIS);
			expect(t).not.toContain('arc-sergi-secreto');
		}
	});
});

describe('alertas de precio por usuario (F14)', () => {
	const nvda = { id: 'aaaa0001', asset: 'NVDA', name: 'NVDA', unit: '$', op: '>', value: 150 };
	it('la cuenta del administrador llega aunque no tenga avisos (sin tema) y no recibe nada aquí', async () => {
		const users = parseUsers({ users: [{ uid: '1'.repeat(16), topic: null, admin: true, config: { on: false, prices: [nvda] } }] });
		expect(users).toMatchObject([{ admin: true, topic: null }]);
		const { e, sent } = engine();
		await runUsers(users, {}, new Set(), {}, NOW, e, () => {}, TEST_RULES);
		expect(sent).toEqual([]);
	});
	it('a cada usuario le salta la suya, por su tema y una sola vez', async () => {
		const ana = user('a'.repeat(16), T_ANA, { groups: [], prices: [nvda] });
		const luis = user('b'.repeat(16), T_LUIS, { groups: [] });
		const d = { alertQuotes: [{ symbol: 'NVDA', price: 151, changePct: 1 }] };
		const { e, sent } = engine();
		const first = await runUsers([ana, luis], {}, new Set(), {}, NOW, e, () => {}, TEST_RULES);
		sent.splice(0);
		const logs = await runUsers([ana, luis], d as never, new Set(), first, NOW + 900_000, e, () => {}, TEST_RULES);
		expect(sent).toEqual([{ topic: T_ANA, id: 'user-alert:aaaa0001' }]);
		await runUsers([ana, luis], d as never, new Set(), logs, NOW + 1_800_000, e, () => {}, TEST_RULES);
		expect(sent).toHaveLength(1);
	});
});

describe('publicLog (F14)', () => {
	it('no publica las alertas ni las palabras de la cuenta de Sergi', async () => {
		const { publicLog } = await import('../notify.ts');
		const log = { ...emptyLog(), entries: [{ k: 'user-alert:aaaa0001', t: 'x', s: 'sent' as const }, { k: 'quake:1', t: 'x', s: 'sent' as const }], last: { 'vigila:palabras': '["aranceles"]', 'rate:fed': '4' } };
		const out = publicLog(log);
		expect(out.entries.map((e) => e.k)).toEqual(['quake:1']);
		expect(Object.keys(out.last)).toEqual(['rate:fed']);
	});
});
