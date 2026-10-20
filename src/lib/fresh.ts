// Datos nuevos sin recargar (F04). La Action publica cada 5–15 min: casi siempre solo datos, a veces código.
// Una pestaña abierta pregunta cada minuto (y al volver a ella) a /code.json, que dice qué publicación hay:
// - Solo datos nuevos (mismo código): la vista se refresca en su sitio con refreshAll(), que vuelve a pedir su
//   __data.json; TradingView, el globo, el scroll y lo que estés tocando se quedan como estaban. Sola, solo si
//   estás arriba del todo (o en el modo TV): más abajo, lo nuevo empujaría lo que lees (muchas listas reutilizan
//   sus filas por posición y cambia el texto bajo el dedo), así que sale «Hay datos nuevos · Actualizar».
// - Código nuevo: el aviso «Recargar» de siempre, porque el código de la pestaña ya no casa con el publicado.
// El código del navegador no lleva el commit escrito (si lo llevara, cada commit cambiaría el nombre del archivo
// del layout y de app.js, ~26 KB gzip, y el service worker los volvería a bajar): la pestaña lo aprende de la
// primera respuesta de /code.json con su misma versión. Si la primera ya es de otra publicación, no se sabe si
// cambió el código, y sale «Recargar», como antes.
// Aquí va la lógica, sin Svelte ni DOM de verdad (se prueba en fresh.test.ts); el estado y la conexión con
// SvelteKit, en fresh.svelte.ts.

/** Lo que dice /code.json: la publicación (`v`, la `version` de SvelteKit, cambia en cada build) y el código (`code`, el commit). */
export interface Build {
	v: string;
	code: string;
}

/** Esta pestaña: su versión y su commit, si ya se sabe (null hasta la primera respuesta con su misma versión). */
export interface Mine {
	v: string;
	code: string | null;
}

/** Build sin commit conocido (`pnpm build` en local): no se distingue código de datos, así que todo cuenta como código. */
export const LOCAL = 'local';
/** La primera pregunta, poco después de abrir (para aprender el commit antes de que haya otra publicación). */
export const FIRST_MS = 5_000;
/** Cada cuánto se pregunta por una publicación nueva (como el sondeo de SvelteKit al que sustituye). */
export const POLL_MS = 60_000;
/** Un gesto (scroll, toque, rueda, tecla) sigue en marcha hasta este rato después de su último evento. */
export const GESTURE_MS = 2_000;
/** Con datos nuevos sin aplicar, cada cuánto se vuelve a mirar si ya se puede (sin red). */
export const RETRY_MS = 3_000;

/**
 * Qué hacer: 'nada'; 'datos', refrescar ya; 'aviso', hay datos nuevos pero estás leyendo más abajo o escribiendo
 * (sale «Actualizar»; se refresca al pulsar, al volver arriba o al dejar el campo); 'codigo', hay otra versión de
 * la web (sale «Recargar»).
 */
export type Step = 'nada' | 'datos' | 'aviso' | 'codigo';

export interface Situation {
	/** La publicación que se cargó en esta pestaña. */
	mine: Mine;
	/** La versión de los datos que enseña la vista ahora (al cargar, mine.v; después, la del último refresco). */
	seen: string;
	/** La última respuesta de /code.json (null si aún no hay o falló). */
	latest: Build | null;
	/** Milisegundos desde el último gesto (0 con un dedo en la pantalla). */
	idleMs: number;
	/** Se acaba de volver a la pestaña: no puede haber un gesto a medias. */
	resumed?: boolean;
	/** Vista que se refresca sola aunque estés escribiendo: el modo TV y TOP. */
	auto?: boolean;
	/** Hay un campo de texto con el foco (o el foco de teclado en la vista). */
	typing?: boolean;
	/** Estás leyendo más abajo: la página, o una lista con scroll propio, no está arriba del todo (nunca en TV). */
	away?: boolean;
}

