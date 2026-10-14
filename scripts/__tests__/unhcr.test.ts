// ACNUR: población por país de origen y de asilo. Los números a veces llegan como texto y los vacíos como «-».
import { describe, expect, it } from 'vitest';
import { parseUnhcr, unhcrUrl } from '../sources/unhcr.ts';

describe('unhcr', () => {
	it('suma refugiados y solicitantes de asilo por origen y por acogida, y los desplazados internos', () => {
		const origin = {
			items: [
				{ year: 2025, coo_name: 'Afghanistan', coo_iso: 'AFG', coa_iso: '-', refugees: 2671560, asylum_seekers: 270007, idps: 3199023 },
				{ year: 2025, coo_name: 'Aruba', coo_iso: 'ABW', coa_iso: '-', refugees: '0', asylum_seekers: 5, idps: '0' },
				{ coo_name: 'Desconocido', coo_iso: '-', refugees: 100 }
			]
		};
		const asylum = { items: [{ coa_name: 'Afghanistan', coa_iso: 'AFG', refugees: '21251', asylum_seekers: '-' }] };
		expect(parseUnhcr(origin, asylum, 2025)).toEqual({
			year: 2025,
			countries: [
				{ iso3: 'AFG', name: 'Afghanistan', from: 2941567, hosted: 21251, idps: 3199023 },
				{ iso3: 'ABW', name: 'Aruba', from: 5, hosted: 0, idps: 0 }
			]
		});
	});

	it('la consulta pide un solo año y todos los países de origen o de asilo', () => {
		const url = new URL(unhcrUrl(2025, 'coa'));
		expect([url.searchParams.get('yearFrom'), url.searchParams.get('yearTo'), url.searchParams.get('coa_all')]).toEqual(['2025', '2025', 'true']);
	});
});
