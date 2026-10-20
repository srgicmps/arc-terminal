import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	decide,
	FIRST_MS,
	GESTURE_MS,
	holdsFocus,
	isField,
	keepPlace,
	loadOrFail,
	LOCAL,
	POLL_MS,
	readBuild,
	RETRY_MS,
	watch,
	type Build,
	type Situation
} from './fresh.ts';

vi.mock('$app/env', () => ({ dev: false, version: '1792496039255' }));

const mine = { v: '100', code: 'abc' };
const base: Situation = { mine, seen: '100', latest: null, idleMs: 60_000 };

describe('decide', () => {
	it('mismo código y datos nuevos, sin tocar nada: refresca', () => {
		expect(decide({ ...base, latest: { v: '200', code: 'abc' } })).toBe('datos');
	});

	it('otro código: «Recargar»', () => {
		expect(decide({ ...base, latest: { v: '200', code: 'def' } })).toBe('codigo');
	});

	it('sin cambios o sin respuesta: nada', () => {
		expect(decide({ ...base, latest: { v: '100', code: 'abc' } })).toBe('nada');
		expect(decide(base)).toBe('nada');
		// Ya refrescado a la 200: la misma 200 no vuelve a refrescar.
		expect(decide({ ...base, seen: '200', latest: { v: '200', code: 'abc' } })).toBe('nada');
	});

	it('a mitad de un gesto: espera, en cualquier vista', () => {
		const latest = { v: '200', code: 'abc' };
		expect(decide({ ...base, latest, idleMs: GESTURE_MS - 1 })).toBe('nada');
		expect(decide({ ...base, latest, idleMs: 0, auto: true })).toBe('nada');
		expect(decide({ ...base, latest, idleMs: GESTURE_MS })).toBe('datos');
	});

	it('al volver a la pestaña: refresca aunque el último gesto sea reciente', () => {
		expect(decide({ ...base, latest: { v: '200', code: 'abc' }, idleMs: 10, resumed: true })).toBe('datos');
	});

	it('escribiendo en un campo: aviso, salvo en TV y TOP', () => {
		const latest = { v: '200', code: 'abc' };
		expect(decide({ ...base, latest, typing: true })).toBe('aviso');
		expect(decide({ ...base, latest, typing: true, resumed: true })).toBe('aviso');
		expect(decide({ ...base, latest, typing: true, auto: true })).toBe('datos');
	});

	it('leyendo más abajo: aviso, también en TOP (lo nuevo movería lo que lees)', () => {
		const latest = { v: '200', code: 'abc' };
		expect(decide({ ...base, latest, away: true })).toBe('aviso');
		expect(decide({ ...base, latest, away: true, auto: true })).toBe('aviso');
		expect(decide({ ...base, latest, away: true, resumed: true })).toBe('aviso');
		// El código nuevo sigue siendo «Recargar».
		expect(decide({ ...base, latest: { v: '200', code: 'def' }, away: true })).toBe('codigo');
	});

	it('commit aún desconocido: cualquier cambio cuenta como código', () => {
		expect(decide({ ...base, mine: { v: '100', code: null }, latest: { v: '200', code: 'abc' } })).toBe('codigo');
		expect(decide({ ...base, mine: { v: '100', code: null }, latest: { v: '100', code: 'abc' } })).toBe('nada');
	});

	it('build local (sin commit): cualquier cambio cuenta como código', () => {
		const local = { v: '100', code: LOCAL };
		expect(decide({ ...base, mine: local, latest: { v: '200', code: LOCAL } })).toBe('codigo');
		expect(decide({ ...base, mine: local, latest: { v: '100', code: LOCAL } })).toBe('nada');
	});
});