/** Decide qué hacer con lo que dice /code.json. Nunca se mueve nada a mitad de un gesto: se espera a que acabe. */
export function decide(s: Situation): Step {
	const { mine, seen, latest } = s;
	if (!latest || latest.v === seen) return 'nada';
	// Otro commit, uno que no se sabe (null) o una build local: puede haber cambiado el código.
	if (latest.code !== mine.code || mine.code === LOCAL) return 'codigo';
	// Más abajo, lo que entra arriba movería lo que lees: aviso, también en TOP.
	if (s.away || (!s.auto && s.typing)) return 'aviso';
	return s.resumed || s.idleMs >= GESTURE_MS ? 'datos' : 'nada';
}

/** Lee /code.json sin caché. Si falla (sin red, sesión de Access caducada, respuesta rara), null: no se hace nada. */
export async function readBuild(get: typeof fetch, url: string): Promise<Build | null> {
	try {
		const res = await get(url, { cache: 'no-store', redirect: 'manual' });
		if (!res.ok) return null;
		const j = (await res.json()) as Partial<Build> | null;
		return typeof j?.v === 'string' && typeof j.code === 'string' ? { v: j.v, code: j.code } : null;
	} catch {
		return null;
	}
}

/** Tipos de <input> que no son para escribir: con el foco en ellos se puede refrescar. */
const NOT_TEXT = /^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/;

/** ¿Es un campo donde se escribe (o un desplegable)? Con el foco en uno, la vista no se refresca sola. */
export function isField(el: Element | null): boolean {
	if (!el) return false;
	if ((el as HTMLElement).isContentEditable) return true;
	if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
	return el.tagName === 'INPUT' && !NOT_TEXT.test((el as HTMLInputElement).type);
}

/**
 * ¿Hay algo con el foco que un refresco cambiaría bajo tus ojos? Un campo, o el foco de teclado (Tab, j/k) en una
 * fila o un enlace de la vista: la fila podría pasar a ser otro titular. Con ratón o dedo no cuenta, porque un clic
 * no activa :focus-visible. La vista entera (#contenido, tras «Saltar al contenido» o «Actualizar») tampoco.
 */
export function holdsFocus(el: Element | null): boolean {
	if (isField(el)) return true;
	if (!el?.parentElement?.closest('#contenido')) return false;
	try {
		return el.matches(':focus-visible');
	} catch {
		return false; // un navegador sin :focus-visible
	}
}

/**
 * Refresca sin mover lo que estás leyendo (al pulsar «Actualizar» a media página): apunta qué hay en el centro de
 * la pantalla y dónde está en la página; si al refrescar ha entrado contenido encima y lo ha empujado, devuelve la
 * página a su sitio. Chrome y Firefox ya lo hacen solos con los nodos que se mueven (scroll anchoring,
 * `overflow-anchor`); Safari no. Una lista que reutiliza sus filas por posición cambia de texto sin mover ningún
 * nodo: eso no lo arregla ninguno de los dos, y por eso la vista no se refresca sola a media página.
 * Si lo del centro va dentro de algo con scroll vertical propio (una lista larga de un panel), se toma ese bloque,
 * que se mueve con la página.
 * Se mide respecto a la página, no a la pantalla: si mientras llegan los datos deslizas, solo se compensa lo que
 * ha entrado encima, no tu scroll.
 */
export async function keepPlace(win: Window, run: () => Promise<unknown>): Promise<void> {
	const doc = win.document;
	const native = typeof CSS !== 'undefined' && CSS.supports?.('overflow-anchor', 'auto');
	let anchor = native || win.scrollY <= 0 ? null : doc.elementFromPoint(win.innerWidth / 2, win.innerHeight / 2);
	for (let e = anchor?.parentElement; e && e !== doc.body && e !== doc.documentElement; e = e.parentElement) {
		if (e.scrollHeight > e.clientHeight && /^(auto|scroll)$/.test(win.getComputedStyle(e).overflowY)) anchor = e;
	}
	const at = () => (anchor ? anchor.getBoundingClientRect().top + win.scrollY : 0);
	const before = anchor ? at() : undefined;
	await run();
	if (!anchor?.isConnected || before === undefined) return;
	const delta = at() - before;
	if (Math.abs(delta) >= 1) win.scrollBy(0, delta);
}

