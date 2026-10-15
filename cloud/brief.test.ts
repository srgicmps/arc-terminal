import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/lib/alertconfig.ts';
import { clearKeyCache } from './access.ts';
import { handleBrief, memoryBriefStore } from './brief.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const BREVO = { ...ENV, BREVO_API_KEY: 'clave', BREVO_SENDER: 'avisos@arcterminal.dev' };
const A = 'a'.repeat(16);
const B = 'b'.repeat(16);
const row = (uid: string, brief: object) => ({
	uid,
	topic: `arc-${'c'.repeat(32)}`,
	config: parseConfig({ on: true, brief: { on: true, ...brief } })
});

function setup(env: Record<string, string> = BREVO) {
	const store = memoryBriefStore({
		[A]: { user: 'ana@x.es', row: row(A, { email: true }) },
		[B]: { user: 'luis@x.es', row: row(B, { email: false }) }
	});
	const mails: { to: string; subject: string; text: string; key: string | null }[] = [];
	const fetcher = async (url: string, init?: RequestInit) => {
		if (url === 'https://api.brevo.com/v3/smtp/email') {
			const b = JSON.parse(String(init?.body));
			mails.push({ to: b.to[0].email, subject: b.subject, text: b.textContent, key: new Headers(init?.headers).get('api-key') });
			return new Response('{}', { status: 201 });
		}
		return k.certs(url);
	};
	const call = async (who: Record<string, unknown> | null, body: unknown = { mails: [] }, method = 'POST') =>
		handleBrief(
			new Request('https://arcterminal.dev/api/brief', {
				method,
				headers: { ...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}), 'content-type': 'application/json' },
				body: method === 'POST' ? JSON.stringify(body) : undefined
			}),
			env,
			store,
			fetcher,
			Date.parse('2026-10-14T06:10:00Z')
		);
	return { store, mails, call };
}

const SVC = { common_name: 'svc.access' };
const both = { mails: [A, B].map((uid) => ({ uid, subject: 'Tu mañana', text: '1. Hola' })) };

describe('/api/brief', () => {
	it('solo a quien lo pidió por email, una vez al día, y la respuesta no lleva emails', async () => {
		const { mails, call } = setup();
		const res = await call(SVC, both);
		const text = await res.text();
		expect(res.status).toBe(200);
		expect(text).not.toContain('@');
		expect(JSON.parse(text)).toEqual({ sent: 1 });
		expect(mails).toHaveLength(1);
		expect(mails[0]).toMatchObject({ to: 'ana@x.es', subject: 'Tu mañana', key: 'clave' });
		expect(mails[0].text).toContain('/avisos');
		expect(await (await call(SVC, both)).json()).toEqual({ sent: 0 });
		expect(mails).toHaveLength(1);
	});

	it('una persona no puede mandar emails, ni sin JWT', async () => {
		const { mails, call } = setup();
		expect((await call({ email: 'ana@x.es' }, both)).status).toBe(403);
		expect((await call(null, both)).status).toBe(401);
		expect((await call(SVC, undefined, 'GET')).status).toBe(403);
		expect(mails).toHaveLength(0);
	});

	it('sin Brevo: 503 y nada', async () => {
		const { mails, call } = setup({ ...ENV });
		expect((await call(SVC, both)).status).toBe(503);
		expect(mails).toHaveLength(0);
	});

	it('uids raros o desconocidos se ignoran', async () => {
		const { mails, call } = setup();
		const res = await call(SVC, { mails: [{ uid: "' OR 1=1", subject: 'x', text: 'x' }, { uid: 'f'.repeat(16), subject: 'x', text: 'x' }] });
		expect(await res.json()).toEqual({ sent: 0 });
		expect(mails).toHaveLength(0);
	});
});
