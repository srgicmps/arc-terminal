// Estado de los grandes servicios de internet: Cloudflare, GitHub, OpenAI, Anthropic, Discord… con la API
// pública de Atlassian Statuspage (/api/v2/summary.json), y además Google Cloud (incidents.json), AWS Health
// (currentevents) y Microsoft 365 (status.cloud.microsoft), que tienen su propio formato. Todo sin clave.
// Términos: son páginas de estado públicas pensadas para consultarse así; no publican límite por IP, así que
// se pide cada 15 min (una petición por servicio). Si un servicio falla, se deja su estado anterior
// marcado como `stale`.
import { list, plain, request, settle, type Source } from '../lib.ts';

import { RANK, type Indicator, type ServiceIncident, type ServiceStatus } from '../../src/lib/statuspage.ts';

// Los tipos viven en src/lib/statuspage.ts, porque también los usa el panel de TECH.
export type { Indicator, ServiceIncident, ServiceStatus };

type Raw = Record<string, any>;

type Kind = 'statuspage' | 'gcp' | 'aws' | 'm365';

export const SERVICES: { id: string; name: string; kind: Kind; url: string; page: string }[] = [
	{ id: 'cloudflare', name: 'Cloudflare', kind: 'statuspage', url: 'https://www.cloudflarestatus.com/api/v2/summary.json', page: 'https://www.cloudflarestatus.com' },
	{ id: 'github', name: 'GitHub', kind: 'statuspage', url: 'https://www.githubstatus.com/api/v2/summary.json', page: 'https://www.githubstatus.com' },
	// OpenAI usa incident.io, que da la misma API que Statuspage.
	{ id: 'openai', name: 'OpenAI', kind: 'statuspage', url: 'https://status.openai.com/api/v2/summary.json', page: 'https://status.openai.com' },
	{ id: 'anthropic', name: 'Anthropic (Claude)', kind: 'statuspage', url: 'https://status.claude.com/api/v2/summary.json', page: 'https://status.claude.com' },
	{ id: 'discord', name: 'Discord', kind: 'statuspage', url: 'https://discordstatus.com/api/v2/summary.json', page: 'https://discordstatus.com' },
	{ id: 'reddit', name: 'Reddit', kind: 'statuspage', url: 'https://www.redditstatus.com/api/v2/summary.json', page: 'https://www.redditstatus.com' },
	{ id: 'vercel', name: 'Vercel', kind: 'statuspage', url: 'https://www.vercel-status.com/api/v2/summary.json', page: 'https://www.vercel-status.com' },
	{ id: 'npm', name: 'npm', kind: 'statuspage', url: 'https://status.npmjs.org/api/v2/summary.json', page: 'https://status.npmjs.org' },
	{ id: 'gcp', name: 'Google Cloud', kind: 'gcp', url: 'https://status.cloud.google.com/incidents.json', page: 'https://status.cloud.google.com' },
	{ id: 'm365', name: 'Microsoft 365', kind: 'm365', url: 'https://status.cloud.microsoft/api/posts/m365Consumer', page: 'https://status.cloud.microsoft' },
	{ id: 'aws', name: 'AWS', kind: 'aws', url: 'https://health.aws.amazon.com/public/currentevents', page: 'https://health.aws.amazon.com/health/status' }
];

const indicator = (value: unknown): Indicator => {
	const s = String(value ?? '').toLowerCase();
	return s in RANK ? (s as Indicator) : 'none';
};

