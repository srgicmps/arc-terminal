import { describe, expect, it, vi } from 'vitest';
import { disablePush, enablePush, keyBytes, pushSupport, sameKey, testPush } from './webpush.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const KEY = 'BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs';

describe('pushSupport', () => {
	it('con PushManager, sí; en el iPhone sin instalar, que la instale; si no, no', () => {
		expect(pushSupport({ push: true, ua: FIREFOX, standalone: false, touchPoints: 0 })).toBe('ok');
		expect(pushSupport({ push: true, ua: IPHONE, standalone: true, touchPoints: 5 })).toBe('ok');
		expect(pushSupport({ push: false, ua: IPHONE, standalone: false, touchPoints: 5 })).toBe('install');
		// Instalada pero sin PushManager: un iOS anterior al 16.4.
		expect(pushSupport({ push: false, ua: IPHONE, standalone: true, touchPoints: 5 })).toBe('no');
		expect(pushSupport({ push: false, ua: FIREFOX, standalone: false, touchPoints: 0 })).toBe('no');
	});
});

describe('keyBytes y sameKey', () => {
	it('la clave pública VAPID: 65 bytes, empieza por 0x04', () => {
		const b = keyBytes(KEY);
		expect(b.length).toBe(65);
		expect(b[0]).toBe(4);
	});
	it('reconoce la suscripción hecha con la misma clave, no con otra', () => {
		expect(sameKey(keyBytes(KEY).buffer, KEY)).toBe(true);
		const other = keyBytes(KEY);
		other[10] ^= 1;
		expect(sameKey(other.buffer, KEY)).toBe(false);
		expect(sameKey(null, KEY)).toBe(false);
	});
});

describe('enablePush, testPush y disablePush (con un navegador de mentira)', () => {
	const API = '/api/push';
	const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/x';

	/** Un navegador con permiso `permission` y, si se da, una suscripción ya hecha con la clave `subKey`. */
	function browser(permission: NotificationPermission, subKey?: Uint8Array<ArrayBuffer>, status = 200) {
		const steps: string[] = [];
		const sub = (key: Uint8Array<ArrayBuffer>) => ({
			endpoint: ENDPOINT,
			options: { applicationServerKey: key.buffer },
			toJSON: () => ({ endpoint: ENDPOINT, keys: {} }),
			unsubscribe: async () => (steps.push('unsubscribe'), true)
		});
		let current = subKey ? sub(subKey) : null;
		const pushManager = {
			getSubscription: async () => current,
			subscribe: async (o: { applicationServerKey: Uint8Array<ArrayBuffer> }) => {
				steps.push(`subscribe ${o.applicationServerKey.length}`);
				return (current = sub(o.applicationServerKey));
			}
		};
		const reg = { pushManager };
		vi.stubGlobal('Notification', { requestPermission: async () => (steps.push('permiso'), permission) });
		vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(reg), getRegistration: async () => reg } });
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				steps.push(`${init?.method} ${url} ${String(init?.body ?? '')}`.trim());
				return Response.json({}, { status });
			})
		);
		return steps;
	}

	it('pide el permiso lo primero; sin él, ni se suscribe ni llama a la cuenta', async () => {
		const steps = browser('denied');
		expect(await enablePush(API, KEY)).toBe('denied');
		expect(steps).toEqual(['permiso']);
	});

	it('con permiso: se suscribe con la clave y lo guarda en la cuenta', async () => {
		const steps = browser('granted');
		expect(await enablePush(API, KEY)).toBe('ok');
		expect(steps).toEqual(['permiso', 'subscribe 65', `PUT ${API} {"endpoint":"${ENDPOINT}","keys":{}}`]);
	});

	it('una suscripción hecha con otra clave (se cambió la VAPID) se rehace', async () => {
		const other = keyBytes(KEY);
		other[5] ^= 1;
		const steps = browser('granted', other);
		expect(await enablePush(API, KEY)).toBe('ok');
		expect(steps.slice(0, 3)).toEqual(['permiso', 'unsubscribe', 'subscribe 65']);
	});

	it('si la cuenta no la acepta (400), no es compatible y se deshace aquí', async () => {
		const steps = browser('granted', undefined, 400);
		expect(await enablePush(API, KEY)).toBe('unsupported');
		expect(steps.at(-1)).toBe('unsubscribe');
	});

	it('probar y quitar mandan el endpoint en el cuerpo, nunca en la URL', async () => {
		const steps = browser('granted', keyBytes(KEY));
		expect(await testPush(API)).toBe(true);
		await disablePush(API);
		expect(steps).toEqual([
			`POST ${API}?test=1 {"endpoint":"${ENDPOINT}"}`,
			`DELETE ${API} {"endpoint":"${ENDPOINT}"}`,
			'unsubscribe'
		]);
	});

	it('sin suscripción, probar da false y quitar no hace nada', async () => {
		const steps = browser('granted');
		expect(await testPush(API)).toBe(false);
		await disablePush(API);
		expect(steps).toEqual([]);
	});
});
