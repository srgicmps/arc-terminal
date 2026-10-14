// Regiones del mundo para repartir los titulares de GEO: cada país de src/lib/countries.ts va en una, y un
// titular cae en las regiones de los países que nombra (por nombre o gentilicio, con findCountries).
import { findCountries } from './countries.ts';

export const REGIONS = [
	{ id: 'europa', label: 'Europa' },
	{ id: 'america', label: 'América' },
	{ id: 'asia', label: 'Asia y Pacífico' },
	{ id: 'oriente', label: 'Oriente Próximo' },
	{ id: 'africa', label: 'África' }
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];

const MEMBERS: Record<RegionId, string[]> = {
	europa: ['ES', 'DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'GR', 'FI', 'GB', 'CH', 'SE', 'NO', 'DK', 'PL', 'UA', 'RU', 'BY'],
	america: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'VE', 'CU', 'HT', 'NI'],
	asia: ['CN', 'JP', 'IN', 'KR', 'KP', 'TW', 'ID', 'PK', 'AU', 'PH', 'BD', 'MM', 'AF'],
	// Turquía va aquí: en los titulares sale sobre todo por Siria, Irak o Israel.
	oriente: ['TR', 'SY', 'IQ', 'LB', 'YE', 'IL', 'PS', 'IR', 'SA', 'AE'],
	africa: ['EG', 'MA', 'LY', 'SD', 'SS', 'SO', 'ET', 'ML', 'CD', 'MZ', 'NG', 'ZA']
};

const BY_COUNTRY = new Map<string, RegionId>(
	(Object.entries(MEMBERS) as [RegionId, string[]][]).flatMap(([region, codes]) => codes.map((c) => [c, region] as const))
);

/** La región de un país (código ISO2). */
export function regionOf(code: string): RegionId | undefined {
	return BY_COUNTRY.get(code);
}

/** Las regiones que nombra un titular, sin repetir y en el orden en que aparecen sus países. */
export function regionsOf(title: string): RegionId[] {
	return [...new Set(findCountries(title).flatMap((c) => regionOf(c.code) ?? []))];
}

/** Los titulares de una región (o todos, con 'all'). */
export function inRegion<T extends { title: string }>(items: T[], region: RegionId | 'all'): T[] {
	return region === 'all' ? items : items.filter((i) => regionsOf(i.title).includes(region));
}
