import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ESPERANDO, PASADAS, REPO, despertar, motivo } from './despertador.ts';
import worker from './worker.ts';

const TOKEN = 'github_pat_de_prueba_123';
const FAST = '*/5 * * * *';
const DEPLOY = '7,22,37,52 * * * *';

interface Llamada {
	method: string;
	path: string;
	headers: Record<string, string>;
	body?: unknown;
}

/** Una pasada de main que espera turno: de qué workflow es y en qué estado (queued o pending). */
interface Espera {
	workflow: string;
	status: (typeof ESPERANDO)[number];
}

/**
 * GitHub de mentira: `esperan` son las pasadas de main que esperan turno y `falla`, qué responder en vez de lo
 * normal a las peticiones cuya ruta empieza por esa clave. Como el GitHub de verdad, /actions/runs cuenta las
 * de todos los workflows y /actions/workflows/<archivo>/runs, solo las de ese archivo.
 */
function github({ esperan = [], falla = {} }: { esperan?: Espera[]; falla?: Record<string, number> } = {}) {
	const llamadas: Llamada[] = [];
	const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const path = url.pathname + url.search;
		llamadas.push({
			method: init?.method ?? 'GET',
			path,
			headers: init?.headers as Record<string, string>,
			body: init?.body ? JSON.parse(String(init.body)) : undefined
		});
		for (const [prefijo, status] of Object.entries(falla))
			if (url.pathname.startsWith(prefijo)) return new Response('{}', { status });
		if (url.pathname.endsWith('/dispatches')) return new Response(null, { status: 204 });
		const suyas = url.pathname.match(/\/actions\/workflows\/([^/]+)\/runs$/)?.[1];
		const total_count = esperan.filter(
			(e) => e.status === url.searchParams.get('status') && (!suyas || e.workflow === suyas)
		).length;
		return Response.json({ total_count, workflow_runs: [] });
	});
	vi.stubGlobal('fetch', fn);
	return { llamadas, fn };
}

const registro = () => {
	const lineas: string[] = [];
	return { lineas, log: (m: string) => void lineas.push(m) };
};

