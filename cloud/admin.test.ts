import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { handleAdmin, memoryAdminStore, withEmail } from './admin.ts';
import { handlePrefs, memoryStore } from './prefs.ts';
import { AUD, ENV, part, TEAM, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const FULL = { ...ENV, ADMIN_EMAIL: 'jefe@x.es', CF_ACCESS_ADMIN_TOKEN: 'tok', CF_ACCOUNT_ID: 'acc' };

/** Una API de Cloudflare de mentira: una política reutilizable «Sergi» con dos emails y un dominio. */
function cloudflare() {
	const policy = {
		id: 'p1',
		name: 'Sergi',
		decision: 'allow',
		include: [{ email: { email: 'jefe@x.es' } }, { email: { email: 'ana@x.es' } }, { email_domain: { domain: 'casa.es' } }],
		exclude: [],
		require: []
	};
	const calls: { url: string; method: string; body?: unknown; auth: string | null }[] = [];
	const fetcher = async (url: string, init?: RequestInit) => {
		if (url.includes('cloudflareaccess.com')) return k.certs(url);
		const method = init?.method ?? 'GET';
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		calls.push({ url, method, body, auth: new Headers(init?.headers).get('authorization') });
		const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
		if (url.endsWith('/accounts/acc/access/policies') && method === 'GET') return ok([policy]);
		if (url.endsWith('/accounts/acc/access/policies/p1') && method === 'PUT') {
			Object.assign(policy, body);
			return ok(policy);
		}
		if (url.endsWith('/access/organizations/revoke_user')) return ok(true);
		return new Response('{"success":false}', { status: 404 });
	};
	return { policy, calls, fetcher };
}

async function call(
	env: Record<string, string>,
	store: ReturnType<typeof memoryAdminStore>,
	fetcher: (url: string, init?: RequestInit) => Promise<Response>,
	who: Record<string, unknown> | null,
	method = 'GET',
	body?: unknown,
	query = '',
	headers: Record<string, string> = {}
) {
	return handleAdmin(
		new Request(`https://arcterminal.dev/api/admin${query}`, {
			method,
			headers: {
				...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}),
				...(body ? { 'content-type': 'application/json' } : {}),
				...headers
			},
			body: body ? JSON.stringify(body) : undefined
		}),
		env,
		store,
		fetcher
	);
}

