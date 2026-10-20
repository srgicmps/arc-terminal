// Panel del administrador: /api/admin. Lo usa la vista /admin (src/routes/admin). Solo para Sergi: el email
// sale del JWT de Access verificado (access.ts → person) y tiene que ser el del Secret de Pages ADMIN_EMAIL.
// Cualquier otro, y los tokens de servicio, 403, sin un solo dato.
// - GET: los usuarios (los de la política de Access y los que tienen algo en D1), con su último acceso y si
//   tienen los avisos activados.
// - POST { action: 'invite' | 'remove', email }: añade o quita el email de la política de Access (por defecto,
//   la que se llama «Sergi»; Variable ACCESS_POLICY) con la API de Cloudflare. Al quitar, se cierran sus
//   sesiones y se borran sus datos de D1: todas las tablas de USER_TABLES (ajustes, avisos, último acceso,
//   familia, Mis RSS, predicciones, sugerencias y el contador de PREGUNTA).
//   Al admin no se le puede quitar.
// Necesita los Secrets de Pages CF_ACCESS_ADMIN_TOKEN (Access: Apps and Policies · Edit) y CF_ACCOUNT_ID; sin
// ellos, la lista sale igual (solo con lo de D1) y no se puede invitar ni quitar.
import { person } from './access.ts';
import { isAdmin, readJson, type AdminEnv } from './feedback.ts';
import { json, type D1Database } from './prefs.ts';
import { ensure, type Table } from './schema.ts';

export interface AdminFullEnv extends AdminEnv {
	CF_ACCESS_ADMIN_TOKEN?: string;
	CF_ACCOUNT_ID?: string;
	/** Nombre de la política de Access con los emails invitados. Por defecto, «Sergi». */
	ACCESS_POLICY?: string;
}

export interface UserInfo {
	email: string;
	/** Último acceso a la web (ms), si lo hay. */
	seen: number | null;
	alerts: boolean;
	/** Está en la política de Access (puede entrar). */
	invited: boolean;
}

/** Lo que hace falta de D1 para el panel. */
export interface AdminStore {
	/** Emails con algo guardado: último acceso y avisos. */
	users(): Promise<{ email: string; seen: number | null; alerts: boolean }[]>;
	/** Borra todo lo de un usuario: sus filas de cada tabla de USER_TABLES. */
	forget(email: string): Promise<void>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = 'https://api.cloudflare.com/client/v4';
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;

interface Rule {
	email?: { email?: string };
	[k: string]: unknown;
}
interface Policy {
	id: string;
	name?: string;
	decision?: string;
	include?: Rule[];
	exclude?: Rule[];
	require?: Rule[];
	session_duration?: string;
	[k: string]: unknown;
}

/** Los emails sueltos de una regla «include». Otros tipos (dominios, grupos…) se dejan como están. */
export const emailsOf = (p: Policy) =>
	(p.include ?? []).flatMap((r) => (typeof r.email?.email === 'string' ? [r.email.email.toLowerCase()] : []));

/** La política con un email más o uno menos (sin tocar las demás reglas). */
export function withEmail(p: Policy, email: string, add: boolean): Policy {
	const e = email.toLowerCase();
	const rest = (p.include ?? []).filter((r) => r.email?.email?.toLowerCase() !== e);
	return { ...p, include: add ? [...rest, { email: { email: e } }] : rest };
}

/** La política de Access de la web: la reutilizable con ese nombre o, si no, la de la aplicación (por su AUD). */
export class AccessPolicies {
	constructor(
		private env: AdminFullEnv,
		private fetcher: Fetch = fetch
	) {}

	get ready() {
		return !!this.env.CF_ACCESS_ADMIN_TOKEN?.trim() && !!this.env.CF_ACCOUNT_ID?.trim();
	}

