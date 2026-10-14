// Próximas elecciones (GEO): nombre de cada tipo y qué países se destacan.
import type { Election, ElectionKind } from './types.ts';

export const KIND_LABEL: Record<ElectionKind, string> = {
	general: 'General',
	presidential: 'Presidencial',
	referendum: 'Referéndum'
};

/**
 * Países del G20 por su código ISO 3166-1 alfa-2: los 19 países miembros (la UE y la Unión Africana
 * son bloques, no países). Fuente: lista de miembros en https://g20.org.
 */
export const G20: ReadonlySet<string> = new Set([
	'AR', 'AU', 'BR', 'CA', 'CN', 'DE', 'FR', 'GB', 'ID', 'IN',
	'IT', 'JP', 'KR', 'MX', 'RU', 'SA', 'TR', 'US', 'ZA'
]);

/** Los 27 Estados de la Unión Europea (ISO 3166-1 alfa-2: Grecia es «GR», no «EL» como en Eurostat). */
export const EU: ReadonlySet<string> = new Set([
	'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
	'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
]);

/** ¿Se destaca la elección? Sí si el país es del G20 o de la UE. */
export function isMajor(e: Pick<Election, 'iso'>): boolean {
	const iso = e.iso?.toUpperCase();
	return !!iso && (G20.has(iso) || EU.has(iso));
}