describe('despertar', () => {
	it('cada 5 min lanza fast.yml en main, si no espera ninguna pasada', async () => {
		const { llamadas } = github();
		const { lineas, log } = registro();
		expect(await despertar(FAST, { GH_DISPATCH_TOKEN: TOKEN }, log)).toEqual({ estado: 'lanzada', workflow: 'fast.yml' });
		// Mira la cola de todo main (en cola y pendientes) y después lanza.
		expect(llamadas.map((l) => `${l.method} ${l.path}`)).toEqual([
			`GET /repos/${REPO}/actions/runs?branch=main&status=queued&per_page=1&exclude_pull_requests=true`,
			`GET /repos/${REPO}/actions/runs?branch=main&status=pending&per_page=1&exclude_pull_requests=true`,
			`POST /repos/${REPO}/actions/workflows/fast.yml/dispatches`
		]);
		expect(llamadas[2].body).toEqual({ ref: 'main' });
		for (const l of llamadas) {
			expect(l.headers.Authorization).toBe(`Bearer ${TOKEN}`);
			expect(l.headers['User-Agent']).toBeTruthy();
			expect(l.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
		}
		expect(lineas).toEqual(['despertador: fast.yml lanzada en main']);
	});

	it('en los minutos 7, 22, 37 y 52 lanza deploy.yml, mirando solo las suyas', async () => {
		const { llamadas } = github();
		expect(await despertar(DEPLOY, { GH_DISPATCH_TOKEN: TOKEN }, () => {})).toEqual({
			estado: 'lanzada',
			workflow: 'deploy.yml'
		});
		expect(llamadas.map((l) => `${l.method} ${l.path}`)).toEqual([
			`GET /repos/${REPO}/actions/workflows/deploy.yml/runs?branch=main&status=queued&per_page=1&exclude_pull_requests=true`,
			`GET /repos/${REPO}/actions/workflows/deploy.yml/runs?branch=main&status=pending&per_page=1&exclude_pull_requests=true`,
			`POST /repos/${REPO}/actions/workflows/deploy.yml/dispatches`
		]);
		expect(llamadas[2].body).toEqual({ ref: 'main' });
	});

	it.each(ESPERANDO)('si ya espera una normal («%s»), no lanza ni la rápida ni otra normal', async (status) => {
		const { llamadas } = github({ esperan: [{ workflow: 'deploy.yml', status }] });
		const { lineas, log } = registro();
		expect(await despertar(FAST, { GH_DISPATCH_TOKEN: TOKEN }, log)).toEqual({ estado: 'esperando', workflow: 'fast.yml' });
		expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
		expect(lineas[0]).toContain('fast.yml no se lanza');
		expect(await despertar(DEPLOY, { GH_DISPATCH_TOKEN: TOKEN }, log)).toEqual({
			estado: 'esperando',
			workflow: 'deploy.yml'
		});
		expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
	});

	it.each(ESPERANDO)('si solo espera una rápida («%s»), la normal SÍ se lanza (la sustituye)', async (status) => {
		const { llamadas } = github({ esperan: [{ workflow: 'fast.yml', status }] });
		expect(await despertar(DEPLOY, { GH_DISPATCH_TOKEN: TOKEN }, () => {})).toEqual({
			estado: 'lanzada',
			workflow: 'deploy.yml'
		});
		expect(llamadas.at(-1)?.path).toBe(`/repos/${REPO}/actions/workflows/deploy.yml/dispatches`);
	});

	it.each(ESPERANDO)('si espera una normal («%s»), la rápida NO se lanza (no le quita el turno)', async (status) => {
		const { llamadas } = github({ esperan: [{ workflow: 'deploy.yml', status }] });
		expect(await despertar(FAST, { GH_DISPATCH_TOKEN: TOKEN }, () => {})).toEqual({
			estado: 'esperando',
			workflow: 'fast.yml'
		});
		// Lo ha visto en la cola de todo main, no en la de fast.yml (que está vacía).
		expect(llamadas.every((l) => l.path.startsWith(`/repos/${REPO}/actions/runs?`))).toBe(true);
	});

	it('sin token no llama a GitHub y lo dice claro', async () => {
		const { fn } = github();
		const { lineas, log } = registro();
		expect(await despertar(FAST, {}, log)).toEqual({ estado: 'sin-token' });
		expect(await despertar(FAST, { GH_DISPATCH_TOKEN: '  ' }, log)).toEqual({ estado: 'sin-token' });
		expect(fn).not.toHaveBeenCalled();
		expect(lineas[0]).toContain('falta el secret GH_DISPATCH_TOKEN');
		expect(lineas[0]).toContain('DESPERTADOR_GH_TOKEN');
	});

	it('un 401 de GitHub (token caducado) va al registro como error, con qué hacer, sin lanzar la pasada', async () => {
		const { llamadas } = github({ falla: { [`/repos/${REPO}/actions/runs`]: 401 } });
		const { lineas, log } = registro();
		const errores = registro();
		const r = await despertar(FAST, { GH_DISPATCH_TOKEN: TOKEN }, log, errores.log);
		expect(r).toMatchObject({ estado: 'error', workflow: 'fast.yml' });
		expect(lineas).toEqual([]);
		expect(errores.lineas[0]).toContain('HTTP 401 al mirar la cola');
		expect(errores.lineas[0]).toContain('caducado');
		expect(errores.lineas[0]).toContain('1 año');
		expect(errores.lineas[0]).toContain('herramienta «despertador»');
		expect(errores.lineas.join('\n')).not.toContain(TOKEN);
		expect(llamadas.some((l) => l.method === 'POST')).toBe(false);
	});

	it('un 404 al lanzar (token sin permiso) se registra; el token nunca sale en el registro', async () => {
		github({ falla: { [`/repos/${REPO}/actions/workflows/fast.yml/dispatches`]: 404 } });
		const { lineas, log } = registro();
		const errores = registro();
		const r = await despertar(FAST, { GH_DISPATCH_TOKEN: TOKEN }, log, errores.log);
		expect(r).toMatchObject({ estado: 'error', workflow: 'fast.yml' });
		expect(lineas[0]).toContain('HTTP 404 al lanzar fast.yml');
		expect(lineas[0]).toContain('Actions: lectura y escritura');
		expect(lineas.join('\n')).not.toContain(TOKEN);
		// Solo el 401 va como error: lo demás puede ser pasajero o de configuración y ya lo explica el texto.
		expect(errores.lineas).toEqual([]);
	});

	it('si GitHub no responde o se corta la red, lo registra y no lanza error', async () => {
		const { lineas, log } = registro();
		vi.stubGlobal('fetch', async () => {
			throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		});
		expect(await despertar(DEPLOY, { GH_DISPATCH_TOKEN: TOKEN }, log)).toMatchObject({ estado: 'error' });
		expect(lineas.at(-1)).toContain('no ha respondido en 15 s');
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('fetch failed');
		});
		expect(await despertar(DEPLOY, { GH_DISPATCH_TOKEN: TOKEN }, log)).toMatchObject({ estado: 'error' });
		expect(lineas.at(-1)).toContain('fetch failed');
	});

	it('un cron que no está en PASADAS no lanza nada', async () => {
		const { fn } = github();
		const { lineas, log } = registro();
		expect(await despertar('0 * * * *', { GH_DISPATCH_TOKEN: TOKEN }, log)).toEqual({
			estado: 'cron-desconocido',
			cron: '0 * * * *'
		});
		expect(fn).not.toHaveBeenCalled();
		expect(lineas[0]).toContain('cron desconocido');
	});
});