const isoOrNull = (value: unknown): string | null => {
	if (value === null || value === undefined || value === '') return null;
	// AWS da segundos Unix como texto.
	const t = /^\d{9,10}$/.test(String(value)) ? Number(value) * 1000 : Date.parse(String(value));
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

const worst = (incidents: ServiceIncident[]): Indicator =>
	incidents.reduce<Indicator>((w, i) => (RANK[i.impact] > RANK[w] ? i.impact : w), 'none');

/** summary.json de Statuspage: indicador general e incidencias abiertas. */
export function parseStatuspage(body: Raw, page: string): Omit<ServiceStatus, 'id' | 'name' | 'page'> {
	if (!body?.status) throw new Error('summary.json sin «status»');
	const incidents = list<Raw>(body.incidents).map(
		(i): ServiceIncident => ({
			id: String(i.id ?? ''),
			name: plain(i.name, 200),
			impact: indicator(i.impact),
			status: plain(i.status, 30),
			started: isoOrNull(i.started_at ?? i.created_at),
			updated: isoOrNull(i.updated_at),
			url: String(i.shortlink || `${page}/incidents/${i.id}`)
		})
	);
	return { indicator: indicator(body.status.indicator), description: plain(body.status.description, 120), incidents };
}

/** incidents.json de Google Cloud: las que no tienen `end` siguen abiertas. */
export function parseGcp(body: unknown): Omit<ServiceStatus, 'id' | 'name' | 'page'> {
	if (!Array.isArray(body)) throw new Error('incidents.json no es una lista');
	const impact = (s: unknown): Indicator => ({ low: 'minor', medium: 'major', high: 'critical' })[String(s)] as Indicator ?? 'minor';
	const incidents = (body as Raw[])
		.filter((i) => !i?.end)
		.map(
			(i): ServiceIncident => ({
				id: String(i.id ?? i.number ?? ''),
				name: plain(i.external_desc, 200),
				impact: impact(i.severity),
				status: plain(i.most_recent_update?.status ?? i.status_impact, 30),
				started: isoOrNull(i.begin),
				updated: isoOrNull(i.modified),
				url: `https://status.cloud.google.com/${String(i.uri ?? `incidents/${i.id}`).replace(/^\//, '')}`
			})
		);
	const ind = worst(incidents);
	return { indicator: ind, description: ind === 'none' ? 'All services available' : `${incidents.length} incidencias abiertas`, incidents };
}

/** currentevents de AWS Health: lista de eventos abiertos (vacía si todo va bien). */
export function parseAws(body: unknown): Omit<ServiceStatus, 'id' | 'name' | 'page'> {
	if (!Array.isArray(body)) throw new Error('currentevents no es una lista');
	// status: 0 resuelto, 1 informativo, 2 degradado, 3 caída (según la propia página de AWS).
	const impact = (s: unknown): Indicator => (['none', 'minor', 'major', 'critical'] as Indicator[])[Number(s)] ?? 'minor';
	const incidents = (body as Raw[])
		.map(
			(e): ServiceIncident => ({
				id: String(e.arn ?? `${e.service ?? e.service_name}-${e.date}`),
				name: plain(e.summary || e.service_name || e.service, 200),
				impact: impact(e.status),
				status: plain(e.region_name ?? e.region ?? '', 40),
				started: isoOrNull(e.date),
				updated: isoOrNull(list<Raw>(e.event_log).at(-1)?.timestamp ?? e.date),
				url: 'https://health.aws.amazon.com/health/status'
			})
		)
		.filter((i) => i.impact !== 'none');
	const ind = worst(incidents);
	return { indicator: ind, description: ind === 'none' ? 'All services operating normally' : `${incidents.length} eventos abiertos`, incidents };
}

/**
 * Microsoft 365 (status.cloud.microsoft): una fila por servicio (Outlook, Teams, Copilot…) con su estado
 * («Operational» si va bien) y, si hay incidencia, título y mensaje. Una interrupción cuenta como caída
 * parcial; cualquier otro estado distinto de «Operational», como incidencia menor.
 */
export function parseM365(body: unknown): Omit<ServiceStatus, 'id' | 'name' | 'page'> {
	if (!Array.isArray(body)) throw new Error('posts de Microsoft no es una lista');
	const incidents = (body as Raw[])
		.filter((p) => p?.Status && !/^operational$/i.test(String(p.Status)))
		.map(
			(p): ServiceIncident => ({
				id: String(p.Id ?? p.ServiceWorkloadName ?? ''),
				name: plain([p.ServiceDisplayName, p.Title].filter(Boolean).join(': ') || p.Status, 200),
				impact: /interrupt|outage|down/i.test(String(p.Status)) ? 'major' : 'minor',
				status: plain(p.Status, 40),
				started: isoOrNull(/^0001-/.test(String(p.AuthoredDateTime)) ? null : p.AuthoredDateTime),
				updated: isoOrNull(p.LastUpdatedTime),
				url: 'https://status.cloud.microsoft'
			})
		);
	const ind = worst(incidents);
	return { indicator: ind, description: ind === 'none' ? 'All services operational' : `${incidents.length} servicios con incidencias`, incidents };
}

/** Lee JSON que puede venir en UTF-16 (AWS lo sirve así, con BOM). */
export function decodeJson(buffer: ArrayBuffer): unknown {
	const bytes = new Uint8Array(buffer);
	const encoding = bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8';
	const text = new TextDecoder(encoding).decode(bytes).replace(/^﻿/, '');
	return text.trim() ? JSON.parse(text) : [];
}

export const statuspage: Source<ServiceStatus[]> = {
	name: 'statuspage',
	label: 'Estado de Cloudflare, GitHub, Google Cloud, AWS… · sus páginas de estado',
	maxAgeMinutes: 15,
	async fetch(previous) {
		const fresh = await settle('statuspage', SERVICES, (s) => s.id, async (s) => {
			const res = await request(s.url, { headers: { Accept: 'application/json' } });
			const body = decodeJson(await res.arrayBuffer());
			const parsed =
				s.kind === 'gcp' ? parseGcp(body) : s.kind === 'aws' ? parseAws(body) : s.kind === 'm365' ? parseM365(body) : parseStatuspage(body as Raw, s.page);
			return { id: s.id, name: s.name, page: s.page, ...parsed } satisfies ServiceStatus;
		});
		if (!fresh.length) throw new Error('No responde ninguna página de estado');
		// Los que fallan esta vez: su estado anterior, marcado como viejo.
		const byId = new Map(fresh.map((s) => [s.id, s]));
		return SERVICES.flatMap((s): ServiceStatus[] => {
			const now = byId.get(s.id);
			if (now) return [now];
			const old = previous?.find((p) => p.id === s.id);
			return old ? [{ ...old, stale: true }] : [];
		});
	}
};
