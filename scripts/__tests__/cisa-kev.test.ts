// CISA KEV: vulnerabilidades explotadas. Muestra con la forma documentada del feed JSON.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cisaKev, parseKev } from '../sources/cisa-kev.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const vuln = (cveID: string, dateAdded: string, ransomware = 'Unknown') => ({
	cveID,
	vendorProject: 'Microsoft',
	product: 'Windows',
	vulnerabilityName: `Microsoft Windows Use-After-Free Vulnerability (${cveID})`,
	dateAdded,
	shortDescription: 'Microsoft Windows contains a use-after-free vulnerability…',
	requiredAction: 'Apply mitigations per vendor instructions…',
	dueDate: '2026-11-04',
	knownRansomwareCampaignUse: ransomware,
	notes: 'https://msrc.microsoft.com/update-guide/vulnerability/' + cveID,
	cwes: ['CWE-416']
});

const catalog = (vulnerabilities: object[]) => ({
	title: 'CISA Catalog of Known Exploited Vulnerabilities',
	catalogVersion: '2026.10.14',
	dateReleased: '2026-10-14T17:00:01.0000Z',
	count: vulnerabilities.length,
	vulnerabilities
});

describe('cisa-kev', () => {
	it('guarda las 10 más recientes, marca el ransomware y cuenta las de hoy (UTC)', async () => {
		const old = Array.from({ length: 12 }, (_, i) => vuln(`CVE-2025-${1000 + i}`, '2026-09-01'));
		mockFetch((url) =>
			url.includes('known_exploited_vulnerabilities.json')
				? catalog([
						...old,
						vuln('CVE-2026-9', '2026-10-14', 'Known'),
						vuln('CVE-2026-10', '2026-10-14'),
						vuln('CVE-2026-20', '2026-10-13'),
						vuln('CVE-2026-11', '2026-10-14'),
						{ cveID: 'no es un CVE', dateAdded: '2026-10-14' },
						{ cveID: 'CVE-2026-12', dateAdded: '' }
					])
				: undefined
		);
		const data = await cisaKev.fetch(undefined);

		expect(data.day).toBe('2026-10-14');
		expect(data.today).toBe(3);
		expect(data.total).toBe(16);
		expect(data.items).toHaveLength(10);
		// Por fecha y, el mismo día, por número de CVE (11 va antes que 9 aunque como texto no).
		expect(data.items.slice(0, 4).map((v) => v.cveID)).toEqual(['CVE-2026-11', 'CVE-2026-10', 'CVE-2026-9', 'CVE-2026-20']);
		expect(data.items[2]).toEqual({
			cveID: 'CVE-2026-9',
			vendorProject: 'Microsoft',
			product: 'Windows',
			vulnerabilityName: 'Microsoft Windows Use-After-Free Vulnerability (CVE-2026-9)',
			dateAdded: '2026-10-14',
			ransomware: true
		});
		expect(data.items[0].ransomware).toBe(false);
	});

	it('sin vulnerabilidades es un fallo (se queda la copia anterior)', async () => {
		mockFetch(() => catalog([]));
		await expect(cisaKev.fetch(undefined)).rejects.toThrow('sin vulnerabilidades');
	});

	it('tolera una respuesta sin lista', () => {
		expect(parseKev({}, '2026-10-14')).toEqual({ items: [], total: 0, day: '2026-10-14', today: 0 });
		expect(parseKev(null, '2026-10-14').items).toEqual([]);
	});
});
