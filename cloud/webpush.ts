// Web Push sin librerías: lo que hace falta para mandar un aviso a un navegador (Chrome, Firefox, Safari, Edge)
// desde una Pages Function, solo con WebCrypto (igual en Cloudflare y en Node, para los tests).
// - VAPID (RFC 8292): cada envío lleva un JWT ES256 firmado con nuestra clave privada. El servicio de push del
//   navegador lo comprueba con la clave pública que el navegador recibió al suscribirse.
// - Cifrado (RFC 8291 + RFC 8188, «aes128gcm»): el aviso viaja cifrado para ese navegador. Solo él puede leerlo:
//   ni Google, ni Mozilla ni Apple ven el texto. ECDH P-256 → HKDF → AES-128-GCM, con una clave efímera por aviso.
// La clave es un JWK EC P-256 (Secret de Pages VAPID_PRIVATE_KEY, lo genera scripts/vapid.ts). Lleva dentro la
// parte pública (x, y), así que de ahí sale también la clave pública que necesita la página: no hay que guardarla
// en ningún otro sitio. El vector de prueba de RFC 8291 está en webpush.test.ts.

/** Uint8Array sobre un ArrayBuffer normal: lo que pide WebCrypto en TypeScript. */
type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();

export const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

/** De base64url (o base64 normal) a bytes. Lanza si no es base64. */
export const fromB64url = (s: string): Bytes =>
	Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')), (c) => c.charCodeAt(0));

function concat(...parts: Uint8Array[]): Bytes {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

/** Nuestra clave VAPID, lista para firmar, y su parte pública (65 bytes, punto sin comprimir). */
export interface Vapid {
	key: CryptoKey;
	publicRaw: Bytes;
	/** La pública en base64url: la que se da a pushManager.subscribe() y va en «k=». */
	public: string;
}

/**
 * Lee el Secret (un JWK EC P-256 privado: kty, crv, d, x, y). null si falta o no vale: entonces /api/push
 * responde 503 y la web sigue igual, solo con ntfy.
 */
export async function parseVapid(secret: string | undefined): Promise<Vapid | null> {
	if (!secret?.trim()) return null;
	try {
		const jwk = JSON.parse(secret) as JsonWebKey;
		if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.x || !jwk.y) return null;
		const publicRaw = concat(new Uint8Array([4]), fromB64url(jwk.x), fromB64url(jwk.y));
		if (publicRaw.length !== 65) return null;
		const key = await crypto.subtle.importKey(
			'jwk',
			{ kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y },
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['sign']
		);
		return { key, publicRaw, public: b64url(publicRaw) };
	} catch {
		return null;
	}
}

/** Un par de claves VAPID nuevo: el JWK privado (para el Secret) y la pública. Lo usa scripts/vapid.ts. */
export async function generateVapid(): Promise<{ jwk: JsonWebKey; public: string }> {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	const { kty, crv, d, x, y } = await crypto.subtle.exportKey('jwk', pair.privateKey);
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	return { jwk: { kty, crv, d, x, y }, public: b64url(raw) };
}

/** El JWT dura 12 horas: RFC 8292 pide como mucho 24, y Apple rechaza los que se pasan. */
export const VAPID_TTL = 12 * 3600;

/**
 * El JWT de VAPID para un servicio de push: aud = su origen (https://fcm.googleapis.com…), exp y sub, que es la
 * dirección de la web (nunca un email: el repo es público). Firma ES256: WebCrypto ya la da en el formato de JWT
 * (r‖s, 64 bytes), no en DER.
 */
export async function vapidJwt(vapid: Vapid, audience: string, subject: string, now = Date.now()): Promise<string> {
	const part = (o: object) => b64url(enc.encode(JSON.stringify(o)));
	const body = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: audience, exp: Math.floor(now / 1000) + VAPID_TTL, sub: subject })}`;
	const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.key, enc.encode(body));
	return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** HKDF-SHA-256 de `length` bytes. */
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Las claves de un navegador suscrito: p256dh (65 bytes) y auth (16), tal como las da PushSubscription.toJSON(). */
export interface PushKeys {
	p256dh: string;
	auth: string;
}

/** Para los tests (el vector de RFC 8291): la clave efímera y la sal fijas. En producción, aleatorias. */
export interface Fixed {
	pair: CryptoKeyPair;
	salt: Bytes;
}

/** Tamaño del registro: el aviso va en uno solo, así que basta con que quepa (RFC 8291, sección 4). */
const RS = 4096;
/** Lo que cabe del aviso: 4096 menos la cabecera (86), el delimitador (1) y la etiqueta de AES-GCM (16). */
export const MAX_PLAINTEXT = 3993;

/**
 * Cifra un aviso para un navegador (RFC 8291). Devuelve el cuerpo entero: cabecera (sal, tamaño de registro y
 * nuestra clave pública efímera) y el texto cifrado.
 */
export async function encrypt(plaintext: Uint8Array, keys: PushKeys, fixed?: Fixed): Promise<Bytes> {
	if (plaintext.length > MAX_PLAINTEXT) throw new Error('aviso demasiado largo');
	const uaPublic = fromB64url(keys.p256dh);
	const auth = fromB64url(keys.auth);
	if (uaPublic.length !== 65 || uaPublic[0] !== 4 || auth.length !== 16) throw new Error('claves no válidas');

	const pair =
		fixed?.pair ??
		((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
	const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, pair.privateKey, 256));

	// IKM = HKDF(sal = auth, ecdh, "WebPush: info" ‖ 0 ‖ ua_public ‖ as_public).
	const ikm = await hkdf(auth, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
	const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
	const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

	// Un solo registro: el texto y el delimitador 0x02 («último registro»), sin relleno.
	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2])));

	const header = new Uint8Array(21);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, RS);
	header[20] = asPublic.length;
	return concat(header, asPublic, new Uint8Array(sealed));
}

/** Urgencia (RFC 8030) según el nivel del aviso: el móvil despierta antes para lo urgente. */
export const URGENCY = { 1: 'high', 2: 'normal', 3: 'normal', 4: 'low' } as const;

export interface PushOptions {
	/** Segundos que el servicio de push lo guarda si el dispositivo está apagado. */
	ttl: number;
	urgency: 'very-low' | 'low' | 'normal' | 'high';
	/** sub del JWT: la dirección de la web. */
	subject: string;
	now?: number;
}

/**
 * La petición para mandar `payload` a una suscripción: URL (el endpoint) e init de fetch. `jwts` guarda el JWT
 * por servicio de push, para firmar uno solo por petición aunque haya varios dispositivos en el mismo.
 */
export async function pushRequest(
	endpoint: string,
	keys: PushKeys,
	payload: string,
	vapid: Vapid,
	options: PushOptions,
	jwts: Map<string, string> = new Map(),
	fixed?: Fixed
): Promise<RequestInit> {
	const audience = new URL(endpoint).origin;
	let jwt = jwts.get(audience);
	if (!jwt) {
		jwt = await vapidJwt(vapid, audience, options.subject, options.now);
		jwts.set(audience, jwt);
	}
	return {
		method: 'POST',
		headers: {
			authorization: `vapid t=${jwt}, k=${vapid.public}`,
			'content-encoding': 'aes128gcm',
			'content-type': 'application/octet-stream',
			ttl: String(Math.max(0, Math.round(options.ttl))),
			urgency: options.urgency
		},
		body: await encrypt(enc.encode(payload), keys, fixed)
	};
}
