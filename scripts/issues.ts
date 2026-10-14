/// <reference types="node" />
// Avisos de fuentes caídas como issues de GitHub. Lo ejecuta la Action después de `pnpm data`
// (solo en el cron y en los push a main, nunca en los PR):
// - si el tramo actual de una fuente (status-history.json) es «error» y lleva 3 pasadas o más, abre
//   un issue «Fuente caída: <nombre>», o actualiza el que ya está abierto (se edita el texto, sin
//   comentar, para no llenar el correo);
// - cuando la fuente vuelve (ok o cached), comenta y lo cierra.
// Usa la API REST de GitHub con el GITHUB_TOKEN de la Action. Sin Actions de terceros.
//
// Uso: `node scripts/issues.ts` (lee static/data/status.json y status-history.json).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { SourceHistory, SourceStatus, StateSpan } from '../src/lib/data.ts';

/** Pasadas seguidas en «error» para abrir el issue (cada pasada son unos 15 minutos). */
export const DOWN_AFTER = 3;
export const LABEL = 'fuente-caida';
const STATUS_URL = 'https://srgicmps.github.io/arc-terminal/status';
const API = 'https://api.github.com';

export const title = (name: string) => `Fuente caída: ${name}`;

/** Lo que hay que hacer con el issue de una fuente. */
export type Action =
	| { kind: 'open'; name: string }
	| { kind: 'update'; name: string; issue: number }
	| { kind: 'close'; name: string; issue: number }
	| { kind: 'none'; name: string };

/** Tramo actual (el último) del historial de una fuente, si está en «error» y lleva al menos `n` pasadas. */
export function downSpan(history: SourceHistory | undefined, n = DOWN_AFTER): StateSpan | null {
	const span = history?.history?.at(-1);
	return span && span.state === 'error' && span.runs >= n ? span : null;
}

/**
 * Decide qué hacer con una fuente, sabiendo su historial por tramos y si ya tiene un issue abierto
 * (su número) o no. Caída → abrir o actualizar. De vuelta (ok o cached) con issue abierto → cerrar.
 * Lo demás (copia anterior, sin clave, menos de 3 errores seguidos) → nada: el issue sigue como esté.
 */
export function decide(
	status: SourceStatus,
	history: SourceHistory | undefined,
	openIssue: number | undefined,
	n = DOWN_AFTER
): Action {
	const name = status.name;
	if (status.state === 'error' && downSpan(history, n)) {
		return openIssue ? { kind: 'update', name, issue: openIssue } : { kind: 'open', name };
	}
	if (openIssue && (status.state === 'ok' || status.state === 'cached')) return { kind: 'close', name, issue: openIssue };
	return { kind: 'none', name };
}

/**
 * Quita lo que pueda ser secreto de un mensaje de error, como hace fred.ts: el valor de cada clave
 * se cambia por «***» y se borra la parte «?…» de las URL (ahí van las claves en algunas APIs).
 */
export function redact(message: string, secrets: (string | undefined)[]): string {
	let text = message;
	for (const secret of secrets) if (secret && secret.length >= 4) text = text.replaceAll(secret, '***');
	return text.replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/g, '$1');
}

/** Variables de entorno con claves: nunca deben acabar en un issue público. */
const SECRET_ENV = ['FRED_API_KEY', 'FINNHUB_API_KEY', 'HF_TOKEN', 'SEC_USER_AGENT', 'MYMEMORY_EMAIL', 'GITHUB_TOKEN'];

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-10-14T10:22:00Z» → «14 oct 2026, 12:22 (hora de Madrid)». Sergi lee siempre la hora de Madrid. */
export function madridTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Madrid',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(date)
			.map((p) => [p.type, p.value])
	);
	return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year}, ${parts.hour}:${parts.minute} (hora de Madrid)`;
}

/** Texto del issue: último error, desde cuándo falla y enlace a STATUS. */
export function body(
	status: SourceStatus,
	history: SourceHistory | undefined,
	secrets: (string | undefined)[] = []
): string {
	const span = history?.history?.at(-1);
	const since = span?.t ? madridTime(span.t) : '—';
	const error = redact(status.error ?? 'sin detalle', secrets);
	return [
		`La fuente **${status.name}** (${status.label}) lleva ${span?.runs ?? '?'} pasadas seguidas sin datos.`,
		'',
		`- Falla desde: ${since}`,
		`- Último error: \`${error.replaceAll('`', "'")}\``,
		'',
		`Estado de todas las fuentes: ${STATUS_URL}`,
		'',
		'_Issue automático de scripts/issues.ts: se actualiza en cada pasada y se cierra solo cuando la fuente vuelva._'
	].join('\n');
}

