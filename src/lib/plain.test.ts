import { describe, expect, it } from 'vitest';
import {
	cheapestPhrase,
	cheapPhrase,
	curvePhrase,
	euriborPhrase,
	gdpPhrase,
	inflationPhrase,
	moneyPhrase,
	movePhrase,
	phrases,
	policyPhrase,
	premiumPhrase,
	unemploymentPhrase
} from './plain.ts';

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
		// El tipo efectivo diario de la Fed se mueve un punto básico sin reunión: no cuenta como subida.
		expect(policyPhrase('La Fed', pts(['2026-09-01', 4.33], ['2026-09-20', 4.08], ['2026-10-01', 4.09], ['2026-10-02', 4.1]))).toMatch(/4,10 %: la última vez los bajó/);
	});
	it('prima de riesgo con su lectura, subidas y bajadas, y las que faltan no salen', () => {
		expect(premiumPhrase('España', 64.6)).toMatch(/65 puntos: tranquilidad/);
		expect(movePhrase('El bitcoin', -2.13, 'en las últimas 24 horas')).toBe('El bitcoin baja un 2,1 % en las últimas 24 horas.');
		expect(phrases([null, 'a', undefined, false])).toEqual(['a']);
	});
});

describe('cheapPhrase (LUZ, F1)', () => {
	it('la franja más barata de hoy y de mañana', () => {
		expect(cheapPhrase('hoy', 2, '14:00', '16:00', 0.0523)).toBe('La franja de 2 horas más barata que queda hoy es de 14:00 a 16:00, a 0,052 € el kWh.');
		expect(cheapPhrase('mañana', 1, '03:00', '04:00', 0.04)).toBe('La hora más barata de mañana es de 03:00 a 04:00, a 0,040 € el kWh.');
	});
});

describe('curvePhrase (WB)', () => {
	it('curva normal, con la pendiente en puntos', () => {
		expect(curvePhrase('EE. UU.', 38)).toBe(
			'En EE. UU., el bono a 10 años paga 0,38 puntos más que el de 2 años: lo normal, prestar a más plazo se cobra más.'
		);
		expect(curvePhrase('la zona euro', 10)).toMatch(/^En la zona euro, el bono a 10 años paga 0,10 puntos más/);
	});
	it('curva invertida y curva plana (menos de 10 pb en un sentido u otro)', () => {
		expect(curvePhrase('EE. UU.', -45)).toBe(
			'En EE. UU., el bono a 2 años paga 0,45 puntos más que el de 10 (curva invertida): el mercado espera bajadas de tipos, y a veces es aviso de recesión.'
		);
		expect(curvePhrase('Japón', 0)).toMatch(/casi lo mismo \(curva plana\)/);
		expect(curvePhrase('Japón', -9)).toMatch(/curva plana/);
		expect(curvePhrase('Japón', 9)).toMatch(/curva plana/);
	});
	it('sin dato, no sale', () => {
		expect(curvePhrase('EE. UU.', null)).toBeNull();
		expect(curvePhrase('EE. UU.', undefined)).toBeNull();
	});
});

describe('moneyPhrase (BTMM)', () => {
	it('sin tensión: el tipo a un día, por debajo de lo que paga el banco central', () => {
		expect(moneyPhrase('ea', -6)).toBe(
			'En la zona euro, prestarse dinero a un día entre bancos (€STR) cuesta 0,06 puntos menos de lo que paga el BCE por los depósitos (facilidad de depósito): sin tensión, hay dinero de sobra.'
		);
	});
	it('con tensión: por encima', () => {
		expect(moneyPhrase('us', 5)).toBe(
			'En EE. UU., prestarse dinero a un día entre bancos (SOFR) cuesta 0,05 puntos más de lo que paga la Fed por las reservas (IORB): hay tensión, falta dinero a corto plazo.'
		);
	});
	it('igual: sin tensión, pero al límite; sin dato (FRED sin clave), no sale', () => {
		expect(moneyPhrase('us', 0)).toMatch(/cuesta lo mismo que paga la Fed por las reservas \(IORB\): sin tensión, pero al límite\.$/);
		expect(moneyPhrase('us', null)).toBeNull();
	});
});

describe('cheapestPhrase (FUEL)', () => {
	it('la más barata frente a la media, en céntimos', () => {
		expect(cheapestPhrase('Menorca', 1.489, 1.5823)).toBe('La gasolinera más barata de Menorca vende gasolina 95 a 1,489 € el litro, 9 céntimos menos que la media.');
		expect(cheapestPhrase('Madrid', 1.4, 1.41, 'Diésel')).toBe('La gasolinera más barata de Madrid vende diésel a 1,400 € el litro, 1 céntimo menos que la media.');
		expect(cheapestPhrase('Madrid', 0.9, 0.902, 'GLP')).toBe('La gasolinera más barata de Madrid vende GLP a 0,900 € el litro, casi lo mismo que la media.');
	});
	it('sin media (o si no cuadra con la más barata), solo el precio; sin precio, no sale', () => {
		expect(cheapestPhrase('Menorca', 1.489, null)).toBe('La gasolinera más barata de Menorca vende gasolina 95 a 1,489 € el litro.');
		expect(cheapestPhrase('Menorca', 1.6, 1.5)).toBe('La gasolinera más barata de Menorca vende gasolina 95 a 1,600 € el litro.');
		expect(cheapestPhrase('Menorca', null, 1.5)).toBeNull();
		// Math.min() de una lista vacía (la provincia aún no ha cargado).
		expect(cheapestPhrase('Menorca', Infinity, 1.5)).toBeNull();
	});
});