describe('readBuild', () => {
	it('pide sin caché y sin seguir redirecciones, y lee v y code', async () => {
		const get = vi.fn(async () => Response.json({ v: '200', code: 'abc', extra: 1 }));
		expect(await readBuild(get, '/code.json')).toEqual({ v: '200', code: 'abc' });
		expect(get).toHaveBeenCalledWith('/code.json', { cache: 'no-store', redirect: 'manual' });
	});

	it('error, respuesta rara o sin red: null', async () => {
		expect(await readBuild(async () => new Response('no', { status: 404 }), '/code.json')).toBeNull();
		expect(await readBuild(async () => new Response('<html>login</html>'), '/code.json')).toBeNull();
		expect(await readBuild(async () => Response.json({ v: 200 }), '/code.json')).toBeNull();
		expect(await readBuild(async () => Response.json(null), '/code.json')).toBeNull();
		expect(
			await readBuild(async () => {
				throw new TypeError('Failed to fetch');
			}, '/code.json')
		).toBeNull();
	});
});

describe('isField', () => {
	const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra }) as unknown as Element;

	it('campos de texto, áreas, desplegables y contenteditable', () => {
		expect(isField(el('INPUT', { type: 'text' }))).toBe(true);
		expect(isField(el('INPUT', { type: 'search' }))).toBe(true);
		expect(isField(el('TEXTAREA'))).toBe(true);
		expect(isField(el('SELECT'))).toBe(true);
		expect(isField(el('DIV', { isContentEditable: true }))).toBe(true);
	});

	it('botones, casillas, enlaces o nada: no', () => {
		expect(isField(null)).toBe(false);
		expect(isField(el('INPUT', { type: 'checkbox' }))).toBe(false);
		expect(isField(el('INPUT', { type: 'range' }))).toBe(false);
		expect(isField(el('BUTTON'))).toBe(false);
		expect(isField(el('A'))).toBe(false);
		expect(isField(el('IFRAME'))).toBe(false);
	});
});

describe('holdsFocus', () => {
	/** Un elemento dentro (o fuera) de la vista, con el foco de teclado (:focus-visible) o de un clic. */
	const el = (tagName: string, opts: { inView?: boolean; keyboard?: boolean | 'throws'; type?: string } = {}) =>
		({
			tagName,
			type: opts.type,
			parentElement: { closest: (sel: string) => (sel === '#contenido' && opts.inView ? {} : null) },
			matches: (sel: string) => {
				if (opts.keyboard === 'throws') throw new SyntaxError(sel);
				return sel === ':focus-visible' && !!opts.keyboard;
			}
		}) as unknown as Element;

	it('un campo, esté donde esté (también la barra de comandos)', () => {
		expect(holdsFocus(el('INPUT', { type: 'search' }))).toBe(true);
	});

	it('el foco de teclado en una fila o un enlace de la vista', () => {
		expect(holdsFocus(el('A', { inView: true, keyboard: true }))).toBe(true);
		expect(holdsFocus(el('TR', { inView: true, keyboard: true }))).toBe(true);
	});

	it('con ratón o dedo, fuera de la vista, sin foco o sin :focus-visible: no', () => {
		expect(holdsFocus(el('A', { inView: true, keyboard: false }))).toBe(false);
		// La vista entera (#contenido): su padre no está dentro de #contenido.
		expect(holdsFocus(el('MAIN', { inView: false, keyboard: true }))).toBe(false);
		expect(holdsFocus(el('A', { inView: false, keyboard: true }))).toBe(false);
		expect(holdsFocus(el('A', { inView: true, keyboard: 'throws' }))).toBe(false);
		expect(holdsFocus(null)).toBe(false);
	});
});

describe('loadOrFail', () => {
	it('si la vista carga, nada; si acaba en la página de error (sin rechazar), falla', async () => {
		let error = false;
		await expect(loadOrFail(async () => {}, () => error)).resolves.toBeUndefined();
		// Como refreshAll con un 503 en el __data.json: resuelve, pero pinta +error.svelte.
		await expect(
			loadOrFail(
				async () => {
					error = true;
				},
				() => error
			)
		).rejects.toThrow();
	});
});

