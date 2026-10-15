/// <reference types="node" />
// Órdenes de Sergi que quedaban en issues (lote 27-B, D41): «[alerta] NVDA > 150», «[mis] NVDA AAPL»,
// «[vigila] aranceles». Desde F14 van en su cuenta (D1); notify.ts solo usa esto para pasar a la cuenta los
// issues que queden abiertos y cerrarlos. Cuando no quede ninguno, este archivo se puede borrar.
// SEGURIDAD: el repo es público y cualquiera puede abrir issues. Solo cuentan los que ha abierto el dueño
// (`user.login` y `author_association: OWNER`); los demás se ignoran sin tocarlos. Hay topes por tipo
// (LIMITS de src/lib/useralerts.ts). Nada de aquí lleva el tema de ntfy ni la zona del diésel: los
// comentarios que se escriben en los issues son públicos.
import { LIMITS, OWNER, parseAlert, parseMis, parseTitle, parseWords, type UserAlert } from '../src/lib/useralerts.ts';
import { github } from './issues.ts';

export interface RawIssue {
	number: number;
	title: string;
	user?: { login?: string } | null;
	author_association?: string;
	pull_request?: unknown;
}

export interface Requests {
	/** Alertas válidas, de la más antigua a la más nueva (como mucho LIMITS.alerts). */
	alerts: { issue: number; alert: UserAlert }[];
	/** Lista MIS del issue «[mis]» más reciente (null si no hay ninguno). */
	mis: string[] | null;
	/** Palabras del issue «[vigila]» más reciente (null si no hay ninguno). */
	words: string[] | null;
	/** Issues que se cierran: «[mis]» y «[vigila]» antiguos, y alertas que no se entienden o sobran. */
	close: { issue: number; reason: string }[];
}

export const emptyRequests = (): Requests => ({ alerts: [], mis: null, words: null, close: [] });

/** ¿Lo ha abierto el dueño del repo? Cualquier otro issue se ignora. */
export const byOwner = (i: RawIssue, owner = OWNER) =>
	!i.pull_request && i.user?.login === owner && i.author_association === 'OWNER';

/** Qué hacer con los issues abiertos. Lógica pura (los tests le pasan issues inventados). */
export function planRequests(issues: RawIssue[], owner = OWNER): Requests {
	const out = emptyRequests();
	const mine = issues.filter((i) => byOwner(i, owner)).sort((a, b) => a.number - b.number);
	for (const i of [...mine].reverse()) {
		const t = parseTitle(i.title);
		if (!t || t.kind === 'alerta') continue;
		const isMis = t.kind === 'mis';
		if ((isMis ? out.mis : out.words) !== null) {
			out.close.push({ issue: i.number, reason: 'Sustituido por un issue más reciente.' });
			continue;
		}
		if (isMis) out.mis = parseMis(t.payload);
		else out.words = parseWords(t.payload);
	}
	for (const i of mine) {
		const t = parseTitle(i.title);
		if (t?.kind !== 'alerta') continue;
		const alert = parseAlert(t.payload);
		if (!alert) out.close.push({ issue: i.number, reason: 'No se entiende la alerta. Ejemplos: «NVDA > 150», «BTC -5%», «diésel < 1,40».' });
		else if (out.alerts.length >= LIMITS.alerts) out.close.push({ issue: i.number, reason: `Hay más de ${LIMITS.alerts} alertas abiertas: esta no se vigila.` });
		else out.alerts.push({ issue: i.number, alert });
	}
	return out;
}

export type Api = ReturnType<typeof github>;

/** Los issues abiertos del dueño (una página de 100 basta: hay topes). */
export async function loadRequests(api: Api, repo: string, owner = OWNER): Promise<Requests> {
	const issues = await api<RawIssue[]>(`/repos/${repo}/issues?state=open&creator=${owner}&per_page=100`);
	return planRequests(Array.isArray(issues) ? issues : [], owner);
}

/** Cierra un issue con un comentario (público: sin datos privados). */
export async function closeIssue(api: Api, repo: string, issue: number, comment: string): Promise<void> {
	await api(`/repos/${repo}/issues/${issue}/comments`, 'POST', { body: comment });
	await api(`/repos/${repo}/issues/${issue}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
}
