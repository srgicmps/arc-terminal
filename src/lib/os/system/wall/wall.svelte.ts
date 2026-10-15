// Estado de los fondos de Arc OS en el navegador (como un store de Pinia). La elección se guarda en
// localStorage «arc-os-wall» (ajuste, sincronizado con la cuenta: solo lleva ids, colores y opciones, nunca la
// imagen) y las imágenes propias, en IndexedDB (images.ts). Reglas puras en wall.ts.
import { desk } from '../../os.svelte.ts';
import { KEYS, setWallpaper } from '../../shell/shell.svelte.ts';
import { currentSource, defaultConfig, parseConfig, type WallConfig, type WallSource } from './wall.ts';

export const WALL_KEY = 'arc-os-wall';

export const wall = $state({
	ready: false,
	cfg: defaultConfig() as WallConfig,
	/** Hora (ms) que usa la presentación; se pone al día cada minuto. */
	now: Date.now()
});

const read = (k: string) => {
	try {
		return localStorage.getItem(k);
	} catch {
		return null;
	}
};

let timer: ReturnType<typeof setInterval> | undefined;

/** Lee lo guardado una vez y pone en marcha el reloj de la presentación. */
export function loadWall() {
	if (wall.ready) return;
	wall.cfg = parseConfig(read(WALL_KEY), read(KEYS.wallpaper));
	wall.ready = true;
	timer ??= setInterval(() => (wall.now = Date.now()), 60_000);
}

function save() {
	try {
		localStorage.setItem(WALL_KEY, JSON.stringify(wall.cfg));
	} catch {}
	// La shell sigue sabiendo el fondo incluido elegido (su CSS y su Panel de control lo usan).
	if (wall.cfg.main.kind === 'preset') setWallpaper(wall.cfg.main.id as Parameters<typeof setWallpaper>[0]);
}

/** El fondo que toca ahora en el escritorio que se ve. */
export const activeSource = (): WallSource => currentSource(wall.cfg, deskId(), wall.now);
const deskId = () => {
	try {
		return desk().id;
	} catch {
		return null;
	}
};

/** Pone un fondo: para todos los escritorios o solo para el que se ve (`onlyThis`). */
export function setSource(s: WallSource, onlyThis = false) {
	loadWall();
	const id = deskId();
	if (onlyThis && id) wall.cfg.desks = { ...wall.cfg.desks, [id]: s };
	else {
		wall.cfg.main = s;
		if (id && wall.cfg.desks[id]) {
			const { [id]: _drop, ...rest } = wall.cfg.desks;
			wall.cfg.desks = rest;
		}
	}
	save();
}

/** Quita el fondo propio del escritorio que se ve (vuelve al general). */
export function clearDesk() {
	const id = deskId();
	if (!id) return;
	const { [id]: _drop, ...rest } = wall.cfg.desks;
	wall.cfg.desks = rest;
	save();
}

export function setShow(patch: Partial<WallConfig['show']>) {
	wall.cfg.show = { ...wall.cfg.show, ...patch };
	save();
}

export function setLockSame(on: boolean) {
	wall.cfg.lock = on;
	save();
}

/** Tras borrar una imagen: los sitios que la usaban vuelven al fondo del aspecto. */
export function dropImage(img: string) {
	const ok = (s: WallSource) => !(s.kind === 'image' && s.img === img);
	const def = defaultConfig().main;
	wall.cfg.main = ok(wall.cfg.main) ? wall.cfg.main : def;
	wall.cfg.desks = Object.fromEntries(Object.entries(wall.cfg.desks).filter(([, s]) => ok(s)));
	wall.cfg.show = { ...wall.cfg.show, list: wall.cfg.show.list.filter(ok) };
	save();
}

export const deskHasOwn = () => {
	const id = deskId();
	return !!id && !!wall.cfg.desks[id];
};
