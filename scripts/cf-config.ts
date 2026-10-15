/// <reference types="node" />
// Antes de `wrangler pages deploy` (deploy.yml y fast.yml): rellena wrangler.toml para los ajustes y avisos por
// usuario (functions/, cloud/) sin que Sergi tenga que copiar nada. Con la API de Cloudflare y el
// CLOUDFLARE_API_TOKEN de siempre:
// - Base D1 «arc-terminal-users»: la busca por nombre y, si no existe, la crea. Las tablas las crea el propio
//   código la primera vez (cloud/prefs.ts, cloud/alerts.ts), así que no hay migraciones aparte.
// - Cloudflare Access: el AUD de la aplicación que protege la web (SITE_URL) y el dominio del equipo.
// Permisos que necesita el token, además de Pages: Account · D1 · Edit; Account · Access: Apps and Policies ·
// Read; Account · Access: Organizations, Identity Providers, and Groups · Read.
// Las Variables de GitHub D1_DATABASE_ID, ACCESS_AUD y ACCESS_TEAM_DOMAIN, si están, mandan (por si la API no
// deja). Si falta algo, se quita wrangler.toml: la web se publica igual y /api/* responde «sin configurar».
// Nada de esto se escribe en el registro: los valores se ocultan (::add-mask::) y solo se dice si hay o no.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SITE } from './site.ts';

export const DB_NAME = 'arc-terminal-users';
const API = 'https://api.cloudflare.com/client/v4';

interface AccessApp {
	aud?: string;
	domain?: string;
	self_hosted_domains?: string[];
	destinations?: { type?: string; uri?: string }[];
}

/** El AUD de la aplicación de Access que cubre `host` (sin «https://» ni ruta); null si ninguna. */
export function pickAud(apps: AccessApp[], host: string): string | null {
	const covers = (d: string | undefined) => {
		const h = (d ?? '')
			.replace(/^https?:\/\//, '')
			.split('/')[0]
			.toLowerCase();
		return h === host || (h.startsWith('*.') && host.endsWith(h.slice(1)));
	};
	const app = apps.find(
		(a) =>
			covers(a.domain) ||
			(a.self_hosted_domains ?? []).some(covers) ||
			(a.destinations ?? []).some((d) => covers(d.uri))
	);
	return app?.aud ?? null;
}

/** wrangler.toml con los marcadores sustituidos. */
export function fill(toml: string, v: { db: string; team: string; aud: string }): string {
	return toml
		.replace('__D1_DATABASE_ID__', v.db)
		.replace('__ACCESS_TEAM_DOMAIN__', v.team)
		.replace('__ACCESS_AUD__', v.aud);
}

type Fetch = typeof fetch;

async function api<T>(fetcher: Fetch, token: string, path: string, init?: RequestInit): Promise<T> {
	const res = await fetcher(`${API}${path}`, {
		...init,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		signal: AbortSignal.timeout(20_000)
	});
	const body = (await res.json().catch(() => null)) as { success?: boolean; result?: T } | null;
	if (!res.ok || !body?.success)
		throw new Error(`${path.split('?')[0].replace(/\/accounts\/[^/]+/, '/accounts/…')}: ${res.status}`);
	return body.result as T;
}

/** El id de la base D1 (la crea si no está). */
export async function d1Id(fetcher: Fetch, token: string, account: string): Promise<string> {
	const list = await api<{ uuid: string; name: string }[]>(
		fetcher,
		token,
		`/accounts/${account}/d1/database?name=${DB_NAME}`
	);
	const found = list.find((d) => d.name === DB_NAME);
	if (found) return found.uuid;
	const made = await api<{ uuid: string }>(fetcher, token, `/accounts/${account}/d1/database`, {
		method: 'POST',
		body: JSON.stringify({ name: DB_NAME })
	});
	return made.uuid;
}

/** El dominio del equipo de Access («https://equipo.cloudflareaccess.com») y el AUD de la aplicación de la web. */
export async function access(
	fetcher: Fetch,
	token: string,
	account: string,
	host: string
): Promise<{ team: string; aud: string | null }> {
	const org = await api<{ auth_domain?: string }>(fetcher, token, `/accounts/${account}/access/organizations`);
	const apps = await api<AccessApp[]>(fetcher, token, `/accounts/${account}/access/apps`);
	return { team: org.auth_domain ? `https://${org.auth_domain}` : '', aud: pickAud(apps, host) };
}

export async function main(
	env = process.env,
	fetcher: Fetch = fetch,
	path = 'wrangler.toml',
	log = console.log
): Promise<boolean> {
	const token = env.CLOUDFLARE_API_TOKEN ?? '';
	const account = env.CLOUDFLARE_ACCOUNT_ID ?? '';
	let db = env.D1_DATABASE_ID ?? '';
	let team = env.ACCESS_TEAM_DOMAIN ?? '';
	let aud = env.ACCESS_AUD ?? '';
	if (token && account) {
		if (!db)
			db = await d1Id(fetcher, token, account).catch((e: Error) => {
				log(
					`::warning title=Usuarios::No se pudo leer o crear la base D1 (${e.message}). ¿Tiene el token «D1 · Edit»?`
				);
				return '';
			});
		if (!team || !aud) {
			const host = new URL(SITE).host;
			const found = await access(fetcher, token, account, host).catch((e: Error) => {
				log(
					`::warning title=Usuarios::No se pudo leer Cloudflare Access (${e.message}). ¿Tiene el token los permisos de Access de lectura?`
				);
				return { team: '', aud: null };
			});
			team ||= found.team;
			aud ||= found.aud ?? '';
			if (found.team && !found.aud) log(`::warning title=Usuarios::Ninguna aplicación de Access cubre ${host}`);
		}
	}
	// Que no salgan en el registro aunque algo (wrangler) los imprima.
	for (const v of [db, team.replace(/^https:\/\//, ''), aud]) if (v) log(`::add-mask::${v}`);
	if (db && team && aud) {
		await writeFile(path, fill(await readFile(path, 'utf8'), { db, team, aud }));
		log('Usuarios: base D1 y Access listos');
		return true;
	}
	await rm(path, { force: true });
	log(
		`::notice::Usuarios sin configurar (base D1: ${db ? 'sí' : 'no'}, Access: ${team && aud ? 'sí' : 'no'}); la web se publica igual`
	);
	return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
