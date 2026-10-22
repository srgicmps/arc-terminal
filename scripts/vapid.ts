// La clave VAPID de los avisos en el navegador (Web Push, cloud/push.ts): el Secret de Pages VAPID_PRIVATE_KEY.
// Dos formas de crearla, una sola vez:
// - Desde el móvil, sin ordenador: Actions → «Publicar en Pages» → Run workflow, desde main, con la herramienta
//   «clave-push». Ejecuta `node scripts/vapid.ts --cloudflare`: crea la clave dentro del job y la guarda con la API
//   de Cloudflare, igual que `wrangler pages secret put`. Nunca sale en el registro (se oculta con ::add-mask::), ni
//   en el resumen, ni en el repo. Si ya hay una, no la toca.
// - En un ordenador: `node scripts/vapid.ts` la imprime con instrucciones para pegarla a mano. No escribe nada.
// La privada (un JWK) es lo único que hay que guardar: lleva dentro la parte pública, y /api/push se la da a la
// página para que el navegador se suscriba. Si algún día cambias la clave, los navegadores suscritos dejan de recibir
// hasta que vuelvan a pulsar «Activar» en AVISOS (la página lo detecta y lo pide).
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateVapid } from '../cloud/webpush.ts';
import { api, type Fetch } from './cf-config.ts';

/** El proyecto de Cloudflare Pages (el mismo nombre que usa deploy.yml) y el Secret. */
export const PROJECT = 'arc-terminal';
export const SECRET = 'VAPID_PRIVATE_KEY';

export async function vapidInstructions(): Promise<string> {
	const { jwk, public: pub } = await generateVapid();
	return [
		'Claves VAPID nuevas para los avisos en el navegador (Web Push).',
		'',
		'1. En Cloudflare: Workers & Pages → arc-terminal → Settings → Variables and Secrets (Production) → Add.',
		`   Type: Secret · Variable name: ${SECRET} · Value (todo, en una línea, con las llaves):`,
		'',
		`   ${JSON.stringify(jwk)}`,
		'',
		`   (O desde la terminal: npx wrangler pages secret put ${SECRET} --project-name ${PROJECT}, y pegas el valor.)`,
		'',
		'2. Las Functions lo leen desde la siguiente publicación: la Action la hace sola cada 15 min (o ya mismo con',
		'   Actions → «Publicar en Pages» → Run workflow, sin «fuentes»).',
		'',
		'3. Prueba: abre AVISOS en el móvil o el ordenador → «En este dispositivo» → Activar → Probar.',
		'',
		`Clave pública (no es secreta; no hace falta ponerla en ningún sitio, /api/push la saca de la privada): ${pub}`,
		'',
		'La privada es secreta: no la pegues en el repo, en un issue ni en un chat. Este script no la guarda en ningún sitio.',
		'Sin ordenador: Actions → «Publicar en Pages» → Run workflow → herramienta «clave-push» (la crea y la guarda sola).'
	].join('\n');
}

/** Lo que importa del proyecto de Pages: los nombres de sus variables y Secrets de producción (Cloudflare no da sus valores). */
interface PagesProject {
	deployment_configs?: {
		production?: {
			env_vars?: Record<string, { type?: string } | null> | null;
			wrangler_config_hash?: string;
		};
	};
}

export interface PutResult {
	/** «creada»: guardada ahora; «ya-estaba»: no se ha tocado; «error»: no se ha guardado nada (o no se sabe). */
	status: 'creada' | 'ya-estaba' | 'error';
	/** Resumen en Markdown para la Action: nunca lleva la clave privada. */
	summary: string;
}

const ADD_SECRET = 'Workers & Pages → arc-terminal → Settings → Variables and Secrets';

/**
 * Herramienta «clave-push» (deploy.yml): crea la clave VAPID y la guarda como Secret de producción del proyecto de
 * Pages, con la misma llamada que `wrangler pages secret put` (PATCH del proyecto con `secret_text` y el
 * `wrangler_config_hash` actual, que Cloudflare pide porque el proyecto se publica con wrangler.toml). Antes mira si
 * ya existe: entonces no hace nada, porque cambiarla obligaría a volver a activar los avisos en cada dispositivo.
 * La clave privada solo vive en memoria: lo primero que se escribe es `::add-mask::` con su parte secreta, para que
 * GitHub la tache si algo la imprimiera, y no va en ningún mensaje ni en el resumen.
 */
