// Predicciones en el navegador: las apuestas van a /api/forecasts (D1) si hay cuenta (arcterminal.dev); si no
// (GitHub Pages, en local o sin conexión), se juega solo, con las apuestas en este navegador (`arc-forecasts`).
import { asset } from '$app/paths';
import { closesOf, type Bet, type ForecastData, type Round } from './forecasts.ts';

const API = () => asset('api/forecasts' as Parameters<typeof asset>[0]);
export const LOCAL_KEY = 'arc-forecasts';

export const game = $state({
	phase: 'loading' as 'loading' | 'ready' | 'error',
	/** cuenta: apuestas en D1 con clasificación · local: solo en este navegador. */
	mode: 'local' as 'cuenta' | 'local',
	rounds: [] as Round[],
	me: { uid: 'local', alias: null as string | null },
	bets: [] as Bet[],
	message: ''
});

function readLocal(): Bet[] {
	try {
		const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, unknown>;
		return Object.entries(raw).flatMap(([round, value]) =>
			closesOf(round) !== null && typeof value === 'number' && Number.isFinite(value) ? [{ uid: 'local', alias: null, round, value }] : []
		);
	} catch {
		return [];
	}
}

function writeLocal() {
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(game.bets.filter((b) => b.uid === 'local').map((b) => [b.round, b.value]))));
	} catch {}
}

export async function loadGame() {
	try {
		const r = await fetch(asset('data/forecasts.json' as Parameters<typeof asset>[0]));
		game.rounds = r.ok ? (((await r.json()) as { data?: ForecastData }).data?.rounds ?? []) : [];
	} catch {
		game.rounds = [];
	}
	// Con cuenta solo donde hay API (la ruta sin base: Cloudflare).
	if (new URL(API(), location.href).pathname === '/api/forecasts') {
		try {
			const res = await fetch(API(), { cache: 'no-store', redirect: 'manual' });
			if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
				const body = (await res.json()) as { me: { uid: string; alias: string | null }; bets: Bet[] };
				Object.assign(game, { mode: 'cuenta', me: body.me, bets: body.bets, phase: 'ready' });
				return;
			}
		} catch {}
	}
	Object.assign(game, { mode: 'local', me: { uid: 'local', alias: null }, bets: readLocal(), phase: 'ready' });
}

async function send(method: 'PUT' | 'DELETE', body?: unknown, query = '') {
	const res = await fetch(API() + query, {
		method,
		headers: body ? { 'content-type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined,
		redirect: 'manual'
	});
	if (!res.ok) throw new Error(String(res.status));
	return res.json();
}

export async function placeBet(round: string, value: number) {
	game.message = '';
	const mine = { uid: game.me.uid, alias: game.me.alias, round, value: Math.round(value * 100) / 100 };
	try {
		if (game.mode === 'cuenta') await send('PUT', { round, value: mine.value });
		game.bets = [...game.bets.filter((b) => !(b.uid === game.me.uid && b.round === round)), mine];
		if (game.mode === 'local') writeLocal();
	} catch (e) {
		game.message = String(e).includes('409') ? 'Esa ronda ya ha cerrado.' : 'No se ha podido guardar. Prueba otra vez.';
	}
}

export async function removeBet(round: string) {
	try {
		if (game.mode === 'cuenta') await send('DELETE', undefined, `?round=${encodeURIComponent(round)}`);
		game.bets = game.bets.filter((b) => !(b.uid === game.me.uid && b.round === round));
		if (game.mode === 'local') writeLocal();
	} catch {
		game.message = 'No se ha podido quitar. Prueba otra vez.';
	}
}

export async function setAlias(alias: string) {
	game.message = '';
	try {
		const body = (await send('PUT', { alias })) as { me: { uid: string; alias: string | null } };
		game.me = body.me;
		game.bets = game.bets.map((b) => (b.uid === body.me.uid ? { ...b, alias: body.me.alias } : b));
	} catch {
		game.message = 'Apodo no válido: de 2 a 20 letras, números, espacios, puntos o guiones.';
	}
}