	private async api<T>(path: string, init?: RequestInit): Promise<T> {
		const res = await this.fetcher(`${API}/accounts/${this.env.CF_ACCOUNT_ID!.trim()}${path}`, {
			...init,
			headers: { authorization: `Bearer ${this.env.CF_ACCESS_ADMIN_TOKEN!.trim()}`, 'content-type': 'application/json' },
			signal: AbortSignal.timeout(10_000)
		});
		const body = (await res.json().catch(() => null)) as { success?: boolean; result?: T } | null;
		// Sin el id de la cuenta ni nada de la respuesta en el error.
		if (!res.ok || !body?.success) throw new Error(`Cloudflare ${res.status}`);
		return body.result as T;
	}

	/** Dónde está la política y cómo es. */
	async find(): Promise<{ path: string; policy: Policy }> {
		const name = (this.env.ACCESS_POLICY?.trim() || 'Sergi').toLowerCase();
		const reusable = await this.api<Policy[]>('/access/policies').catch(() => [] as Policy[]);
		const hit = reusable.find((p) => p.name?.toLowerCase() === name);
		if (hit) return { path: `/access/policies/${hit.id}`, policy: hit };
		const apps = await this.api<{ id: string; aud?: string }[]>('/access/apps');
		const app = apps.find((a) => a.aud && a.aud === this.env.ACCESS_AUD);
		if (!app) throw new Error('sin aplicación de Access');
		const own = await this.api<Policy[]>(`/access/apps/${app.id}/policies`);
		const p = own.find((x) => x.name?.toLowerCase() === name);
		if (!p) throw new Error('sin política');
		return { path: `/access/apps/${app.id}/policies/${p.id}`, policy: p };
	}

	async emails(): Promise<string[]> {
		return emailsOf((await this.find()).policy);
	}

	/** Añade o quita un email. PUT con la política entera (lo que pide la API), cambiando solo «include». */
	async set(email: string, add: boolean): Promise<void> {
		const { path, policy } = await this.find();
		const next = withEmail(policy, email, add);
		if (!next.include?.length) throw new Error('la política se quedaría vacía');
		const body = {
			name: next.name,
			decision: next.decision ?? 'allow',
			include: next.include,
			exclude: next.exclude ?? [],
			require: next.require ?? [],
			...(next.session_duration ? { session_duration: next.session_duration } : {})
		};
		await this.api(path, { method: 'PUT', body: JSON.stringify(body) });
	}

