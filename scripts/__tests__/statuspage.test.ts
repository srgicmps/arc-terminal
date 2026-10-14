import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeJson, parseAws, parseM365, parseGcp, parseStatuspage, SERVICES, statuspage, type ServiceStatus } from '../sources/statuspage.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const summary = {
	page: { id: 'x', name: 'GitHub', updated_at: '2026-10-14T10:00:00Z' },
	status: { indicator: 'minor', description: 'Minor Service Outage' },
	incidents: [
		{
			id: 'abc',
			name: 'Disruption with some GitHub services',
			status: 'investigating',
			impact: 'minor',
			created_at: '2026-10-14T09:00:00.000Z',
			started_at: '2026-10-14T08:55:00.000Z',
			updated_at: '2026-10-14T09:30:00.000Z',
			shortlink: 'https://stspg.io/abc'
		}
	],
	components: []
};

describe('statuspage', () => {
	it('lee el summary.json de Statuspage', () => {
		expect(parseStatuspage(summary, 'https://www.githubstatus.com')).toEqual({
			indicator: 'minor',
			description: 'Minor Service Outage',
			incidents: [
				{
					id: 'abc',
					name: 'Disruption with some GitHub services',
					impact: 'minor',
					status: 'investigating',
					started: '2026-10-14T08:55:00.000Z',
					updated: '2026-10-14T09:30:00.000Z',
					url: 'https://stspg.io/abc'
				}
			]
		});
		expect(() => parseStatuspage({}, 'x')).toThrow();
	});

	it('Google Cloud: solo las incidencias sin fin, con la gravedad traducida', () => {
		const out = parseGcp([
			{ id: 'g1', external_desc: 'Cloud Run errors', begin: '2026-10-14T07:00:00+00:00', modified: '2026-10-14T08:00:00+00:00', severity: 'high', uri: 'incidents/g1', most_recent_update: { status: 'SERVICE_OUTAGE' } },
			{ id: 'g0', external_desc: 'Viejo', begin: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z', severity: 'low' }
		]);
		expect(out.indicator).toBe('critical');
		expect(out.incidents).toHaveLength(1);
		expect(out.incidents[0]).toMatchObject({ id: 'g1', impact: 'critical', status: 'SERVICE_OUTAGE', url: 'https://status.cloud.google.com/incidents/g1' });
		expect(parseGcp([]).indicator).toBe('none');
	});

	it('AWS: eventos abiertos con fecha Unix, y JSON en UTF-16 con BOM', () => {
		const json = JSON.stringify([{ date: '1791972000', region_name: 'N. Virginia', status: '2', service_name: 'Amazon EC2', summary: 'Increased API error rates' }]);
		const utf16 = new Uint8Array(2 + json.length * 2);
		utf16.set([0xfe, 0xff]);
		[...json].forEach((ch, i) => utf16.set([0, ch.charCodeAt(0)], 2 + i * 2));
		const out = parseAws(decodeJson(utf16.buffer));
		expect(out.indicator).toBe('major');
		expect(out.incidents[0]).toMatchObject({ name: 'Increased API error rates', status: 'N. Virginia', started: '2026-10-14T10:00:00.000Z' });
		expect(parseAws(decodeJson(new ArrayBuffer(0))).indicator).toBe('none');
	});

	it('Microsoft 365: los servicios que no están «Operational», con su título', () => {
		const out = parseM365([
			{ ServiceDisplayName: 'Outlook.com', ServiceWorkloadName: 'Outlook', Id: 'EX1', Title: 'Users can not send mail', Status: 'ServiceInterruption', AuthoredDateTime: '2026-10-14T18:00:00Z', LastUpdatedTime: '2026-10-14T19:00:00Z' },
			{ ServiceDisplayName: 'Teams', ServiceWorkloadName: 'Teams', Id: null, Title: '', Status: 'ServiceDegradation', AuthoredDateTime: '0001-01-01T00:00:00+00:00', LastUpdatedTime: '2026-10-14T19:30:00Z' },
			{ ServiceDisplayName: 'Microsoft Copilot', ServiceWorkloadName: 'CopilotConsumer', Id: null, Title: '', Status: 'Operational' }
		]);
		expect(out.indicator).toBe('major');
		expect(out.incidents).toEqual([
			{ id: 'EX1', name: 'Outlook.com: Users can not send mail', impact: 'major', status: 'ServiceInterruption', started: '2026-10-14T18:00:00.000Z', updated: '2026-10-14T19:00:00.000Z', url: 'https://status.cloud.microsoft' },
			{ id: 'Teams', name: 'Teams', impact: 'minor', status: 'ServiceDegradation', started: null, updated: '2026-10-14T19:30:00.000Z', url: 'https://status.cloud.microsoft' }
		]);
		expect(parseM365([{ Status: 'Operational' }]).indicator).toBe('none');
	});

	it('si un servicio falla, deja su estado anterior marcado como viejo', async () => {
		mockFetch((url) => {
			if (url.includes('githubstatus')) return undefined;
			if (url.includes('google') || url.includes('microsoft')) return [];
			if (url.includes('aws')) return '';
			return { status: { indicator: 'none', description: 'All Systems Operational' }, incidents: [] };
		});
		const previous: ServiceStatus[] = [{ id: 'github', name: 'GitHub', indicator: 'major', description: 'x', incidents: [], page: 'p' }];
		const out = await statuspage.fetch(previous);
		expect(out.map((s) => s.id)).toEqual(SERVICES.map((s) => s.id));
		expect(out.find((s) => s.id === 'github')).toMatchObject({ indicator: 'major', stale: true });
		expect(out.find((s) => s.id === 'cloudflare')).toMatchObject({ indicator: 'none' });
	});
});
