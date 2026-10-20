import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, pickAud, withoutAi } from '../cf-config.ts';

const TOML =
	'database_id = "__D1_DATABASE_ID__"\nACCESS_TEAM_DOMAIN = "__ACCESS_TEAM_DOMAIN__"\nACCESS_AUD = "__ACCESS_AUD__"\n';

describe('cf-config', () => {
	let dir: string;
	let path: string;
	let logs: string[];
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'cfc-'));
		path = join(dir, 'wrangler.toml');
		await writeFile(path, TOML);
		logs = [];
	});
	afterEach(() => rm(dir, { recursive: true, force: true }));

	const ok = (result: unknown) => Response.json({ success: true, result });
	const env = { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'acc' };

	it('pickAud: la aplicación que cubre el dominio de la web', () => {
		const apps = [
			{ aud: 'otra', domain: 'otra.example' },
			{ aud: 'buena', self_hosted_domains: ['arcterminal.dev', 'arc-terminal.pages.dev'] }
		];
		expect(pickAud(apps, 'arcterminal.dev')).toBe('buena');
		expect(pickAud([{ aud: 'w', domain: '*.arcterminal.dev' }], 'x.arcterminal.dev')).toBe('w');
		expect(pickAud(apps, 'nada.dev')).toBeNull();
	});

	it('crea la base si no existe, lee Access y rellena wrangler.toml sin escribir los valores en el registro', async () => {
		const calls: string[] = [];
		const fetcher = (async (url: string, init?: RequestInit) => {
			calls.push(`${init?.method ?? 'GET'} ${url}`);
			if (url.includes('/d1/database?name=')) return ok([]);
			if (url.endsWith('/d1/database')) return ok({ uuid: 'id-de-la-base' });
			if (url.endsWith('/access/organizations')) return ok({ auth_domain: 'equipo.cloudflareaccess.com' });
			if (url.endsWith('/access/apps')) return ok([{ aud: 'el-aud', domain: 'arcterminal.dev' }]);
			return new Response('', { status: 404 });
		}) as typeof fetch;
		expect(await main(env, fetcher, path, (l) => logs.push(l))).toBe(true);
		expect(calls).toContain(`POST https://api.cloudflare.com/client/v4/accounts/acc/d1/database`);
		expect(await readFile(path, 'utf8')).toBe(
			'database_id = "id-de-la-base"\nACCESS_TEAM_DOMAIN = "https://equipo.cloudflareaccess.com"\nACCESS_AUD = "el-aud"\n'
		);
		const visible = logs.filter((l) => !l.startsWith('::add-mask::'));
		for (const secret of ['id-de-la-base', 'el-aud', 'equipo']) expect(visible.join('\n')).not.toContain(secret);
		expect(logs).toContain('::add-mask::el-aud');
	});

	it('sin permisos: avisa, quita wrangler.toml y no falla', async () => {
		const fetcher = (async () => Response.json({ success: false }, { status: 403 })) as unknown as typeof fetch;
		expect(await main(env, fetcher, path, (l) => logs.push(l))).toBe(false);
		await expect(readFile(path, 'utf8')).rejects.toThrow();
		expect(logs.some((l) => l.includes('D1 · Edit'))).toBe(true);
	});

	it('las Variables de GitHub mandan y evitan la API de D1 y Access (solo se mira Workers AI)', async () => {
		const calls: string[] = [];
		const fetcher = (async (url: string) => {
			calls.push(url);
			throw new Error('sin red');
		}) as unknown as typeof fetch;
		const vars = { ...env, D1_DATABASE_ID: 'd', ACCESS_TEAM_DOMAIN: 'https://t.cloudflareaccess.com', ACCESS_AUD: 'a' };
		expect(await main(vars, fetcher, path, (l) => logs.push(l))).toBe(true);
		expect(calls).toEqual(['https://api.cloudflare.com/client/v4/accounts/acc/ai/models/search?per_page=1']);
	});

	describe('Workers AI (PREGUNTA)', () => {
		const AI = '\n# <ai>\n[ai]\nbinding = "AI"\n# </ai>\n';
		const vars = { ...env, D1_DATABASE_ID: 'd', ACCESS_TEAM_DOMAIN: 'https://t.cloudflareaccess.com', ACCESS_AUD: 'a' };
		beforeEach(() => writeFile(path, TOML + AI));

		it('si el token llega a Workers AI, deja el bloque [ai]', async () => {
			const fetcher = (async (url: string) =>
				url.includes('/ai/models/search') ? ok([{ name: 'm' }]) : new Response('', { status: 404 })) as unknown as typeof fetch;
			expect(await main(vars, fetcher, path, (l) => logs.push(l))).toBe(true);
			expect(await readFile(path, 'utf8')).toContain('[ai]\nbinding = "AI"');
			expect(logs).toContain('PREGUNTA: Workers AI listo');
		});

		it('si no llega, quita el bloque, lo dice y publica igual', async () => {
			const fetcher = (async () => Response.json({ success: false }, { status: 403 })) as unknown as typeof fetch;
			expect(await main(vars, fetcher, path, (l) => logs.push(l))).toBe(true);
			const toml = await readFile(path, 'utf8');
			expect(toml).not.toContain('[ai]');
			expect(toml).toContain('ACCESS_AUD = "a"');
			expect(logs.some((l) => l.includes('Workers AI · Read'))).toBe(true);
		});

		it('withoutAi solo quita lo que va entre las marcas', () => {
			expect(withoutAi(`a = 1${AI}b = 2\n`)).toBe('a = 1\nb = 2\n');
			expect(withoutAi(TOML)).toBe(TOML);
		});
	});
});