describe('/api/admin', () => {
	it('solo el admin: los demás, la Action y sin JWT no ven nada ni tocan Cloudflare', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		for (const who of [{ email: 'ana@x.es' }, { common_name: 'svc.access' }, null]) {
			const res = await call(FULL, store, cf.fetcher, who);
			expect([401, 403]).toContain(res.status);
			expect(await res.text()).not.toContain('ana@');
			const post = await call(FULL, store, cf.fetcher, who, 'POST', { action: 'invite', email: 'malo@x.es' });
			expect([401, 403]).toContain(post.status);
		}
		expect(cf.calls).toHaveLength(0);
		// Sin ADMIN_EMAIL, ni Sergi.
		const { ADMIN_EMAIL: _, ...noAdmin } = FULL;
		expect((await call(noAdmin, store, cf.fetcher, { email: 'jefe@x.es' })).status).toBe(403);
	});

	it('desde otra web, ni el admin: 403 sin tocar Cloudflare ni D1', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		const jefe = { email: 'jefe@x.es' };
		const malo = { origin: 'https://malo.example' };
		const remove = { action: 'remove', email: 'ana@x.es' };
		const post = await call(FULL, store, cf.fetcher, jefe, 'POST', remove, '', malo);
		expect(post.status).toBe(403);
		expect(await post.json()).toEqual({ error: 'origen' });
		expect((await call(FULL, store, cf.fetcher, jefe, 'GET', undefined, '', malo)).status).toBe(403);
		expect(cf.calls).toHaveLength(0);
		expect(store.rows).toHaveLength(1);
		// Desde la misma web, sí.
		const same = await call(FULL, store, cf.fetcher, jefe, 'GET', undefined, '', { origin: 'https://arcterminal.dev' });
		expect(same.status).toBe(200);
	});

	it('nunca por una cabecera suelta ni por un JWT sin firma, de otra app, de otra clave o caducado', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		const now = Math.floor(Date.now() / 1000);
		const claims = { email: 'jefe@x.es', aud: [AUD], iss: TEAM, exp: now + 3600 };
		const tokens = [
			`${part({ alg: 'none', typ: 'JWT' })}.${part(claims)}.`,
			`${part({ alg: 'RS256', kid: 'k1' })}.${part(claims)}.AAAA`,
			await k.sign({ email: 'jefe@x.es', aud: ['otra-app'] }),
			await k.sign({ email: 'jefe@x.es' }, k.other),
			await k.sign({ email: 'jefe@x.es', exp: now - 10 })
		];
		const headers: Record<string, string>[] = [
			{ 'cf-access-authenticated-user-email': 'jefe@x.es' },
			...tokens.map((t) => ({ 'cf-access-jwt-assertion': t })),
			...tokens.map((t) => ({ cookie: `CF_Authorization=${t}` }))
		];
		for (const h of headers) {
			for (const method of ['GET', 'POST']) {
				const res = await handleAdmin(
					new Request('https://arcterminal.dev/api/admin', {
						method,
						headers: { ...h, 'content-type': 'application/json' },
						body: method === 'POST' ? JSON.stringify({ action: 'remove', email: 'ana@x.es' }) : undefined
					}),
					FULL,
					store,
					cf.fetcher
				);
				expect(res.status).toBe(401);
				expect(await res.text()).not.toContain('ana@');
			}
		}
		expect(cf.calls).toHaveLength(0);
		expect(store.rows).toHaveLength(1);
	});

	it('?yo=1 solo dice si eres el admin, sin la lista ni llamar a Cloudflare', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		const me = await call(FULL, store, cf.fetcher, { email: 'jefe@x.es' }, 'GET', undefined, '?yo=1');
		expect(await me.json()).toEqual({ admin: true });
		expect((await call(FULL, store, cf.fetcher, { email: 'ana@x.es' }, 'GET', undefined, '?yo=1')).status).toBe(403);
		expect(cf.calls).toHaveLength(0);
	});

	it('lista: los de la política y los de D1, con último acceso y avisos', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([
			{ email: 'ana@x.es', seen: 5, alerts: true },
			{ email: 'viejo@x.es', seen: 1, alerts: false }
		]);
		const res = await call(FULL, store, cf.fetcher, { email: 'jefe@x.es' });
		const body = await res.json();
		expect(body.access).toBe('ok');
		expect(body.users).toEqual([
			{ email: 'ana@x.es', seen: 5, alerts: true, invited: true },
			{ email: 'viejo@x.es', seen: 1, alerts: false, invited: false },
			{ email: 'jefe@x.es', seen: null, alerts: false, invited: true }
		]);
		expect(cf.calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
	});

	it('sin token de Access: lista solo con D1 y no deja invitar', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		const env = { ...ENV, ADMIN_EMAIL: 'jefe@x.es' };
		const body = await (await call(env, store, cf.fetcher, { email: 'jefe@x.es' })).json();
		expect(body.access).toBe('sin token');
		expect(body.users).toHaveLength(1);
		expect((await call(env, store, cf.fetcher, { email: 'jefe@x.es' }, 'POST', { action: 'invite', email: 'b@x.es' })).status).toBe(503);
	});

	it('invitar añade el email a la política sin tocar las demás reglas', async () => {
		const cf = cloudflare();
		const res = await call(FULL, memoryAdminStore(), cf.fetcher, { email: 'jefe@x.es' }, 'POST', {
			action: 'invite',
			email: ' Luis@X.es '
		});
		expect(res.status).toBe(200);
		expect(cf.policy.include).toContainEqual({ email: { email: 'luis@x.es' } });
		expect(cf.policy.include).toContainEqual({ email_domain: { domain: 'casa.es' } });
		expect(cf.policy.include).toHaveLength(4);
	});

	it('quitar: fuera de la política, sesión cerrada y datos borrados; al admin no se le quita', async () => {
		const cf = cloudflare();
		const store = memoryAdminStore([{ email: 'ana@x.es', seen: 5, alerts: true }]);
		const res = await call(FULL, store, cf.fetcher, { email: 'jefe@x.es' }, 'POST', { action: 'remove', email: 'ana@x.es' });
		expect(res.status).toBe(200);
		expect(cf.policy.include).not.toContainEqual({ email: { email: 'ana@x.es' } });
		expect(cf.calls.some((c) => c.url.endsWith('revoke_user') && (c.body as { email: string }).email === 'ana@x.es')).toBe(true);
		expect(store.rows).toHaveLength(0);
		const self = await call(FULL, store, cf.fetcher, { email: 'jefe@x.es' }, 'POST', { action: 'remove', email: 'JEFE@x.es' });
		expect(self.status).toBe(400);
		expect(cf.policy.include).toContainEqual({ email: { email: 'jefe@x.es' } });
	});

	it('rechaza emails y acciones raros', async () => {
		const cf = cloudflare();
		for (const body of [
			{ action: 'invite', email: 'no-es-email' },
			{ action: 'invite', email: 'a@b' },
			{ action: 'borrar', email: 'a@b.es' }
		])
			expect((await call(FULL, memoryAdminStore(), cf.fetcher, { email: 'jefe@x.es' }, 'POST', body)).status).toBe(400);
		expect(cf.calls).toHaveLength(0);
	});

	it('withEmail no duplica', () => {
		const p = { id: '1', include: [{ email: { email: 'a@x.es' } }] };
		expect(withEmail(p, 'A@x.es', true).include).toHaveLength(1);
		expect(withEmail(p, 'a@x.es', false).include).toHaveLength(0);
	});

	it('/api/prefs apunta el último acceso de quien lee, y solo de él', async () => {
		const seen: string[] = [];
		const store = { ...memoryStore(), seen: async (u: string) => void seen.push(u) };
		const req = new Request('https://arcterminal.dev/api/prefs', {
			headers: { 'cf-access-jwt-assertion': await k.sign({ email: 'Ana@x.es' }) }
		});
		expect((await handlePrefs(req, ENV, store, k.certs)).status).toBe(200);
		expect(seen).toEqual(['ana@x.es']);
	});
});