describe('keepPlace', () => {
	/**
	 * Una página con scroll y un elemento en el centro que baja `shift` px al refrescar. Con `inner`, va dentro
	 * de una lista con scroll propio, que además mete 20 px encima de él (eso no lo arregla la página).
	 */
	function page(shift: number, opts: { scrollY?: number; inner?: boolean; userScroll?: number } = {}) {
		let moved = 0;
		let inside = 0;
		const body = {};
		const start = opts.scrollY ?? 800;
		// En pantalla, lo de la página sube lo que deslizas hacia abajo.
		const scrolled = () => win.scrollY - start;
		const box = {
			isConnected: true,
			scrollHeight: 900,
			clientHeight: 300,
			getBoundingClientRect: () => ({ top: 200 + moved - scrolled() }),
			parentElement: body
		};
		const el = {
			isConnected: true,
			getBoundingClientRect: () => ({ top: 300 + moved + inside - scrolled() }),
			parentElement: opts.inner ? box : body
		};
		const win = {
			scrollY: start,
			innerWidth: 400,
			innerHeight: 800,
			scrollBy: vi.fn(),
			getComputedStyle: () => ({ overflowY: 'auto' }),
			document: { body, documentElement: {}, elementFromPoint: () => el }
		};
		const run = vi.fn(async () => {
			moved += shift;
			if (opts.inner) inside += 20;
			// Mientras llegan los datos, deslizas.
			win.scrollY += opts.userScroll ?? 0;
		});
		return { win: win as unknown as Window, run, el, scrollBy: win.scrollBy };
	}

	it('si entra contenido encima, devuelve lo que se leía a su sitio', async () => {
		const p = page(48);
		await keepPlace(p.win, p.run);
		expect(p.run).toHaveBeenCalledOnce();
		expect(p.scrollBy).toHaveBeenCalledWith(0, 48);
	});

	it('si no se ha movido, en lo alto de la página o con scroll anchoring del navegador, no toca nada', async () => {
		const still = page(0);
		await keepPlace(still.win, still.run);
		expect(still.scrollBy).not.toHaveBeenCalled();
		const top = page(48, { scrollY: 0 });
		await keepPlace(top.win, top.run);
		expect(top.run).toHaveBeenCalledOnce();
		expect(top.scrollBy).not.toHaveBeenCalled();
		vi.stubGlobal('CSS', { supports: () => true });
		const native = page(48);
		await keepPlace(native.win, native.run);
		expect(native.scrollBy).not.toHaveBeenCalled();
	});

	it('si deslizas mientras llegan los datos, solo compensa lo que ha entrado encima, no tu scroll', async () => {
		// El caso del iPhone: a 800, deslizas 500 hacia abajo y entran 48 px encima. Debe acabar en 1348, no en 848.
		const p = page(48, { userScroll: 500 });
		await keepPlace(p.win, p.run);
		expect(p.scrollBy).toHaveBeenCalledWith(0, 48);
		// Y si no entra nada, tu scroll se queda como está.
		const still = page(0, { userScroll: 500 });
		await keepPlace(still.win, still.run);
		expect(still.scrollBy).not.toHaveBeenCalled();
	});

	it('dentro de una lista con scroll propio, se ancla la lista (se mueve con la página)', async () => {
		const p = page(48, { inner: true });
		await keepPlace(p.win, p.run);
		expect(p.scrollBy).toHaveBeenCalledWith(0, 48);
	});

	it('si lo que se leía ya no está, no toca nada', async () => {
		const p = page(48);
		p.run.mockImplementation(async () => {
			p.el.isConnected = false;
		});
		await keepPlace(p.win, p.run);
		expect(p.scrollBy).not.toHaveBeenCalled();
	});
});

