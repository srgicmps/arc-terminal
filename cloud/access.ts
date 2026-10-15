// Quién hace la petición, según Cloudflare Access. Access pone delante de la web un login por código al
// email y, en cada petición, manda un JWT firmado (cabecera Cf-Access-Jwt-Assertion, o la cookie
// CF_Authorization). Aquí se VERIFICA ese JWT con las claves públicas del equipo de Access: firma RS256,
// audiencia (el AUD de la aplicación), emisor y caducidad. Nunca nos fiamos de una cabecera de email suelta.
// Sin dependencias: WebCrypto, que tienen igual Cloudflare y Node (los tests).

export interface AccessConfig {
	/** «https://<equipo>.cloudflareaccess.com» (o solo «<equipo>.cloudflareaccess.com»). */
	teamDomain: string;
	/** El «Application Audience (AUD) Tag» de la aplicación de Access. */
	aud: string;
}

interface Jwk extends JsonWebKey {
	kid?: string;
}

type Fetch = (url: string) => Promise<Response>;

/** Las claves públicas, guardadas una hora por equipo (Access las rota de vez en cuando). */
const keyCache = new Map<string, { at: number; keys: Jwk[] }>();
const KEYS_TTL = 60 * 60 * 1000;

export const issuer = (teamDomain: string) => `https://${teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

async function publicKeys(team: string, fetcher: Fetch, fresh: boolean): Promise<Jwk[]> {
	const hit = keyCache.get(team);
	if (hit && !fresh && Date.now() - hit.at < KEYS_TTL) return hit.keys;
	const res = await fetcher(`${team}/cdn-cgi/access/certs`);
	if (!res.ok) throw new Error(`certs ${res.status}`);
	const body = (await res.json()) as { keys?: Jwk[] };
	const keys = Array.isArray(body.keys) ? body.keys : [];
	keyCache.set(team, { at: Date.now(), keys });
	return keys;
}

const fromB64Url = (s: string) =>
	Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function parse(part: string): Record<string, unknown> | null {
	try {
		const v: unknown = JSON.parse(new TextDecoder().decode(fromB64Url(part)));
		return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/** El JWT de la petición: la cabecera de Access o, si no viene, la cookie. */
export function tokenOf(request: Request): string | null {
	const header = request.headers.get('cf-access-jwt-assertion');
	if (header) return header;
	const cookie = request.headers.get('cookie') ?? '';
	const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
	return m ? m[1] : null;
}

/**
 * El email (en minúsculas) del usuario de un JWT de Access válido; null si no vale por lo que sea.
 * Los tokens de servicio (los de las Actions) no llevan email: tampoco valen aquí.
 */
export async function verifyAccess(
	token: string,
	config: AccessConfig,
	fetcher: Fetch = fetch
): Promise<string | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const header = parse(parts[0]);
	const payload = parse(parts[1]);
	if (!header || !payload || header.alg !== 'RS256') return null;

	const team = issuer(config.teamDomain);
	const now = Date.now() / 1000;
	const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!config.aud || !aud.includes(config.aud)) return null;
	if (payload.iss !== team) return null;
	if (typeof payload.exp !== 'number' || payload.exp < now) return null;
	if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
	if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;

	let signature: Uint8Array;
	try {
		signature = fromB64Url(parts[2]);
	} catch {
		return null;
	}
	const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
	// Si la clave (kid) no está, puede que Access acabe de rotarlas: se piden otra vez, una sola.
	for (const fresh of [false, true]) {
		const keys = await publicKeys(team, fetcher, fresh);
		const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
		if (!jwk) continue;
		const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
			'verify'
		]);
		const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, signed as BufferSource);
		return ok ? payload.email.toLowerCase() : null;
	}
	return null;
}

/** Para los tests: olvida las claves guardadas. */
export const clearKeyCache = () => keyCache.clear();
