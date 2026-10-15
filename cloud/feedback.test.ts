import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { handleFeedback, isAdmin, memoryFeedbackStore } from './feedback.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const ADMIN = { ...ENV, ADMIN_EMAIL: 'Jefe@X.es', NTFY_TOPIC: 'tema-secreto' };

function setup(env: Record<string, string> = ADMIN) {
	const store = memoryFeedbackStore();
	const sent: { url: string; init?: RequestInit }[] = [];
	const fetcher = async (url: string, init?: RequestInit) => {
		if (url.startsWith('https://ntfy.sh/')) {
			sent.push({ url, init });
			return new Response('{}');
		}
		return k.certs(url);
	};
	const call = async (who: Record<string, unknown> | null, method = 'GET', body?: unknown, query = '', headers = {}) =>
		handleFeedback(
			new Request(`https://arcterminal.dev/api/feedback${query}`, {
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
	return { store, sent, call };
}

describe('/api/feedback', () => {
	it('guarda quién, vista, texto y fecha, y avisa a Sergi sin el email entero', async () => {
		const { store, sent, call } = setup();
		const res = await call({ email: 'Ana@X.es' }, 'POST', { view: '/eco', text: '  El gráfico no carga ' });
		expect(res.status).toBe(200);
		expect(store.rows).toHaveLength(1);
		expect(store.rows[0]).toMatchObject({ user: 'ana@x.es', view: '/eco', text: 'El gráfico no carga' });
		expect(sent).toHaveLength(1);
		expect(sent[0].url).toBe('https://ntfy.sh/tema-secreto');
		expect(String(sent[0].init?.body)).toBe('ana: El gráfico no carga');
		expect(String(sent[0].init?.body)).not.toContain('@');
	});

	it('sin NTFY_TOPIC se guarda igual y no avisa', async () => {
		const { store, sent, call } = setup({ ...ENV, ADMIN_EMAIL: 'jefe@x.es' });
		expect((await call({ email: 'ana@x.es' }, 'POST', { view: '/', text: 'hola' })).status).toBe(200);
		expect(store.rows).toHaveLength(1);
		expect(sent).toHaveLength(0);
	});

	it('rechaza vacío, demasiado largo, vista rara y más de 20 al día', async () => {
		const { store, call } = setup();
		expect((await call({ email: 'ana@x.es' }, 'POST', { text: '   ' })).status).toBe(400);
		expect((await call({ email: 'ana@x.es' }, 'POST', { text: 'x'.repeat(2001) })).status).toBe(413);
		await call({ email: 'ana@x.es' }, 'POST', { view: 'javascript:alert(1)', text: 'a' });
		expect(store.rows[0].view).toBe('/');
		for (let i = 0; i < 19; i++) await call({ email: 'ana@x.es' }, 'POST', { text: `n${i}` });
		expect((await call({ email: 'ana@x.es' }, 'POST', { text: 'una más' })).status).toBe(429);
		// El tope es por persona.
		expect((await call({ email: 'luis@x.es' }, 'POST', { text: 'mía' })).status).toBe(200);
	});

	it('solo el administrador lee y borra; nadie más, ni la Action', async () => {
		const { store, call } = setup();
		await call({ email: 'ana@x.es' }, 'POST', { view: '/fuel', text: 'secreto de Ana' });
		for (const who of [{ email: 'ana@x.es' }, { email: 'luis@x.es' }, { common_name: 'svc.access' }]) {
			const res = await call(who);
			expect(res.status).toBe(403);
			expect(await res.text()).not.toContain('secreto');
		}
		const res = await call({ email: 'jefe@x.es' });
		expect(res.status).toBe(200);
		const { items } = await res.json();
		expect(items[0]).toMatchObject({ user: 'ana@x.es', view: '/fuel', text: 'secreto de Ana' });
		expect((await call({ email: 'ana@x.es' }, 'DELETE', undefined, `?id=${items[0].id}`)).status).toBe(403);
		expect((await call({ email: 'jefe@x.es' }, 'DELETE', undefined, `?id=${items[0].id}`)).status).toBe(200);
		expect(store.rows).toHaveLength(0);
	});

	it('sin ADMIN_EMAIL nadie es administrador', async () => {
		const { call } = setup({ ...ENV });
		expect((await call({ email: 'jefe@x.es' })).status).toBe(403);
		expect(isAdmin('jefe@x.es', { ...ENV, ADMIN_EMAIL: '  ' })).toBe(false);
	});

	it('sin JWT, firmado por otra clave o desde otro origen: fuera', async () => {
		const { store, call } = setup();
		expect((await call(null, 'POST', { text: 'a' })).status).toBe(401);
		const forged = await k.sign({ email: 'jefe@x.es' }, k.other);
		const res = await handleFeedback(
			new Request('https://arcterminal.dev/api/feedback', { headers: { 'cf-access-jwt-assertion': forged } }),
			ADMIN,
			store,
			k.certs
		);
		expect(res.status).toBe(401);
		const cross = await call({ email: 'ana@x.es' }, 'POST', { text: 'a' }, '', { origin: 'https://malo.example' });
		expect(cross.status).toBe(403);
		expect(store.rows).toHaveLength(0);
	});
});