/**
 * Refresca con `run` (refreshAll) y falla si la vista ha acabado en la página de error o si no se ha aplicado
 * (applied): refreshAll no rechaza cuando el __data.json no llega (un 503 del borde, sin red), SvelteKit pinta
 * +error.svelte; ni cuando una navegación lo cancela. Así `watch` no da los datos por vistos y lo vuelve a intentar
 * pronto (a los RETRY_MS, cada vez más espaciado).
 */
export async function loadOrFail(run: () => Promise<unknown>, failed: () => boolean): Promise<void> {
	await run();
	if (failed()) throw new Error('No se han podido cargar los datos nuevos');
}

/**
 * ¿Se ha aplicado el refresco? SvelteKit crea otro objeto page.data cada vez que aplica uno (vuelve a leer el
 * __data.json). Si sigue el mismo, una navegación a medias lo ha cancelado sin error (también una «shallow»: una
 * pestaña o un selector que escribe en la URL con writeParams), y hay que volver a intentarlo. Una vista sin datos
 * (page.data vacío: MODO, ESTILO…) no tiene nada que refrescar, y vale.
 */
export function applied(before: object, after: object): boolean {
	return after !== before || Object.keys(before).length === 0;
}

/** Lo que el bucle enseña: el aviso de datos nuevos (si estás más abajo o escribiendo) y el de versión nueva. */
export interface FreshState {
	aviso: boolean;
	codigo: boolean;
}

export interface FreshEnv {
	/** Esta pestaña. Sin `code`, se aprende de /code.json (ver arriba). */
	mine: { v: string; code?: string | null };
	/** Pide /code.json (readBuild). */
	read: () => Promise<Build | null>;
	/** Refresca los datos de la vista (refreshAll, con keepPlace y loadOrFail). */
	refresh: () => Promise<unknown>;
	/** ¿Vista que se refresca sola aunque escribas (TV o TOP)? */
	auto: () => boolean;
	/** ¿Modo TV? Ahí siempre se refresca sola: nadie lee a media página. */
	tv: () => boolean;
	/** ¿Foco en un campo (holdsFocus)? */
	typing: () => boolean;
	doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
	win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'scrollY'>;
}

/** Eventos que cuentan como gesto en marcha. `scroll` en captura, para enterarse también del de las listas con scroll propio. */
const GESTURES = ['scroll', 'wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'] as const;
const PASSIVE = { capture: true, passive: true };

/**
 * El bucle: pregunta a los FIRST_MS de abrir, cada POLL_MS con la pestaña a la vista y al volver a ella, y aplica
 * lo que diga decide().
 * Con datos nuevos a la espera (a mitad de un gesto, más abajo o escribiendo), vuelve a mirar cada RETRY_MS sin
 * red, mientras la pestaña esté a la vista (al volver a ella ya se pregunta otra vez).
 * Devuelve `apply` (el botón «Actualizar») y `stop`.
 */