export async function putVapidSecret(
	env: Record<string, string | undefined> = process.env,
	fetcher: Fetch = fetch,
	log: (line: string) => void = console.log
): Promise<PutResult> {
	const fail = (why: string): PutResult => ({
		status: 'error',
		summary: `### Clave de los avisos: no guardada\n\n${why}\n`
	});
	if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REF !== 'refs/heads/main')
		return fail('Lánzala desde main («Use workflow from: main»).');
	const token = env.CLOUDFLARE_API_TOKEN ?? '';
	const account = env.CLOUDFLARE_ACCOUNT_ID ?? '';
	if (!token || !account) return fail('Faltan los Secrets CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID (los de siempre).');
	const path = `/accounts/${account}/pages/projects/${PROJECT}`;
	const production = async () => (await api<PagesProject>(fetcher, token, path)).deployment_configs?.production;

	let before: Awaited<ReturnType<typeof production>>;
	try {
		before = await production();
	} catch (e) {
		return fail(
			`No se ha podido leer el proyecto «${PROJECT}» de Cloudflare Pages (${(e as Error).message}). Es el mismo token que publica la web: si la web se publica, vuelve a lanzar la herramienta.`
		);
	}
	if (before?.env_vars?.[SECRET])
		return {
			status: 'ya-estaba',
			summary: [
				'### La clave de los avisos ya estaba',
				'',
				`- \`${SECRET}\` ya existe en Cloudflare: no se ha tocado. Cambiarla obligaría a volver a pulsar «Activar» en cada dispositivo.`,
				`- Si de verdad quieres otra: bórrala en Cloudflare (${ADD_SECRET}) y vuelve a lanzar esta herramienta.`,
				''
			].join('\n')
		};

	const { jwk, public: pub } = await generateVapid();
	// Lo primero: que GitHub tache la parte secreta si algo llegara a imprimirla. Solo en Actions (en un ordenador
	// esta línea la enseñaría).
	if (env.GITHUB_ACTIONS === 'true') log(`::add-mask::${jwk.d}`);
	try {
		await api(fetcher, token, path, {
			method: 'PATCH',
			body: JSON.stringify({
				deployment_configs: {
					production: {
						env_vars: { [SECRET]: { value: JSON.stringify(jwk), type: 'secret_text' } },
						wrangler_config_hash: before?.wrangler_config_hash
					}
				}
			})
		});
	} catch (e) {
		return fail(
			`Cloudflare no ha aceptado el Secret (${(e as Error).message}): no se ha guardado nada. Vuelve a lanzar la herramienta; si se repite, pásale este mensaje a Claude.`
		);
	}
	// Comprobación: que ahora salga en el proyecto, como Secret.
	const after = await production().catch(() => undefined);
	if (after?.env_vars?.[SECRET]?.type !== 'secret_text')
		return fail(
			`Cloudflare ha respondido bien, pero \`${SECRET}\` no sale en el proyecto. Míralo en ${ADD_SECRET} (Production) y, si no está, vuelve a lanzar la herramienta.`
		);
	return {
		status: 'creada',
		summary: [
			'### Clave de los avisos guardada',
			'',
			`- Secret \`${SECRET}\` en el proyecto «${PROJECT}» de Cloudflare Pages (Production). No sale en el registro, ni aquí, ni en el repo.`,
			'- La web la usa desde la próxima publicación: en 15 min como mucho (la lanza el despertador), o ya mismo con «Publicar en Pages» → Run workflow, sin nada más.',
			'- Para probar: AVISOS → «En este dispositivo» → Activar → Probar. En el iPhone, con la web añadida a la pantalla de inicio desde Safari (iOS 16.4 o posterior).',
			'- No vuelvas a lanzar esta herramienta: si ve que la clave ya está, no la toca.',
			`- Clave pública (no es secreta; /api/push la da a cada navegador): \`${pub}\``,
			''
		].join('\n')
	};
}

/**
 * La línea del registro de la Action para un resultado: ::error (y la Action en rojo), ::notice o una línea normal.
 * El texto de un comando de GitHub no puede llevar saltos de línea ni «%» sin escapar; el título va fijo.
 */
export function report({ status, summary }: PutResult): string {
	const text = summary
		.split('\n')
		.slice(1)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/%/g, '%25');
	if (status === 'error') return `::error title=Clave de los avisos::${text}`;
	if (status === 'ya-estaba') return `::notice title=Clave de los avisos::${text}`;
	return `Clave de los avisos guardada en Cloudflare (${SECRET}).`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	if (process.argv.includes('--cloudflare')) {
		const result = await putVapidSecret();
		if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result.summary);
		console.log(report(result));
		if (result.status === 'error') process.exitCode = 1;
	} else console.log(await vapidInstructions());
}
