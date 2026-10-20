import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decide, FIRST_MS, GESTURE_MS, isField, keepPlace, LOCAL, POLL_MS, readBuild, RETRY_MS, watch, type Build, type Situation } from './fresh.ts';

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

describe('keepPlace', () => {
	/**
	 * Una página con scroll y un elemento en el centro que baja `shift` px al refrescar. Con `inner`, va dentro
	 * de una lista con scroll propio, que además mete 20 px encima de él (eso no lo arregla la página).
	 */
	function page(shift: number, opts: { scrollY?: number; inner?: boolean } = {}) {
		let moved = 0;
		let inside = 0;
		const body = {};
		const box = { isConnected: true, scrollHeight: 900, clientHeight: 300, getBoundingClientRect: () => ({ top: 200 + moved }), parentElement: body };
		const el = {
			isConnected: true,
			getBoundingClientRect: () => ({ top: 300 + moved + inside }),
			parentElement: opts.inner ? box : body
		};
		const win = {
			scrollY: opts.scrollY ?? 800,
			innerWidth: 400,
			innerHeight: 800,
			scrollBy: vi.fn(),
			getComputedStyle: () => ({ overflowY: 'auto' }),
			document: { body, documentElement: {}, elementFromPoint: () => el }
		};
		const run = vi.fn(async () => {
			moved += shift;
			if (opts.inner) inside += 20;
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
		const win = new EventTarget();
		const state = { aviso: false, codigo: false };
		const env = { latest: first, auto: false, typing: false };
		const read = vi.fn(async () => env.latest);
		const refresh = vi.fn(async () => {});
		const w = watch(state, {
			mine: { v: '100', code },
			read,
			refresh,
			auto: () => env.auto,
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

	it('si el refresco falla, lo reintenta en la pregunta siguiente, no cada pocos segundos', async () => {
		const t = setup();
		t.refresh.mockRejectedValueOnce(new Error('sin red'));
		await vi.advanceTimersByTimeAsync(FIRST_MS + RETRY_MS * 5);
		expect(t.refresh).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(POLL_MS - FIRST_MS - RETRY_MS * 5);
		expect(t.refresh).toHaveBeenCalledTimes(2);
		t.w.stop();
	});

	it('un trozo de la build que ya no existe: «Recargar»', () => {
		const t = setup();
		t.win.dispatchEvent(new Event('vite:preloadError'));
		expect(t.state.codigo).toBe(true);
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
