import { describe, expect, it } from 'vitest';
import { euriborPhrase, gdpPhrase, inflationPhrase, movePhrase, phrases, policyPhrase, premiumPhrase, unemploymentPhrase } from './plain.ts';

const pts = (...vs: [string, number][]) => vs.map(([t, v]) => ({ t, v }));

describe('frases del modo Sencillo', () => {
	it('inflación, como en la calle', () => {
		expect(inflationPhrase('España', pts(['2026-08', 2.4]))).toBe('La inflación en España es del 2,4 %: las cosas cuestan un 2,4 % más que hace un año.');
		expect(inflationPhrase('España', pts(['2026-07', 2.1], ['2026-08', 2.4]))).toMatch(/Sube: el mes anterior era del 2,1 %\.$/);
		expect(inflationPhrase('España', pts(['2026-08', -0.5]))).toMatch(/han bajado un 0,5 %/);
		expect(inflationPhrase('España', [])).toBeNull();
	});
	it('paro, en personas de cada 100', () => {
		expect(unemploymentPhrase('España', pts(['2026-08', 10.4]))).toBe('El paro en España está en el 10,4 %: de cada 100 personas que quieren trabajar, unas 10 no encuentran empleo.');
	});
	it('PIB que crece o se encoge', () => {
		expect(gdpPhrase('España', pts(['2026-Q2', 0.6]))).toBe('La economía de España creció un 0,6 % en el último trimestre.');
		expect(gdpPhrase('Alemania', pts(['2026-Q2', -0.2]))).toMatch(/se encogió un 0,2 %/);
	});
	it('euríbor frente a hace un año, para la hipoteca', () => {
		expect(euriborPhrase(pts(['2025-09', 2.6], ['2026-08', 2.4], ['2026-09', 2.2]))).toBe(
			'El euríbor está en el 2,20 %, 0,4 puntos menos que hace un año: las hipotecas variables bajarán en su próxima revisión.'
		);
		expect(euriborPhrase(pts(['2026-09', 2.2]))).toMatch(/referencia/);
	});
	it('tipos del banco central con su último movimiento', () => {
		expect(policyPhrase('El BCE', pts(['2026-01-01', 2.25], ['2026-06-10', 2], ['2026-10-01', 2]))).toMatch(/2,00 %: la última vez los bajó/);
	});
	it('prima de riesgo con su lectura, subidas y bajadas, y las que faltan no salen', () => {
		expect(premiumPhrase('España', 64.6)).toMatch(/65 puntos: tranquilidad/);
		expect(movePhrase('El bitcoin', -2.13, 'en las últimas 24 horas')).toBe('El bitcoin baja un 2,1 % en las últimas 24 horas.');
		expect(phrases([null, 'a', undefined, false])).toEqual(['a']);
	});
});
