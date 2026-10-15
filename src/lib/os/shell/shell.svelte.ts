// Estado de la shell de Arc OS en el navegador: ancladas, recientes, widgets, posición de la barra, fondo y el
// centro de notificaciones. Se guarda en localStorage (claves arc-os-*, documentadas en prefs.ts y, por ser
// ajustes, sincronizadas con la cuenta). Como un store de Pinia: un objeto reactivo y unas funciones.
import { asset } from '$app/paths';
import type { WallData } from '../../exp/muro.ts';
import type { ChangesData } from '../../types.ts';
import { addNotice, buildNotices, markSeen, noticeTime, toastsFor, unread, type Notice } from './notices.ts';
import { parseIds, pushRecent, togglePin } from './start.ts';
import { parseSpots, type Spots } from './icons.ts';
import { DEFAULT_SKIN, type Skin } from './skins.ts';
import { parseWidgets, type Placed } from './widgets.ts';

export const KEYS = {
	pinned: 'arc-os-pinned',
	recent: 'arc-os-recent',
	widgets: 'arc-os-widgets',
	bar: 'arc-os-bar',
	seen: 'arc-os-seen',
	wallpaper: 'arc-os-wallpaper',
	skin: 'arc-os-skin',
	name: 'arc-os-name',
	icons: 'arc-os-icons'
} as const;

/** Fondos del escritorio, siempre con los colores del aspecto (dentro de /os no se aplican las estéticas de la web). */
export const WALLPAPERS = [
	{ id: 'sistema', label: 'El de Arc OS' },
	{ id: 'liso', label: 'Liso' },
	{ id: 'rejilla', label: 'Rejilla' },
	{ id: 'degradado', label: 'Degradado' },
	// De «OS 5»: los pinta src/lib/os/system/wall/WallLayer.svelte (lista completa en wall.ts → PRESETS).
	{ id: 'aurora', label: 'Aurora' },
	{ id: 'horizonte', label: 'Horizonte' },
	{ id: 'duna', label: 'Duna' },
	{ id: 'puntos', label: 'Puntos' },
	{ id: 'globo', label: 'Vivo: el mundo ahora' },
	{ id: 'cielo', label: 'Vivo: tu cielo' }
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
	wallpaper: 'sistema' as Wallpaper,
	/** Aspecto: uno solo y fijo (cambio de Sergi); el código de los demás queda, sin interfaz. */
	skin: DEFAULT_SKIN as Skin,
	/** Si ya ha pasado el asistente del primer arranque (se apunta guardando arc-os-skin). */
	skinChosen: true,
	/** Cómo quiere que le llame Arc OS (asistente y Panel de control); vacío si no lo ha dicho. */
	name: '',
	seen: [] as string[],
	notices: [] as Notice[],
	toasts: [] as Notice[],
	/** Casilla de cada icono del escritorio (los que no tienen, van a la primera libre). */
	icons: {} as Spots,
	/** Widgets ocultos (botón ◫ de DSM); solo en esta visita. */
	widgetsHidden: false,
	/** Qué está desplegado: solo uno a la vez. */
	open: null as null | 'start' | 'notices' | 'clock' | 'control' | 'spotlight' | 'launchpad' | 'activities' | 'menu'
});

/** Lee lo guardado. Se llama una vez, al montar la shell en el navegador. */
export function loadShell(defaultPinned: string[]) {
	const pinned = read(KEYS.pinned);
	shell.pinned = pinned === null ? defaultPinned : parseIds(pinned);
	shell.recent = parseIds(read(KEYS.recent));
	shell.widgets = parseWidgets(read(KEYS.widgets));
	shell.bar = read(KEYS.bar) === 'top' ? 'top' : 'bottom';
	const wp = read(KEYS.wallpaper);
	shell.wallpaper = WALLPAPERS.some((w) => w.id === wp) ? (wp as Wallpaper) : 'sistema';
	const skin = read(KEYS.skin);
	shell.skin = DEFAULT_SKIN;
	shell.skinChosen = skin !== null;
	// Quien eligió otro aspecto cuando se podía vuelve al único (src/app.html lo lee antes de pintar).
	if (skin !== null && skin !== DEFAULT_SKIN) write(KEYS.skin, DEFAULT_SKIN);
	shell.name = cleanName(read(KEYS.name) ?? '');
	shell.seen = parseIds(read(KEYS.seen));
	shell.icons = parseSpots(read(KEYS.icons));
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
export function setIcons(spots: Spots) {
	shell.icons = spots;
	write(KEYS.icons, JSON.stringify(spots));
}
export function setBar(pos: 'bottom' | 'top') {
	shell.bar = pos;
	write(KEYS.bar, pos);
}
export function setWallpaper(id: Wallpaper) {
	shell.wallpaper = id;
	write(KEYS.wallpaper, id);
}
export function setSkin(skin: Skin) {
	shell.skin = skin;
	shell.skinChosen = true;
	write(KEYS.skin, skin);
}
/** Nombre limpio: una línea, sin espacios de más, 40 letras como mucho. */
export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 40);

export function setName(name: string) {
	shell.name = cleanName(name);
	write(KEYS.name, shell.name);
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

/** Avisos de la propia web (del sistema, de una app…): los que no vienen de muro.json ni changes.json. */
let local: Notice[] = [];
let seq = 0;

/**
 * Para otras piezas de Arc OS (sistema, apps): un aviso que queda en el centro de notificaciones y sale como
 * toast. Devuelve su id.
 */
export function notify(n: { title: string; detail?: string; href?: string; kind?: Notice['kind']; time?: string }): string {
	// La hora del suceso, si la trae (un aviso de hace 10 min no es «ahora»); el contador evita ids repetidos.
	const time = noticeTime(n.time, new Date());
	const notice: Notice = { id: `s:${++seq}:${time}:${n.title}`, kind: n.kind ?? 'aviso', title: n.title, detail: n.detail ?? '', time, href: n.href };
	local = [notice, ...local].slice(0, 30);
	shell.notices = addNotice(shell.notices, notice);
	shell.toasts = [...shell.toasts, notice].slice(-3);
	return notice.id;
}

let known: Set<string> | null = null;

/** Pide los avisos y novedades; los avisos nuevos desde la última vuelta salen como toast. */
export async function refreshNotices() {
	const [wall, changes] = await Promise.all([getJson<WallData>('muro'), getJson<ChangesData>('changes')]);
	const list = buildNotices(wall, changes);
	const fresh = toastsFor(list, known ?? new Set(), known === null);
	known = new Set(list.map((n) => n.id));
	shell.notices = [...local, ...list].sort((a, b) => b.time.localeCompare(a.time));
	if (fresh.length) shell.toasts = [...shell.toasts, ...fresh.filter((f) => !shell.seen.includes(f.id))].slice(-3);
}

/** Cada 2 minutos, como el Muro. Devuelve la función para pararlo. */
export function startNotices() {
	refreshNotices();
	const id = setInterval(refreshNotices, 120_000);
	return () => clearInterval(id);
}