describe('motivo', () => {
	it('explica cada respuesta de GitHub', () => {
		expect(motivo(401)).toContain('DESPERTADOR_GH_TOKEN');
		expect(motivo(403)).toContain('Actions: lectura y escritura');
		expect(motivo(422)).toContain('workflow_dispatch');
		expect(motivo(429)).toContain('esperar');
		expect(motivo(502)).toContain('próxima');
	});
});

describe('scheduled', () => {
	it('el Worker hace lo de su cron y lo deja en el registro', async () => {
		const { llamadas } = github();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		await worker.scheduled({ cron: FAST }, { GH_DISPATCH_TOKEN: TOKEN });
		expect(llamadas.at(-1)?.path).toBe(`/repos/${REPO}/actions/workflows/fast.yml/dispatches`);
		expect(log).toHaveBeenCalledWith('despertador: fast.yml lanzada en main');
	});

	it('con el token caducado, el Worker lo deja como error (console.error), no como una línea más', async () => {
		github({ falla: { [`/repos/${REPO}/actions/workflows/deploy.yml/runs`]: 401 } });
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await worker.scheduled({ cron: DEPLOY }, { GH_DISPATCH_TOKEN: TOKEN });
		expect(error).toHaveBeenCalledOnce();
		expect(error.mock.calls[0][0]).toContain('HTTP 401');
		expect(log).not.toHaveBeenCalled();
	});
});

describe('wrangler.toml', () => {
	const toml = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');

	it('tiene los mismos crons que PASADAS, que nunca coinciden en el mismo minuto', () => {
		const crons = JSON.parse(toml.match(/^crons\s*=\s*(\[.*\])$/m)?.[1] ?? '[]');
		expect(crons).toEqual(Object.keys(PASADAS));
		// La rápida en múltiplos de 5; la normal, en 7, 22, 37 y 52 (ninguno lo es).
		expect(DEPLOY.split(' ')[0].split(',').every((m) => Number(m) % 5 !== 0)).toBe(true);
	});

	it('sin URL pública ni secretos', () => {
		expect(toml).toMatch(/^workers_dev = false$/m);
		expect(toml).toMatch(/^preview_urls = false$/m);
		expect(toml).not.toMatch(/^\s*(routes?|route)\s*=/m);
		expect(toml).not.toMatch(/GH_DISPATCH_TOKEN\s*=|ghp_|github_pat_/);
		expect(toml).toMatch(/^main = "worker.ts"$/m);
	});
});
