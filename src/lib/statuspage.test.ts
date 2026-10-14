import { describe, expect, it } from 'vitest';
import { activeIncident, label, sortServices, tone, type ServiceStatus } from './statuspage.ts';

const svc = (id: string, name: string, indicator: ServiceStatus['indicator'] = 'none'): ServiceStatus => ({
	id,
	name,
	indicator,
	description: '',
	incidents: [],
	page: ''
});

describe('estado de internet', () => {
	it('verde, ámbar o rojo según el indicador', () => {
		expect(tone('none')).toBe('ok');
		expect(tone('maintenance')).toBe('warn');
		expect(tone('minor')).toBe('warn');
		expect(tone('major')).toBe('bad');
		expect(tone('critical')).toBe('bad');
		expect(label('major')).toBe('Caída parcial');
	});

	it('primero los principales en su orden y luego el resto por nombre', () => {
		const out = sortServices([svc('npm', 'npm'), svc('anthropic', 'Anthropic'), svc('discord', 'Discord'), svc('cloudflare', 'Cloudflare'), svc('aws', 'AWS')]);
		expect(out.map((s) => s.id)).toEqual(['cloudflare', 'aws', 'anthropic', 'discord', 'npm']);
	});

	it('la incidencia activa es la más grave y, a igualdad, la más reciente', () => {
		const s = svc('github', 'GitHub', 'major');
		const inc = (id: string, impact: ServiceStatus['indicator'], updated: string) => ({ id, name: id, impact, status: '', started: null, updated, url: '' });
		s.incidents = [inc('a', 'minor', '2026-10-14T10:00:00Z'), inc('b', 'major', '2026-10-14T08:00:00Z'), inc('c', 'major', '2026-10-14T09:00:00Z')];
		expect(activeIncident(s)?.id).toBe('c');
		expect(activeIncident(svc('x', 'X'))).toBeNull();
	});
});
