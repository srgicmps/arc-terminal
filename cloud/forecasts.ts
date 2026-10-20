// La API del juego de predicciones: /api/forecasts (experiencia 8, vista /x/predicciones).
// Cada persona (JWT de Access) guarda su apodo y sus apuestas. Nadie ve emails: cada jugador sale con un id
// aleatorio (uid) y su apodo. Las apuestas de los demás solo se ven cuando la ronda ya ha cerrado (así nadie
// copia), y no se puede apostar ni cambiar una apuesta después del cierre, que va dentro del id de la ronda.
// Las rondas y los puntos no están aquí: salen de static/data/forecasts.json (src/lib/exp/forecasts.ts).
// - GET: { me: { uid, alias }, bets: [{ uid, alias, round, value }] }
// - PUT { alias } · PUT { round, value } · DELETE ?round=<id>
import { closesOf } from '../src/lib/exp/forecasts.ts';
import { person } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';

export const MAX_BETS = 400;
const ALIAS = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,19}$/u;

export interface Player {
	uid: string;
	alias: string | null;
}

export interface StoredBet {
	round: string;
	value: number;
}

export interface ForecastStore {
	player(user: string): Promise<Player | null>;
	setPlayer(user: string, p: Player): Promise<void>;
	bets(user: string): Promise<StoredBet[]>;
	setBet(user: string, bet: StoredBet): Promise<void>;
	removeBet(user: string, round: string): Promise<void>;
	/** Todas las apuestas de las rondas que cierran antes de `before` (ISO), con el jugador. */
	closedBets(before: string): Promise<(StoredBet & Player)[]>;
}

const hex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** El cierre de una ronda, en el mismo formato que el id («2026-10-30T08:00Z»), para comparar textos. */
const closeKey = (ms: number) => `${new Date(ms).toISOString().slice(0, 16)}Z`;

export async function handleForecasts(
	request: Request,
	env: Env,
	store: ForecastStore | null,
	fetcher?: (url: string) => Promise<Response>,
	now = Date.now()
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	// Sin configurar, desde otra web, sin identificar o un token de servicio: fuera (access.ts).
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;
	const user = who.email;

	const me = async () => {
		const p = await store.player(user);
		if (p) return p;
		const fresh = { uid: hex(8), alias: null };
		await store.setPlayer(user, fresh);
		return fresh;
	};

	if (request.method === 'GET') {
		const player = await me();
		const mine = (await store.bets(user)).map((b) => ({ ...b, ...player }));
		const others = (await store.closedBets(closeKey(now))).filter((b) => b.uid !== player.uid);
		return json(200, { me: player, bets: [...mine, ...others] });
	}

	if (request.method === 'PUT') {
		if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json(415, { error: 'solo JSON' });
		const text = await request.text();
		if (text.length > 1_000) return json(413, { error: 'demasiado grande' });
		let body: { alias?: unknown; round?: unknown; value?: unknown };
		try {
			body = JSON.parse(text);
		} catch {
			return json(400, { error: 'JSON no válido' });
		}
		const player = await me();
		if ('alias' in body) {
			const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
			if (alias && !ALIAS.test(alias)) return json(400, { error: 'apodo no válido' });
			await store.setPlayer(user, { uid: player.uid, alias: alias || null });
			return json(200, { me: { uid: player.uid, alias: alias || null } });
		}
		const round = typeof body.round === 'string' ? body.round : '';
		const closes = closesOf(round);
		const value = body.value;
		if (closes === null) return json(400, { error: 'ronda no válida' });
		if (closes <= now) return json(409, { error: 'ronda cerrada' });
		if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000) return json(400, { error: 'valor no válido' });
		const mine = await store.bets(user);
		if (!mine.some((b) => b.round === round) && mine.length >= MAX_BETS) return json(413, { error: 'demasiadas apuestas' });
		await store.setBet(user, { round, value: Math.round(value * 100) / 100 });
		return json(200, { ok: true });
	}

	if (request.method === 'DELETE') {
		const round = new URL(request.url).searchParams.get('round') ?? '';
		const closes = closesOf(round);
		if (closes === null) return json(400, { error: 'ronda no válida' });
		if (closes <= now) return json(409, { error: 'ronda cerrada' });
		await store.removeBet(user, round);
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

/** D1: jugadores y apuestas. Las tablas se crean solas la primera vez (cloud/schema.ts). */
export function d1ForecastStore(db: D1Database): ForecastStore {
	const ready = () => ensure(db, 'forecast_players', 'forecast_bets');
	return {
		async player(user) {
			await ready();
			const { results } = await db.prepare('SELECT uid, alias FROM forecast_players WHERE user = ?').bind(user).all<Player>();
			return results[0] ?? null;
		},
		async setPlayer(user, p) {
			await ready();
			await db
				.prepare('INSERT INTO forecast_players (user, uid, alias) VALUES (?, ?, ?) ON CONFLICT (user) DO UPDATE SET alias = excluded.alias')
				.bind(user, p.uid, p.alias)
				.run();
		},
		async bets(user) {
			await ready();
			const { results } = await db.prepare('SELECT round, value FROM forecast_bets WHERE user = ?').bind(user).all<StoredBet>();
			return results;
		},
		async setBet(user, bet) {
			await ready();
			await db
				.prepare(
					'INSERT INTO forecast_bets (user, round, closes, value, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user, round) DO UPDATE SET value = excluded.value, updated = excluded.updated'
				)
				.bind(user, bet.round, bet.round.split('@')[1], bet.value, Date.now())
				.run();
		},
		async removeBet(user, round) {
			await ready();
			await db.prepare('DELETE FROM forecast_bets WHERE user = ? AND round = ?').bind(user, round).run();
		},
		async closedBets(before) {
			await ready();
			const { results } = await db
				.prepare('SELECT b.round, b.value, p.uid, p.alias FROM forecast_bets b JOIN forecast_players p ON p.user = b.user WHERE b.closes < ?')
				.bind(before)
				.all<StoredBet & Player>();
			return results;
		}
	};
}

/** En memoria, para los tests. */
export function memoryForecastStore(): ForecastStore {
	const players = new Map<string, Player>();
	const bets = new Map<string, Map<string, number>>();
	return {
		player: async (user) => structuredClone(players.get(user) ?? null),
		setPlayer: async (user, p) => void players.set(user, { ...p }),
		bets: async (user) => [...(bets.get(user) ?? [])].map(([round, value]) => ({ round, value })),
		setBet: async (user, b) => void (bets.get(user) ?? bets.set(user, new Map()).get(user)!).set(b.round, b.value),
		removeBet: async (user, round) => void bets.get(user)?.delete(round),
		closedBets: async (before) =>
			[...bets].flatMap(([user, m]) =>
				[...m].filter(([round]) => round.split('@')[1] < before).map(([round, value]) => ({ round, value, ...players.get(user)! }))
			)
	};
}