// ---------- API REST de GitHub ----------

interface Issue {
	number: number;
	title: string;
	pull_request?: unknown;
}

function github(token: string) {
	return async <T = unknown>(path: string, method = 'GET', payload?: unknown): Promise<T> => {
		const res = await fetch(`${API}${path}`, {
			method,
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'ArcTerminal/1.0',
				...(payload ? { 'Content-Type': 'application/json' } : {})
			},
			body: payload ? JSON.stringify(payload) : undefined,
			signal: AbortSignal.timeout(20_000)
		});
		if (!res.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status}`);
		return (await res.json()) as T;
	};
}

/**
 * Abre, actualiza o cierra los issues según el estado de las fuentes. Antes de nada busca los issues
 * abiertos con la etiqueta «fuente-caida» y se queda con los de título exacto: así no hay duplicados.
 * Devuelve las acciones hechas (para el registro y los tests).
 */
export async function sync(
	statuses: SourceStatus[],
	histories: SourceHistory[],
	{ repo, token, secrets = [] }: { repo: string; token: string; secrets?: (string | undefined)[] }
): Promise<Action[]> {
	const api = github(token);
	const open = await api<Issue[]>(`/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=100`);
	const byTitle = new Map(open.filter((i) => !i.pull_request).map((i) => [i.title, i.number]));
	const historyOf = new Map(histories.map((h) => [h.name, h]));
	const done: Action[] = [];
	for (const status of statuses) {
		const history = historyOf.get(status.name);
		const action = decide(status, history, byTitle.get(title(status.name)));
		if (action.kind === 'none') continue;
		if (action.kind === 'open') {
			await api(`/repos/${repo}/issues`, 'POST', {
				title: title(status.name),
				body: body(status, history, secrets),
				labels: [LABEL]
			});
		} else if (action.kind === 'update') {
			await api(`/repos/${repo}/issues/${action.issue}`, 'PATCH', { body: body(status, history, secrets) });
		} else {
			await api(`/repos/${repo}/issues/${action.issue}/comments`, 'POST', {
				body: `La fuente ha vuelto (${status.state === 'ok' ? 'descarga correcta' : 'copia reciente'}). Se cierra.`
			});
			await api(`/repos/${repo}/issues/${action.issue}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
		}
		done.push(action);
	}
	return done;
}

async function main() {
	const repo = process.env.GITHUB_REPOSITORY;
	const token = process.env.GITHUB_TOKEN;
	if (!repo || !token) {
		console.log('issues: falta GITHUB_REPOSITORY o GITHUB_TOKEN, no se hace nada');
		return;
	}
	const read = async <T>(name: string) =>
		(JSON.parse(await readFile(`static/data/${name}.json`, 'utf8')) as { data: T }).data ?? [];
	const statuses = await read<SourceStatus[]>('status');
	const histories = await read<SourceHistory[]>('status-history');
	const secrets = SECRET_ENV.map((name) => process.env[name]);
	const done = await sync(statuses, histories, { repo, token, secrets });
	for (const a of done) console.log(`issues · ${a.name}: ${a.kind}`);
	if (!done.length) console.log('issues: nada que cambiar');
}

// Solo al ejecutarlo directamente (no al importarlo desde los tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
