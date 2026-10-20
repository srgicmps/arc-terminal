// Despertador: un Worker de Cloudflare que solo tiene Cron Triggers (sin URL: ni rutas ni *.workers.dev).
// GitHub se salta casi todos los `schedule` de las Actions (medido en octubre de 2026: unas 7 pasadas al día de
// las 288 de fast.yml y de las 96 de deploy.yml), así que este Worker las lanza a su hora con la API de GitHub
// (workflow_dispatch). Los `schedule` de los dos workflows se quedan de respaldo: si esto falla, se vuelve a lo
// de antes, nada peor.
// - Cada 5 min, fast.yml (vía rápida); en los minutos 7, 22, 37 y 52, deploy.yml (pasada completa).
// - fast.yml y deploy.yml comparten grupo de concurrencia: una pasada nueva sustituye a la que espera turno.
//   Por eso, antes de lanzar, mira si ya hay alguna esperando en main (en cola o pendiente):
//   · la rápida no se lanza si hay cualquiera esperando (si no, quitaría el turno a una normal o a la de un push);
//   · la normal no se lanza si ya espera otra normal. Si la que espera es una rápida, la sustituye: la normal
//     hace lo mismo (todas las fuentes caducadas, también las urgentes) y además issues.ts y las miniaturas.
// - Token: el secret GH_DISPATCH_TOKEN del Worker, un token fine-grained de GitHub solo de este repo con
//   Actions: lectura y escritura. Sin él, lo dice en el registro y no hace nada. El token nunca se registra.
// - Lo publica deploy.yml con la herramienta «despertador» (Actions → Publicar en Pages → Run workflow).
// - Plan gratuito de Cloudflare: 384 ejecuciones al día (de 100.000 peticiones), 2 Cron Triggers (de 5 por
//   cuenta) y 3 subpeticiones como mucho (de 50). La CPU apenas se usa: casi todo es esperar a GitHub.

export const REPO = 'srgicmps/arc-terminal';
export const RAMA = 'main';
const API = 'https://api.github.com';

/** Qué workflow lanza cada cron. Las claves son las de `crons` en cloud/cron/wrangler.toml (un test lo comprueba). */
export const PASADAS: Record<string, Pasada> = {
	'*/5 * * * *': { workflow: 'fast.yml', cedeA: 'todas' },
	'7,22,37,52 * * * *': { workflow: 'deploy.yml', cedeA: 'suyas' }
};

/**
 * `workflow`: el archivo de .github/workflows que lanza.
 * `cedeA`: no se lanza si ya espera turno en main cualquier pasada («todas») o una de su mismo workflow («suyas»).
 */
export interface Pasada {
	workflow: string;
	cedeA: 'todas' | 'suyas';
}

/** Estados de GitHub de una pasada que aún no ha empezado: sin runner libre («queued») o tras otra del grupo («pending»). */
export const ESPERANDO = ['queued', 'pending'] as const;

export interface Entorno {
	GH_DISPATCH_TOKEN?: string;
}

export type Resultado =
	| { estado: 'lanzada'; workflow: string }
	| { estado: 'esperando'; workflow: string }
	| { estado: 'sin-token' }
	| { estado: 'cron-desconocido'; cron: string }
	| { estado: 'error'; workflow: string; detalle: string };

type Registro = (mensaje: string) => void;

/** Lo que se le dice a Sergi según lo que responda GitHub (sin el token, nunca). */
export function motivo(status: number): string {
	if (status === 401) return 'el token no vale o ha caducado: crea otro y guárdalo en el Secret DESPERTADOR_GH_TOKEN';
	if (status === 403 || status === 404)
		return `el token no tiene permiso (o GitHub pide esperar): tiene que ser de ${REPO}, con Actions: lectura y escritura`;
	if (status === 422) return `GitHub no acepta el lanzamiento: ¿el workflow sigue teniendo workflow_dispatch en ${RAMA}?`;
	if (status === 429) return 'GitHub pide esperar (límite de peticiones)';
	return 'GitHub no responde bien; se reintenta en la próxima';
}

function github(token: string) {
	return async (path: string, que: string, payload?: unknown): Promise<Response> => {
		const res = await fetch(`${API}${path}`, {
			method: payload ? 'POST' : 'GET',
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28',
				// GitHub rechaza las peticiones sin User-Agent, y el fetch de Workers no pone ninguno.
				'User-Agent': 'arc-terminal-despertador',
				...(payload ? { 'Content-Type': 'application/json' } : {})
			},
			body: payload ? JSON.stringify(payload) : undefined,
			signal: AbortSignal.timeout(15_000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} al ${que}: ${motivo(res.status)}`);
		return res;
	};
}

/** Cuántas pasadas de main esperan turno: de un workflow o, sin él, de todos. */
async function esperando(api: ReturnType<typeof github>, workflow?: string): Promise<number> {
	const base = workflow ? `/repos/${REPO}/actions/workflows/${workflow}/runs` : `/repos/${REPO}/actions/runs`;
	const totales = await Promise.all(
		ESPERANDO.map(async (status) => {
			const res = await api(
				`${base}?branch=${RAMA}&status=${status}&per_page=1&exclude_pull_requests=true`,
				'mirar la cola'
			);
			const { total_count } = (await res.json()) as { total_count?: number };
			return Number(total_count) || 0;
		})
	);
	return totales.reduce((a, b) => a + b, 0);
}

/**
 * Lo que hace cada cron: mira la cola y, si toca, lanza su workflow en main. Nunca lanza un error: lo
 * registra y devuelve el resultado (para el registro de Cloudflare y para los tests).
 */
export async function despertar(cron: string, env: Entorno, log: Registro = console.log): Promise<Resultado> {
	const pasada = PASADAS[cron];
	if (!pasada) {
		log(`despertador: cron desconocido «${cron}»; no se lanza nada (mira PASADAS en cloud/cron/despertador.ts)`);
		return { estado: 'cron-desconocido', cron };
	}
	const token = env.GH_DISPATCH_TOKEN?.trim();
	if (!token) {
		log(
			'despertador: falta el secret GH_DISPATCH_TOKEN; no se lanza nada. Guarda el token en el Secret DESPERTADOR_GH_TOKEN de GitHub y lanza la herramienta «despertador» de deploy.yml.'
		);
		return { estado: 'sin-token' };
	}
	const { workflow } = pasada;
	const api = github(token);
	try {
		const enCola = await esperando(api, pasada.cedeA === 'suyas' ? workflow : undefined);
		if (enCola > 0) {
			log(`despertador: ${workflow} no se lanza: ya hay ${enCola} pasada(s) esperando turno en ${RAMA}`);
			return { estado: 'esperando', workflow };
		}
		await api(`/repos/${REPO}/actions/workflows/${workflow}/dispatches`, `lanzar ${workflow}`, { ref: RAMA });
		log(`despertador: ${workflow} lanzada en ${RAMA}`);
		return { estado: 'lanzada', workflow };
	} catch (error) {
		const detalle =
			error instanceof Error && error.name === 'TimeoutError'
				? 'GitHub no ha respondido en 15 s; se reintenta en la próxima'
				: error instanceof Error
					? error.message
					: String(error);
		log(`despertador: ${workflow} no se ha lanzado. ${detalle}`);
		return { estado: 'error', workflow, detalle };
	}
}

/** Lo mínimo del ScheduledController de Cloudflare que se usa aquí. */
interface Controlador {
	cron: string;
}

export default {
	async scheduled(controller: Controlador, env: Entorno): Promise<void> {
		await despertar(controller.cron, env);
	}
};