export function watch(state: FreshState, env: FreshEnv) {
	const mine: Mine = { v: env.mine.v, code: env.mine.code ?? null };
	let seen = mine.v;
	let latest: Build | null = null;
	let lastGesture = -Infinity;
	let fingers = 0;
	let working = false;
	let retry: ReturnType<typeof setTimeout> | undefined;
	/** Refrescos fallidos seguidos, para espaciar los reintentos, y el reintento programado. */
	let failures = 0;
	let again: ReturnType<typeof setTimeout> | undefined;
	/** Lo que has desplazado por dentro (una lista de un panel, la vista al encajar en pantalla). */
	const scrollers = new Set<Element>();

	const pending = () => !state.codigo && !!latest && latest.v !== seen;
	const visible = () => env.doc.visibilityState === 'visible';

	/** ¿Lejos de arriba? La página o algo que has desplazado por dentro (no en el modo TV). */
	function away() {
		if (env.tv()) return false;
		if (env.win.scrollY >= 1) return true;
		for (const el of scrollers) {
			if (!el.isConnected) scrollers.delete(el);
			else if (el.scrollTop >= 1) return true;
		}
		return false;
	}

	async function apply() {
		if (!latest || working || state.codigo) return;
		const target = latest.v;
		working = true;
		try {
			await env.refresh();
			seen = target;
			failures = 0;
			state.aviso = false;
		} catch {
			// No ha llegado (un 503 puntual del borde deja la vista en la página de error) o no se ha aplicado. Se
			// vuelve a preguntar pronto, cada vez más espaciado (RETRY_MS, el doble… hasta POLL_MS), no al minuto.
			// Hasta entonces, sin aviso: su botón no haría nada (y en la página de error ya está «Reintentar»).
			latest = null;
			state.aviso = false;
			failures++;
			clearTimeout(again);
			again = setTimeout(() => void poll(), Math.min(RETRY_MS * 2 ** (failures - 1), POLL_MS));
		} finally {
			working = false;
		}
	}

	async function step(resumed = false) {
		clearTimeout(retry);
		retry = undefined;
		if (working) return;
		const what = decide({
			mine,
			seen,
			latest,
			idleMs: fingers > 0 ? 0 : Date.now() - lastGesture,
			resumed,
			auto: env.auto(),
			typing: env.typing(),
			away: away()
		});
		if (what === 'codigo') {
			state.codigo = true;
			state.aviso = false;
		} else if (what === 'aviso') state.aviso = true;
		// Con la pestaña oculta no se descarga nada: al volver a ella se pregunta y se refresca.
		else if (what === 'datos' && visible()) await apply();
		if (pending() && visible()) retry = setTimeout(step, RETRY_MS);
	}

	/** `always`: también con la pestaña oculta (la primera, para aprender el commit aunque se abra en segundo plano). */
	async function poll(resumed = false, always = false) {
		if ((!always && !visible()) || state.codigo || working) return;
		working = true;
		try {
			const got = await env.read();
			// La primera respuesta con la versión de esta pestaña dice su commit.
			if (got && mine.code === null && got.v === mine.v) mine.code = got.code;
			latest = got ?? latest;
		} finally {
			working = false;
		}
		await step(resumed);
	}

	const onVisible = () => void (visible() && poll(true));
	const onGesture = (e: Event) => {
		lastGesture = Date.now();
		if (e.type === 'touchstart') fingers = (e as TouchEvent).touches?.length ?? 1;
		// El scroll de la página llega desde document (sin scrollTop); el de una lista, desde ella.
		const target = e.target as Element | null;
		if (e.type === 'scroll' && target && 'scrollTop' in target) scrollers.add(target);
	};
	const onTouchEnd = (e: Event) => {
		fingers = (e as TouchEvent).touches?.length ?? 0;
		lastGesture = Date.now();
	};
	// Un trozo de código que no llega. Puede ser que ya no exista (se publicó código nuevo y esta pestaña pide el
	// viejo: hay que recargar) o solo falta de red: Vite lanza este evento con cualquier import() que falle, también
	// al precargar una vista al pasar el ratón. Lo decide /code.json (otro commit: «Recargar»); sin red, nada.
	const onPreloadError = () => void poll();

	const first = setTimeout(() => void poll(false, true), FIRST_MS);
	const timer = setInterval(() => void poll(), POLL_MS);
	env.doc.addEventListener('visibilitychange', onVisible);
	for (const type of GESTURES) env.win.addEventListener(type, onGesture, PASSIVE);
	env.win.addEventListener('touchend', onTouchEnd, PASSIVE);
	env.win.addEventListener('touchcancel', onTouchEnd, PASSIVE);
	env.win.addEventListener('vite:preloadError', onPreloadError);

	return {
		apply,
		stop() {
			clearTimeout(first);
			clearInterval(timer);
			clearTimeout(retry);
			clearTimeout(again);
			scrollers.clear();
			env.doc.removeEventListener('visibilitychange', onVisible);
			for (const type of GESTURES) env.win.removeEventListener(type, onGesture, PASSIVE);
			env.win.removeEventListener('touchend', onTouchEnd, PASSIVE);
			env.win.removeEventListener('touchcancel', onTouchEnd, PASSIVE);
			env.win.removeEventListener('vite:preloadError', onPreloadError);
		}
	};
}
