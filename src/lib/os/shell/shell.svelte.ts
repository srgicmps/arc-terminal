// Estado de la shell de Arc OS en el navegador: ancladas, recientes, widgets, posición de la barra, fondo y el
// centro de notificaciones. Se guarda en localStorage (claves arc-os-*, documentadas en prefs.ts y, por ser
// ajustes, sincronizadas con la cuenta). Como un store de Pinia: un objeto reactivo y unas funciones.
import { asset } from '$app/paths';
import type { WallData } from '../../exp/muro.ts';
import type { ChangesData } from '../../types.ts';
import { buildNotices, markSeen, toastsFor, unread, type Notice } from './notices.ts';
import { parseIds, pushRecent, togglePin } from './start.ts';
import { parseWidgets, type Placed } from './widgets.ts';

export const KEYS = {
	pinned: 'arc-os-pinned',
	recent: 'arc-os-recent',
	widgets: 'arc-os-widgets',
	bar: 'arc-os-bar',
	seen: 'arc-os-seen',
	wallpaper: 'arc-os-wallpaper'
} as const;

/** Fondos del escritorio: «estilo» sigue la estética activa; los demás, sobre sus colores. */
export const WALLPAPERS = [
	{ id: 'estilo', label: 'El de la estética' },
	{ id: 'liso', label: 'Liso' },
	{ id: 'rejilla', label: 'Rejilla' },
	{ id: 'degradado', label: 'Degradado' },
	// De «OS 5» (src/lib/os/system/): el vivo es el globo con los terremotos; los demás, solo CSS en Desktop.svelte.
	{ id: 'globo', label: 'Vivo: el globo' },
	{ id: 'aurora', label: 'Aurora' },
	{ id: 'puntos', label: 'Puntos' },
	{ id: 'horizonte', label: 'Horizonte' }
] as const;
export type Wallpaper = (typeof WALLPAPERS)[number]['id'];

const read = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};
const write = (k: string, v: string) => {
	try {
		localStorage.setItem(k, v);
	} catch {}
};

export const shell = $state({
	ready: false,
	pinned: [] as string[],
	recent: [] as string[],
	/** null: los de por defecto (aún no se ha tocado nada). */
	widgets: null as Placed[] | null,
	bar: 'bottom' as 'bottom' | 'top',
	wallpaper: 'estilo' as Wallpaper,
	seen: [] as string[],
	notices: [] as Notice[],
	toasts: [] as Notice[],
	/** Qué está desplegado: solo uno a la vez. */
	open: null as null | 'start' | 'notices' | 'clock' | 'control'
});

/** Lee lo guardado. Se llama una vez, al montar la shell en el navegador. */
export function loadShell(defaultPinned: string[]) {
	const pinned = read(KEYS.pinned);
	shell.pinned = pinned === null ? defaultPinned : parseIds(pinned);
	shell.recent = parseIds(read(KEYS.recent));
	shell.widgets = parseWidgets(read(KEYS.widgets));
	shell.bar = read(KEYS.bar) === 'top' ? 'top' : 'bottom';
	const wp = read(KEYS.wallpaper);
	shell.wallpaper = WALLPAPERS.some((w) => w.id === wp) ? (wp as Wallpaper) : 'estilo';
	shell.seen = parseIds(read(KEYS.seen));
	shell.ready = true;
}

export function opened(id: string) {
	shell.recent = pushRecent(shell.recent, id);
	write(KEYS.recent, JSON.stringify(shell.recent));
}
export function pin(id: string) {
	shell.pinned = togglePin(shell.pinned, id);
	write(KEYS.pinned, JSON.stringify(shell.pinned));
}
export function setWidgets(list: Placed[]) {
	shell.widgets = list;
	write(KEYS.widgets, JSON.stringify(list));
}
export function setBar(pos: 'bottom' | 'top') {
	shell.bar = pos;
	write(KEYS.bar, pos);
}
export function setWallpaper(id: Wallpaper) {
	shell.wallpaper = id;
	write(KEYS.wallpaper, id);
}
export function toggle(what: NonNullable<typeof shell.open>) {
	shell.open = shell.open === what ? null : what;
}

export const unreadCount = () => unread(shell.notices, shell.seen).length;

export function markAllSeen() {
	shell.seen = markSeen(
		shell.seen,
		shell.notices.map((n) => n.id)
	);
	write(KEYS.seen, JSON.stringify(shell.seen));
}
export function dismissToast(id: string) {
	shell.toasts = shell.toasts.filter((t) => t.id !== id);
}

async function getJson<T>(name: string): Promise<T | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		if (!r.ok) return null;
		return ((await r.json()) as { data: T }).data ?? null;
	} catch {
		return null;
	}
}

let known: Set<string> | null = null;

/** Pide los avisos y novedades; los avisos nuevos desde la última vuelta salen como toast. */
export async function refreshNotices() {
	const [wall, changes] = await Promise.all([getJson<WallData>('muro'), getJson<ChangesData>('changes')]);
	const list = buildNotices(wall, changes);
	const fresh = toastsFor(list, known ?? new Set(), known === null);
	known = new Set(list.map((n) => n.id));
	shell.notices = list;
	if (fresh.length) shell.toasts = [...shell.toasts, ...fresh.filter((f) => !shell.seen.includes(f.id))].slice(-3);
}

/** Cada 2 minutos, como el Muro. Devuelve la función para pararlo. */
export function startNotices() {
	refreshNotices();
	const id = setInterval(refreshNotices, 120_000);
	return () => clearInterval(id);
}
