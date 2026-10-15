// Favoritos de la barra (lote 27-A): «fav ECO TIPOS» guarda la entrada y «1», «2», «3»… la abren.
// «fav» a secas los enseña y «fav -2» quita el segundo. Lógica pura; se guardan en este navegador.
import type { Option } from '../cmdline.ts';

export const FAVS_KEY = 'arc-cmd-favs';
export const FAVS_MAX = 9;

/** Lo que pide la barra con «fav …», o un número que abre un favorito. */
export type FavAction =
	| { kind: 'list' }
	| { kind: 'add'; entry: string }
	| { kind: 'remove'; n: number }
	| { kind: 'open'; n: number };

/** «fav ECO TIPOS» → add · «fav -2» / «unfav 2» → remove · «fav» → list · «2» → open. Si no, null. */
export function parseFav(raw: string): FavAction | null {
	const text = raw.trim();
	if (/^[1-9]$/.test(text)) return { kind: 'open', n: Number(text) };
	const m = text.match(/^(fav|favs|favorito|favoritos|unfav)(?:\s+(.*))?$/i);
	if (!m) return null;
	const rest = (m[2] ?? '').trim();
	const unfav = m[1].toLowerCase() === 'unfav';
	const num = rest.match(/^-?\s*([1-9])$/);
	if (unfav) return num ? { kind: 'remove', n: Number(num[1]) } : null;
	if (!rest) return { kind: 'list' };
	if (rest.startsWith('-') && num) return { kind: 'remove', n: Number(num[1]) };
	return { kind: 'add', entry: rest };
}

/** Añade al final (sin repetir y como mucho 9). Devuelve la lista y el número que le toca. */
export function addFav(list: string[], entry: string): { list: string[]; n: number } {
	const e = entry.trim();
	const i = list.findIndex((x) => x.toUpperCase() === e.toUpperCase());
	if (i >= 0) return { list, n: i + 1 };
	if (!e || list.length >= FAVS_MAX) return { list, n: 0 };
	const next = [...list, e];
	return { list: next, n: next.length };
}

export const removeFav = (list: string[], n: number) => list.filter((_, i) => i !== n - 1);

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | undefined => globalThis.localStorage;

export function readFavs(store: () => Store | undefined = browserStore): string[] {
	try {
		const saved: unknown = JSON.parse(store()?.getItem(FAVS_KEY) ?? '[]');
		if (!Array.isArray(saved)) return [];
		return saved.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, FAVS_MAX);
	} catch {
		return [];
	}
}

export function writeFavs(list: string[], store: () => Store | undefined = browserStore): void {
	try {
		store()?.setItem(FAVS_KEY, JSON.stringify(list.slice(0, FAVS_MAX)));
	} catch {}
}

/** Las sugerencias de «fav …» o de un número: qué se guardaría, qué se quitaría o qué se abriría. */
export function favOptions(raw: string, favs: string[]): Option[] | null {
	const a = parseFav(raw);
	if (!a) return null;
	const kind = 'Favorito';
	if (a.kind === 'open') {
		const entry = favs[a.n - 1];
		return entry ? [{ code: String(a.n), desc: entry, kind, run: entry }] : null;
	}
	if (a.kind === 'list') {
		if (!favs.length) return [{ code: 'FAV', desc: 'Sin favoritos: «fav ECO TIPOS» guarda uno y «1» lo abre', kind, run: raw.trim() }];
		return favs.map((entry, i) => ({ code: String(i + 1), desc: entry, kind, run: entry }));
	}
	if (a.kind === 'remove') {
		const entry = favs[a.n - 1];
		return [{ code: `FAV -${a.n}`, desc: entry ? `Quitar ${entry} de favoritos` : `No hay favorito ${a.n}`, kind, run: raw.trim() }];
	}
	const known = favs.findIndex((x) => x.toUpperCase() === a.entry.toUpperCase());
	const desc =
		known >= 0
			? `Ya es el favorito ${known + 1}`
			: favs.length >= FAVS_MAX
				? `Ya tienes ${FAVS_MAX} favoritos: quita uno con «fav -1»`
				: `Guardar «${a.entry}» como favorito ${favs.length + 1}`;
	return [{ code: 'FAV', desc, kind, run: raw.trim() }];
}
