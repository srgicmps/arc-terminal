import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { memoryAlertStore } from './alerts.ts';
import { cleanName, FAMILY_LIMITS, handleFamily, memoryFamilyStore } from './family.ts';
import { parseConfig } from '../src/lib/alertconfig.ts';
import { memoryPushStore } from './push.ts';
import { ENV, testKeys } from './testkeys.ts';
import { generateVapid } from './webpush.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

type Sent = { url: string; init?: RequestInit };

function setup() {
	const store = memoryFamilyStore();
	const alerts = memoryAlertStore();
	const sent: Sent[] = [];
	const push = async (url: string, init?: RequestInit) => (sent.push({ url, init }), new Response('ok'));
	const call = async (email: string | null, method = 'GET', body?: unknown, extra: Record<string, unknown> = {}) =>
		handleFamily(
			new Request('https://arcterminal.dev/api/family', {
				method,
				headers: {
					...(email ? { 'cf-access-jwt-assertion': await k.sign({ email, ...extra }) } : {}),
					...(body ? { 'content-type': 'application/json' } : {})
				},
				body: body ? JSON.stringify(body) : undefined
			}),
			ENV,
			store,
			alerts,
			k.certs,
			push
		);
	const avisos = (user: string, on = true) =>
		alerts.put(user, { uid: user, topic: on ? `arc-tema-${user}` : null, config: parseConfig({ on }) });
	return { store, alerts, sent, call, avisos };
}

describe('/api/family', () => {
	it('solo salen quienes aceptan y tienen avisos; nunca emails ni temas; uno mismo, tampoco', async () => {
		const { call, avisos } = setup();
		await avisos('ana@x.es');
		await avisos('luis@x.es');
		await call('ana@x.es', 'PUT', { name: 'Ana', accept: true });
		await call('luis@x.es', 'PUT', { name: 'Luis', accept: false });
		await call('eva@x.es', 'PUT', { name: 'Eva', accept: true }); // sin avisos
		const body = await (await call('luis@x.es')).json();
		expect(body.people.map((p: { name: string }) => p.name)).toEqual(['Ana']);
		const text = JSON.stringify(body);
		expect(text).not.toContain('@');
		expect(text).not.toContain('arc-tema');
		expect((await (await call('ana@x.es')).json()).people).toEqual([]);
	});

	it('manda al tema del otro, con el nombre de quien lo manda y el enlace al pulsar', async () => {
		const { call, avisos, sent } = setup();
		await avisos('ana@x.es');
		await call('ana@x.es', 'PUT', { name: 'Ana', accept: true });
		await call('luis@x.es', 'PUT', { name: 'Papá', accept: false });
		const [ana] = (await (await call('luis@x.es')).json()).people;
		const res = await call('luis@x.es', 'POST', { to: ana.id, title: 'La Fed baja tipos', url: 'https://bbc.com/a' });
		expect(res.status).toBe(200);
		expect(sent).toHaveLength(1);
		expect(sent[0].url).toBe('https://ntfy.sh/arc-tema-ana%40x.es');
		const h = sent[0].init!.headers as Record<string, string>;
		expect(h.click).toBe('https://bbc.com/a');
		expect(h.title).toMatch(/^=\?UTF-8\?B\?/); // «Papá» no es ASCII
		expect(sent[0].init!.body).toBe('La Fed baja tipos');
	});

	it('no manda: sin nombre, a quien no acepta, enlaces raros, sin cuenta o por encima del tope', async () => {
		const { call, avisos, sent, store } = setup();
		await avisos('ana@x.es');
		await avisos('luis@x.es');
		await store.put('luis@x.es', { id: 'luis1', name: 'Luis', accept: false });
		await store.put('ana@x.es', { id: 'ana1', name: 'Ana', accept: true });
		const ok = { to: 'ana1', title: 'Hola', url: 'https://x.es/' };
		expect((await call('eva@x.es', 'POST', ok)).status).toBe(409);
		expect((await call('ana@x.es', 'POST', { ...ok, to: 'luis1' })).status).toBe(404);
		expect((await call('ana@x.es', 'POST', { ...ok, to: 'ana1' })).status).toBe(404);
		expect((await call('luis@x.es', 'POST', { ...ok, url: 'javascript:alert(1)' })).status).toBe(400);
		expect((await call(null, 'POST', ok)).status).toBe(401);
		expect((await call('svc', 'GET', undefined, { email: undefined, common_name: 'action' })).status).toBe(403);
		for (let i = 0; i < FAMILY_LIMITS.perDay; i++) expect((await call('luis@x.es', 'POST', ok)).status).toBe(200);
		expect((await call('luis@x.es', 'POST', ok)).status).toBe(429);
		expect(sent).toHaveLength(FAMILY_LIMITS.perDay);
	});

	it('si el otro tiene avisos en el navegador, también le llega ahí; basta con que llegue por uno de los dos', async () => {
		const store = memoryFamilyStore();
		const alerts = memoryAlertStore();
		const pushes = memoryPushStore();
		const keys = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
		const browser = 'https://fcm.googleapis.com/fcm/send/ana';
		await pushes.put('ana@x.es', { endpoint: browser, ...keys }, 1, 5);
		await alerts.put('ana@x.es', { uid: 'ana', topic: 'arc-tema-ana', config: parseConfig({ on: true }) });
		await store.put('ana@x.es', { id: 'ana1', name: 'Ana', accept: true });
		await store.put('luis@x.es', { id: 'luis1', name: 'Luis', accept: false });
		const env = { ...ENV, VAPID_PRIVATE_KEY: JSON.stringify((await generateVapid()).jwk) };
		let ntfyUp = true;
		const sent: string[] = [];
		const push = async (url: string) => (sent.push(url), new Response(null, { status: url.includes('ntfy') && !ntfyUp ? 500 : 201 }));
		const send = async () =>
			handleFamily(
				new Request('https://arcterminal.dev/api/family', {
					method: 'POST',
					headers: { 'cf-access-jwt-assertion': await k.sign({ email: 'luis@x.es' }), 'content-type': 'application/json' },
					body: JSON.stringify({ to: 'ana1', title: 'La Fed baja tipos', url: 'https://bbc.com/a' })
				}),
				env,
				store,
				alerts,
				k.certs,
				push,
				Date.now(),
				pushes
			);
		expect((await send()).status).toBe(200);
		expect(sent.sort()).toEqual([browser, 'https://ntfy.sh/arc-tema-ana']);
		ntfyUp = false;
		expect((await send()).status).toBe(200);
		await pushes.drop(browser);
		expect((await send()).status).toBe(502);
	});

	it('el nombre va limpio y con tope', () => {
		expect(cleanName('  Ana\n‮María  ')).toBe('Ana María');
		expect(cleanName('x'.repeat(99))).toHaveLength(FAMILY_LIMITS.name);
		expect(cleanName(3)).toBe('');
	});
});