	/** Cierra sus sesiones abiertas. Si el token no tiene permiso, da igual: la sesión caduca sola. */
	async revoke(email: string): Promise<void> {
		await this.api('/access/organizations/revoke_user', {
			method: 'POST',
			body: JSON.stringify({ email })
		}).catch(() => null);
	}
}

export async function handleAdmin(
	request: Request,
	env: AdminFullEnv,
	store: AdminStore | null,
	fetcher?: Fetch
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;
	if (!isAdmin(who.email, env)) return json(403, { error: 'solo el administrador' });
	// ?yo=1: solo «¿soy el admin?» (Arc OS enseña o no «Administración» sin pedir la lista entera).
	if (request.method === 'GET' && new URL(request.url).searchParams.has('yo')) return json(200, { admin: true });
	const access = new AccessPolicies(env, fetcher);

	if (request.method === 'GET') {
		const known = await store.users();
		let invited: string[] | null = null;
		let accessError = '';
		if (access.ready) invited = await access.emails().catch((e: Error) => ((accessError = e.message), null));
		const all = new Map<string, UserInfo>();
		for (const e of invited ?? []) all.set(e, { email: e, seen: null, alerts: false, invited: true });
		for (const u of known)
			all.set(u.email, { ...u, invited: invited ? invited.includes(u.email) : true });
		const users = [...all.values()].sort((a, b) => (b.seen ?? 0) - (a.seen ?? 0) || a.email.localeCompare(b.email));
		return json(200, {
			users,
			access: access.ready ? (invited ? 'ok' : `error: ${accessError}`) : 'sin token',
			admin: who.email
		});
	}

	if (request.method === 'POST') {
		const body = await readJson(request, 2000);
		if (body instanceof Response) return body;
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		if (!EMAIL.test(email)) return json(400, { error: 'email no válido' });
		if (body.action !== 'invite' && body.action !== 'remove') return json(400, { error: 'acción' });
		if (!access.ready) return json(503, { error: 'falta el token de Access' });
		if (body.action === 'remove' && isAdmin(email, env)) return json(400, { error: 'no puedes quitarte a ti' });
		try {
			await access.set(email, body.action === 'invite');
		} catch (e) {
			return json(502, { error: e instanceof Error ? e.message : 'Cloudflare' });
		}
		if (body.action === 'remove') {
			await access.revoke(email);
			await store.forget(email);
		}
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

/**
 * Apunta el último acceso (tabla seen), como mucho una vez cada 10 minutos por usuario. Lo llama /api/prefs al
 * cargar la web (functions/api/prefs.ts).
 */
export async function touchSeen(db: D1Database, user: string, now = Date.now()) {
	await ensure(db, 'seen');
	await db
		.prepare(
			'INSERT INTO seen (user, at) VALUES (?, ?) ON CONFLICT (user) DO UPDATE SET at = excluded.at WHERE excluded.at - seen.at > 600000'
		)
		.bind(user, now)
		.run();
}

/**
 * Las tablas con datos de una persona (columna user, su email): «Quitar» las borra todas. Una tabla nueva con
 * columna user tiene que estar aquí; si no, falla schema.test.ts. brief_mail no está: va por uid aleatorio, sin
 * email, y al borrar su fila de alerts ya no se puede relacionar con nadie.
 */
export const USER_TABLES = [
	'prefs',
	'alerts',
	'seen',
	'family',
	'family_sent',
	'rss',
	'forecast_bets',
	'forecast_players',
	'feedback',
	'ask_count'
] as const satisfies readonly Table[];

/** Las que usa el panel. Las de los demás módulos pueden no existir todavía: se crean igual que allí. */
const OWN: Table[] = ['seen', 'prefs', 'alerts'];

export function d1AdminStore(db: D1Database): AdminStore {
	const ready = () => ensure(db, ...OWN);
	return {
		async users() {
			await ready();
			const { results } = await db
				.prepare(
					`SELECT u.user AS email, s.at AS seen, a.config AS config FROM
					(SELECT user FROM seen UNION SELECT user FROM prefs UNION SELECT user FROM alerts) u
					LEFT JOIN seen s ON s.user = u.user LEFT JOIN alerts a ON a.user = u.user`
				)
				.all<{ email: string; seen: number | null; config: string | null }>();
			return results.map((r) => ({
				email: r.email,
				seen: r.seen ?? null,
				alerts: !!r.config && (JSON.parse(r.config) as { on?: unknown }).on === true
			}));
		},
		async forget(email) {
			await ready();
			await db.batch(OWN.map((t) => db.prepare(`DELETE FROM ${t} WHERE user = ?`).bind(email)));
			// Las de los demás módulos solo existen si alguien los ha usado: una a una, para que la que falte no
			// impida borrar las otras. Familia (cloud/family.ts), Mis RSS (cloud/rss.ts), predicciones
			// (cloud/forecasts.ts) y sugerencias (cloud/feedback.ts).
			for (const t of USER_TABLES.filter((t) => !OWN.includes(t)))
				await db.prepare(`DELETE FROM ${t} WHERE user = ?`).bind(email).run().catch(() => {});
		}
	};
}

/** En memoria, para los tests. */
export function memoryAdminStore(
	rows: { email: string; seen: number | null; alerts: boolean }[] = []
): AdminStore & { rows: typeof rows } {
	return {
		rows,
		users: async () => rows.map((r) => ({ ...r })),
		forget: async (email) => {
			const i = rows.findIndex((r) => r.email === email);
			if (i >= 0) rows.splice(i, 1);
		}
	};
}