describe('watch', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	/** Pestaña cargada con la versión 100 del commit abc (o sin commit conocido, con `code: null`). */
	function setup(first: Build | null = { v: '200', code: 'abc' }, code: string | null = 'abc') {
		const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
		const win = Object.assign(new EventTarget(), { scrollY: 0 });
		const state = { aviso: false, codigo: false };
		const env = { latest: first, auto: false, tv: false, typing: false };
		const read = vi.fn(async () => env.latest);
		const refresh = vi.fn(async () => {});
		const w = watch(state, {
			mine: { v: '100', code },
			read,
			refresh,
			auto: () => env.auto,
			tv: () => env.tv,
			typing: () => env.typing,
			doc: doc as unknown as Document,
			win: win as unknown as Window
		});
		return { doc, win, state, env, read, refresh, w };
	}

	it('datos nuevos: refresca en la primera pregunta (a los 5 s) y no otra vez con la misma publicación', async () => {
		const t = setup();
		await vi.advanceTimersByTimeAsync(FIRST_MS - 1);
		expect(t.read).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(t.read).toHaveBeenCalledOnce();
		expect(t.refresh).toHaveBeenCalledOnce();
		// Luego, una vez por minuto.
		await vi.advanceTimersByTimeAsync(POLL_MS * 3);
		expect(t.read).toHaveBeenCalledTimes(4);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state).toEqual({ aviso: false, codigo: false });
		// Otra pasada de datos: otro refresco.
		t.env.latest = { v: '300', code: 'abc' };
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(t.refresh).toHaveBeenCalledTimes(2);
		t.w.stop();
	});

	it('código nuevo: «Recargar» y deja de preguntar', async () => {
		const t = setup({ v: '200', code: 'def' });
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.codigo).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		expect(t.read).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('aprende su commit de la primera respuesta con su misma versión', async () => {
		const t = setup({ v: '100', code: 'abc' }, null);
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.codigo).toBe(false);
		t.env.latest = { v: '200', code: 'abc' };
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.codigo).toBe(false);
		// Y con otro commit, «Recargar».
		t.env.latest = { v: '300', code: 'def' };
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(t.state.codigo).toBe(true);
		t.w.stop();
	});

	it('si la primera respuesta ya es de otra publicación, no sabe si cambió el código: «Recargar»', async () => {
		const t = setup({ v: '200', code: 'abc' }, null);
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.codigo).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		t.w.stop();
	});

	it('a mitad de un scroll espera a que acabe, sin aviso', async () => {
		const t = setup();
		await vi.advanceTimersByTimeAsync(FIRST_MS - 500);
		t.win.dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(500);
		expect(t.read).toHaveBeenCalledOnce();
		expect(t.refresh).not.toHaveBeenCalled();
		expect(t.state.aviso).toBe(false);
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.read).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('con un dedo en la pantalla no refresca hasta que lo levanta', async () => {
		const t = setup();
		t.win.dispatchEvent(new Event('touchstart'));
		await vi.advanceTimersByTimeAsync(FIRST_MS + RETRY_MS * 3);
		expect(t.refresh).not.toHaveBeenCalled();
		t.win.dispatchEvent(new Event('touchend'));
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('escribiendo: aviso; al dejar el campo, refresca solo y lo quita', async () => {
		const t = setup();
		t.env.typing = true;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.aviso).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		t.env.typing = false;
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		t.w.stop();
	});

	it('el botón «Actualizar» refresca ya, aunque se esté escribiendo', async () => {
		const t = setup();
		t.env.typing = true;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		await t.w.apply();
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		await vi.advanceTimersByTimeAsync(RETRY_MS * 3);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('a media página: aviso, sin mover nada; al volver arriba, refresca solo y lo quita', async () => {
		const t = setup();
		t.win.scrollY = 1200;
		await vi.advanceTimersByTimeAsync(FIRST_MS + RETRY_MS * 3);
		expect(t.state.aviso).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		t.win.scrollY = 0;
		t.win.dispatchEvent(new Event('scroll'));
		// Espera a que acabe el gesto (GESTURE_MS) y a la siguiente mirada.
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		t.w.stop();
	});

	it('también en TOP; con «Actualizar» refresca ya, en su sitio', async () => {
		const t = setup();
		t.env.auto = true;
		t.win.scrollY = 1200;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.aviso).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		await t.w.apply();
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		t.w.stop();
	});

	it('una lista con scroll propio bajada (al encajar en pantalla) cuenta como leer más abajo', async () => {
		const t = setup();
		const list = Object.assign(new EventTarget(), { isConnected: true, scrollTop: 300 });
		// El scroll de una lista no burbujea: llega a window en captura, con la lista como target.
		const ev = new Event('scroll');
		Object.defineProperty(ev, 'target', { value: list });
		t.win.dispatchEvent(ev);
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.aviso).toBe(true);
		expect(t.refresh).not.toHaveBeenCalled();
		// La lista vuelve arriba: ya refresca.
		list.scrollTop = 0;
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('una lista bajada que ya no está (otra vista) no cuenta', async () => {
		const t = setup();
		const list = Object.assign(new EventTarget(), { isConnected: false, scrollTop: 300 });
		const ev = new Event('scroll');
		Object.defineProperty(ev, 'target', { value: list });
		t.win.dispatchEvent(ev);
		await vi.advanceTimersByTimeAsync(FIRST_MS + RETRY_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('en el modo TV refresca siempre, aunque la página no esté arriba', async () => {
		const t = setup();
		t.env.auto = true;
		t.env.tv = true;
		t.win.scrollY = 600;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		t.w.stop();
	});

	it('en TV y TOP refresca aunque haya un campo con el foco', async () => {
		const t = setup();
		t.env.typing = true;
		t.env.auto = true;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.aviso).toBe(false);
		t.w.stop();
	});

	it('con la pestaña oculta solo hace la primera pregunta; al volver, pregunta y refresca ya', async () => {
		const t = setup({ v: '100', code: 'abc' });
		t.doc.visibilityState = 'hidden';
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		expect(t.read).toHaveBeenCalledOnce();
		t.env.latest = { v: '200', code: 'abc' };
		t.win.dispatchEvent(new Event('keydown'));
		t.doc.visibilityState = 'visible';
		t.doc.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.read).toHaveBeenCalledTimes(2);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('sin respuesta, no hace nada', async () => {
		const t = setup(null);
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		expect(t.read).toHaveBeenCalledTimes(3);
		expect(t.refresh).not.toHaveBeenCalled();
		expect(t.state).toEqual({ aviso: false, codigo: false });
		t.w.stop();
	});

	it('si el refresco acaba en la página de error, no da los datos por vistos: lo reintenta pronto, cada vez más espaciado', async () => {
		const t = setup();
		// Como en fresh.svelte.ts: refreshAll no rechaza con un 503 en el __data.json, deja page.error puesto.
		let pageError = false;
		let fails = 2;
		t.refresh.mockImplementation(() =>
			loadOrFail(
				async () => {
					pageError = fails-- > 0;
				},
				() => pageError
			)
		);
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(pageError).toBe(true);
		expect(t.state.aviso).toBe(false);
		// No al minuto: a los RETRY_MS vuelve a preguntar y a refrescar (y falla otra vez)…
		await vi.advanceTimersByTimeAsync(RETRY_MS - 1);
		expect(t.refresh).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(t.read).toHaveBeenCalledTimes(2);
		expect(t.refresh).toHaveBeenCalledTimes(2);
		expect(pageError).toBe(true);
		// …y luego al doble, que devuelve la vista.
		await vi.advanceTimersByTimeAsync(RETRY_MS * 2 - 1);
		expect(t.refresh).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(t.refresh).toHaveBeenCalledTimes(3);
		expect(pageError).toBe(false);
		// Ya vista: la misma publicación no vuelve a refrescar.
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		expect(t.refresh).toHaveBeenCalledTimes(3);
		t.w.stop();
	});

	it('si sigue fallando, los reintentos se espacian: 3 s, 6 s, 12 s, 24 s… y luego como mucho uno por minuto', async () => {
		const t = setup();
		t.refresh.mockRejectedValue(new Error('503'));
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.refresh).toHaveBeenCalledTimes(1);
		let calls = 1;
		for (const wait of [RETRY_MS, RETRY_MS * 2, RETRY_MS * 4, RETRY_MS * 8]) {
			await vi.advanceTimersByTimeAsync(wait - 1);
			expect(t.refresh).toHaveBeenCalledTimes(calls);
			await vi.advanceTimersByTimeAsync(1);
			expect(t.refresh).toHaveBeenCalledTimes(++calls);
		}
		// Con la pregunta de cada minuto, no más de una vez por minuto.
		await vi.advanceTimersByTimeAsync(POLL_MS * 3);
		expect(t.refresh.mock.calls.length - calls).toBeLessThanOrEqual(3);
		t.w.stop();
	});

	it('si el refresco falla al pulsar «Actualizar», quita el aviso hasta el reintento (su botón no haría nada)', async () => {
		const t = setup();
		t.env.typing = true;
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.state.aviso).toBe(true);
		t.refresh.mockRejectedValueOnce(new Error('sin red'));
		await t.w.apply();
		expect(t.state.aviso).toBe(false);
		await vi.advanceTimersByTimeAsync(RETRY_MS);
		expect(t.state.aviso).toBe(true);
		t.w.stop();
	});

	it('con datos a la espera, si la pestaña se oculta no refresca en segundo plano; al volver, sí', async () => {
		const t = setup();
		t.win.dispatchEvent(new Event('touchstart'));
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		expect(t.refresh).not.toHaveBeenCalled();
		// Se va a otra app con el dedo aún en la pantalla; el navegador cancela el toque.
		t.doc.visibilityState = 'hidden';
		t.win.dispatchEvent(new Event('touchcancel'));
		await vi.advanceTimersByTimeAsync(RETRY_MS * 5);
		expect(t.refresh).not.toHaveBeenCalled();
		t.doc.visibilityState = 'visible';
		t.doc.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.refresh).toHaveBeenCalledOnce();
		t.w.stop();
	});

	it('un trozo de la build que no llega: pregunta a /code.json; con otro commit, «Recargar»', async () => {
		const t = setup({ v: '100', code: 'abc' });
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		t.env.latest = { v: '200', code: 'def' };
		t.win.dispatchEvent(new Event('vite:preloadError'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.read).toHaveBeenCalledTimes(2);
		expect(t.state.codigo).toBe(true);
		t.w.stop();
	});

	it('un trozo que no llega sin red (o con el mismo código) no es una versión nueva, y se sigue preguntando', async () => {
		const t = setup({ v: '100', code: 'abc' });
		await vi.advanceTimersByTimeAsync(FIRST_MS);
		// Sin red: /code.json tampoco responde.
		t.env.latest = null;
		t.win.dispatchEvent(new Event('vite:preloadError'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.read).toHaveBeenCalledTimes(2);
		expect(t.state.codigo).toBe(false);
		// Con red otra vez y el mismo código: tampoco; y los datos nuevos siguen llegando.
		t.env.latest = { v: '100', code: 'abc' };
		t.win.dispatchEvent(new Event('vite:preloadError'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.state.codigo).toBe(false);
		t.env.latest = { v: '200', code: 'abc' };
		await vi.advanceTimersByTimeAsync(POLL_MS);
		expect(t.refresh).toHaveBeenCalledOnce();
		expect(t.state.codigo).toBe(false);
		t.w.stop();
	});

	it('stop: deja de preguntar y de escuchar', async () => {
		const t = setup();
		t.w.stop();
		await vi.advanceTimersByTimeAsync(POLL_MS * 2);
		t.doc.dispatchEvent(new Event('visibilitychange'));
		t.win.dispatchEvent(new Event('vite:preloadError'));
		await vi.advanceTimersByTimeAsync(0);
		expect(t.read).not.toHaveBeenCalled();
		expect(t.state.codigo).toBe(false);
	});
});

describe('/code.json', () => {
	it('dice la versión de la build y el commit', async () => {
		vi.stubGlobal('__ARC_CODE__', 'abc123');
		const { GET, prerender } = await import('../routes/code.json/+server.ts');
		expect(prerender).toBe(true);
		const res = GET();
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(await res.json()).toEqual({ v: '1792496039255', code: 'abc123' });
	});
});
