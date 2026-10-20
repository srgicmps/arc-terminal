import { describe, expect, it, vi } from 'vitest';
import { durationMs, fade, wants, type NavLike, type ViewEnv } from './viewtransition.ts';

const U = 'https://arcterminal.dev';
const nav = (from: string, to: string, extra: Partial<NavLike> = {}): NavLike => ({
	type: 'link',
	willUnload: false,
	from: { url: new URL(from, U) },
	to: { url: new URL(to, U) },
	...extra
});
const env = (extra: Partial<ViewEnv> = {}): ViewEnv => ({ supported: true, reduced: false, tv: false, embedded: false, os: false, ms: 140, ...extra });

describe('fundido entre vistas: cuándo', () => {
	it('funde al cambiar de vista, con la barra, un enlace o goto', () => {
		expect(wants(nav('/', '/eco'), env())).toBe(true);
		expect(wants(nav('/eco', '/ws?x=1'), env())).toBe(true);
		expect(wants(nav('/', '/geo', { type: 'goto' }), env())).toBe(true);
	});

	it('no funde si solo cambian ?query o #panel (filtros, tu sitio, un panel)', () => {
		expect(wants(nav('/fuel', '/fuel?prov=07'), env())).toBe(false);
		expect(wants(nav('/eco', '/eco#ipc'), env())).toBe(false);
	});

	it('sin la API, con menos movimiento o con duración 0 (Terminal), nada', () => {
		expect(wants(nav('/', '/eco'), env({ supported: false }))).toBe(false);
		expect(wants(nav('/', '/eco'), env({ reduced: true }))).toBe(false);
		expect(wants(nav('/', '/eco'), env({ ms: 0 }))).toBe(false);
	});

	it('ni en el modo TV, ni en una ventana de Arc OS, ni al entrar o salir de /os', () => {
		expect(wants(nav('/', '/eco'), env({ tv: true }))).toBe(false);
		expect(wants(nav('/', '/eco'), env({ embedded: true }))).toBe(false);
		expect(wants(nav('/', '/eco'), env({ os: true }))).toBe(false);
		expect(wants(nav('/', '/os'), env())).toBe(false);
		expect(wants(nav('/os/', '/eco'), env())).toBe(false);
	});

	it('ni con atrás o adelante (el gesto del sistema ya anima), ni al salir de la web', () => {
		expect(wants(nav('/', '/eco', { type: 'popstate' }), env())).toBe(false);
		expect(wants(nav('/', '/eco', { willUnload: true }), env())).toBe(false);
		expect(wants({ ...nav('/', '/eco'), from: null }, env())).toBe(false);
		expect(wants(nav('/', 'https://example.com/eco'), env())).toBe(false);
	});

	it('la duración solo se lee si todo lo demás deja fundir', () => {
		const ms = vi.fn(() => 140);
		const lazy: ViewEnv = {
			...env({ tv: true }),
			get ms() {
				return ms();
			}
		};
		expect(wants(nav('/', '/eco'), lazy)).toBe(false);
		expect(ms).not.toHaveBeenCalled();
	});
});

describe('fundido entre vistas: cómo', () => {
	it('lee los tiempos de CSS', () => {
		expect(durationMs('140ms')).toBe(140);
		expect(durationMs(' 0.14s ')).toBe(140);
		expect(durationMs('0ms')).toBe(0);
		expect(durationMs('')).toBe(0);
		expect(durationMs('var(--x)')).toBe(0);
	});

	it('suelta la navegación en cuanto tiene la foto y no deja errores sin capturar si se cancela', async () => {
		const abort = () => Promise.reject(new DOMException('Skipped', 'AbortError'));
		let update: (() => Promise<void>) | undefined;
		const doc = {
			startViewTransition: (cb: () => Promise<void>) => {
				update = cb;
				return { ready: abort(), finished: abort(), updateCallbackDone: abort(), skipTransition() {}, types: new Set() };
			}
		} as unknown as Pick<Document, 'startViewTransition'>;
		const done = fade(Promise.resolve(), doc);
		await update?.();
		await expect(done).resolves.toBeUndefined();
	});

	it('si la navegación falla (nav.complete rechaza), tampoco deja errores sin capturar', async () => {
		// Como el navegador: las tres promesas del fundido salen de lo que devuelve el callback, así que heredan el fallo.
		let done: Promise<void> | undefined;
		const doc = {
			startViewTransition: (cb: () => Promise<void>) => {
				const updateCallbackDone = Promise.resolve().then(cb);
				done = updateCallbackDone;
				const ready = updateCallbackDone.then(() => undefined);
				return { ready, finished: ready.then(() => undefined), updateCallbackDone, skipTransition() {}, types: new Set() };
			}
		} as unknown as Pick<Document, 'startViewTransition'>;
		// SvelteKit ya captura su propio `complete` (client.js: complete.catch(noop)); lo que podría quedar suelto son
		// ready y finished. Sin los catch de fade, Vitest lo contaría como error sin capturar y el test fallaría.
		const complete = Promise.reject(new Error('Not found'));
		complete.catch(() => {});
		await expect(fade(complete, doc)).resolves.toBeUndefined();
		await expect(done).rejects.toThrow('Not found');
		// Un turno más, para que Node llegue a ver cualquier rechazo sin capturar.
		await new Promise((r) => setTimeout(r, 0));
	});

	it('si el navegador no puede, se navega sin fundido', async () => {
		const doc = {
			startViewTransition: () => {
				throw new DOMException('No', 'InvalidStateError');
			}
		} as unknown as Pick<Document, 'startViewTransition'>;
		await expect(fade(Promise.resolve(), doc)).resolves.toBeUndefined();
	});
});
