// Avisos en este navegador (Web Push), para la fila «En este dispositivo» de AVISOS (PushDevice.svelte).
// Habla con /api/push (cloud/push.ts), que guarda la suscripción en la cuenta, y con el service worker, que es
// quien enseña los avisos (src/service-worker/push.ts). Se suma a ntfy: no lo sustituye.
// El endpoint de la suscripción es secreto (quien lo tenga puede mandar a este navegador con la clave): solo
// viaja en el cuerpo de las peticiones a /api/push, nunca en una URL ni en localStorage.
import { installPlatform } from './install.ts';

/** ok: puede recibirlos. install: iPhone sin instalar la web (solo funciona instalada). no: este navegador no. */
export type PushSupport = 'ok' | 'install' | 'no';

/**
 * ¿Puede este navegador recibir avisos? `push`: tiene service worker, PushManager y Notification. En el iPhone,
 * Safari solo da PushManager a la web instalada en la pantalla de inicio (iOS 16.4 o posterior).
 */
export function pushSupport(env: { push: boolean; ua: string; standalone: boolean; touchPoints: number }): PushSupport {
	if (env.push) return 'ok';
	return installPlatform(env.ua, env.standalone, env.touchPoints) === 'ios' ? 'install' : 'no';
}

/** La clave pública VAPID (base64url) en bytes, como la pide pushManager.subscribe(). */
export function keyBytes(key: string): Uint8Array<ArrayBuffer> {
	const b64 = key.replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/** ¿La suscripción se hizo con esta clave? Si se cambia la clave VAPID, las viejas ya no valen. */
export function sameKey(serverKey: ArrayBuffer | null | undefined, key: string): boolean {
	if (!serverKey) return false;
	const a = new Uint8Array(serverKey);
	const b = keyBytes(key);
	return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Una llamada a /api/push: el código y el JSON (o {} si no hay). */
export async function pushApi(url: string, method = 'GET', body?: unknown, query = '') {
	const res = await fetch(url + query, {
		method,
		cache: 'no-store',
		redirect: 'manual',
		headers: body ? { 'content-type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined
	});
	const json = res.headers.get('content-type')?.includes('application/json') ? ((await res.json()) as Record<string, unknown>) : {};
	return { status: res.status, body: json };
}

/** El service worker activo, sin esperar para siempre si no hay (en local, por ejemplo). */
async function worker(): Promise<ServiceWorkerRegistration> {
	const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sin service worker')), 10_000));
	return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** La suscripción de este navegador, si la hay. */
export async function currentSub(): Promise<PushSubscription | null> {
	const reg = await navigator.serviceWorker?.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Activa los avisos aquí: pide el permiso (tiene que ser lo primero, justo tras el toque: si no, Safari no lo
 * enseña), se suscribe con la clave y lo guarda en la cuenta.
 */
export async function enablePush(url: string, key: string): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'denied';
	try {
		const reg = await worker();
		let sub = await reg.pushManager.getSubscription();
		if (sub && !sameKey(sub.options.applicationServerKey, key)) {
			// También de la cuenta: con la clave cambiada, el servicio de push da 403 (no 404/410) y nunca se borraría.
			await pushApi(url, 'DELETE', { endpoint: sub.endpoint }).catch(() => null);
			await sub.unsubscribe();
			sub = null;
		}
		sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
		const { status } = await pushApi(url, 'PUT', sub.toJSON());
		if (status === 200) return 'ok';
		// 400: la cuenta no la acepta (un servicio de push que no conocemos). No sirve de nada tenerla aquí.
		if (status === 400) {
			await sub.unsubscribe().catch(() => false);
			return 'unsupported';
		}
		return 'error';
	} catch {
		return 'error';
	}
}

/** Lo quita de la cuenta y de este navegador. */
export async function disablePush(url: string): Promise<void> {
	const sub = await currentSub();
	if (!sub) return;
	await pushApi(url, 'DELETE', { endpoint: sub.endpoint }).catch(() => null);
	await sub.unsubscribe().catch(() => false);
}

/** Un aviso de prueba a este navegador. true si el servicio de push lo ha aceptado. */
export async function testPush(url: string): Promise<boolean> {
	const sub = await currentSub();
	if (!sub) return false;
	return (await pushApi(url, 'POST', { endpoint: sub.endpoint }, '?test=1')).status === 200;
}
