// Países que conoce la terminal, para la ficha PAIS (/pais?c=DE) y, más adelante, el mapa de GEO.
// Aquí solo hay datos fijos: nombre, gentilicio, moneda… Los datos de cada país salen de las fuentes
// que ya existen (Eurostat, BCE, BIS, FMI, titulares); src/lib/country.ts los junta.

export interface Country {
	/** ISO 3166-1 alfa-2: «DE». Es el código de la URL y de las series («bond10-de»). */
	code: string;
	/** ISO 3166-1 alfa-3: «DEU». Es el código del FMI. */
	iso3: string;
	/** Nombre en español. */
	name: string;
	/**
	 * Otros nombres con los que sale en los titulares (en inglés, siglas…). Si empiezan por mayúscula,
	 * la coincidencia también: así «China» no salta con «la china» de porcelana.
	 */
	aliases?: string[];
	/** Gentilicio en masculino singular («alemán»): las otras formas las pone `demonymForms`. */
	demonym: string;
	/** Código ISO 4217 de la moneda: «EUR», «USD»… */
	currency: string;
	/** Si usa el euro: entonces su banco central es el BCE y tiene prima de riesgo frente a Alemania. */
	euro?: boolean;
	/** Centro aproximado del país: [latitud, longitud]. Para el mapa. */
	center: [number, number];
}

export const COUNTRIES: Country[] = [
	// Zona euro
	{ code: 'ES', iso3: 'ESP', name: 'España', aliases: ['Spain', 'Spanish', 'Spaniards'], demonym: 'español', currency: 'EUR', euro: true, center: [40.2, -3.6] },
	{ code: 'DE', iso3: 'DEU', name: 'Alemania', aliases: ['Germany', 'German', 'Germans', 'Berlín', 'Berlin'], demonym: 'alemán', currency: 'EUR', euro: true, center: [51.1, 10.4] },
	{ code: 'FR', iso3: 'FRA', name: 'Francia', aliases: ['France', 'French', 'París', 'Paris', 'Elíseo'], demonym: 'francés', currency: 'EUR', euro: true, center: [46.6, 2.4] },
	{ code: 'IT', iso3: 'ITA', name: 'Italia', aliases: ['Italy', 'Italian', 'Italians', 'Roma', 'Rome'], demonym: 'italiano', currency: 'EUR', euro: true, center: [42.8, 12.6] },
	{ code: 'PT', iso3: 'PRT', name: 'Portugal', aliases: ['Portuguese', 'Lisboa', 'Lisbon'], demonym: 'portugués', currency: 'EUR', euro: true, center: [39.6, -8.0] },
	{ code: 'NL', iso3: 'NLD', name: 'Países Bajos', aliases: ['Holanda', 'Netherlands', 'Dutch', 'Ámsterdam', 'Amsterdam'], demonym: 'neerlandés', currency: 'EUR', euro: true, center: [52.2, 5.5] },
	{ code: 'BE', iso3: 'BEL', name: 'Bélgica', aliases: ['Belgium', 'Belgian'], demonym: 'belga', currency: 'EUR', euro: true, center: [50.6, 4.6] },
	{ code: 'AT', iso3: 'AUT', name: 'Austria', aliases: ['Austrian', 'Viena', 'Vienna'], demonym: 'austriaco', currency: 'EUR', euro: true, center: [47.6, 14.1] },
	{ code: 'IE', iso3: 'IRL', name: 'Irlanda', aliases: ['Ireland', 'Irish', 'Dublín', 'Dublin'], demonym: 'irlandés', currency: 'EUR', euro: true, center: [53.2, -8.2] },
	{ code: 'GR', iso3: 'GRC', name: 'Grecia', aliases: ['Greece', 'Greek', 'Atenas', 'Athens'], demonym: 'griego', currency: 'EUR', euro: true, center: [39.1, 22.0] },
	{ code: 'FI', iso3: 'FIN', name: 'Finlandia', aliases: ['Finland', 'Finnish', 'Helsinki'], demonym: 'finlandés', currency: 'EUR', euro: true, center: [64.5, 26.0] },

	// Resto de Europa
	{ code: 'GB', iso3: 'GBR', name: 'Reino Unido', aliases: ['United Kingdom', 'UK', 'Britain', 'British', 'Londres', 'London', 'Downing Street'], demonym: 'británico', currency: 'GBP', center: [54.0, -2.5] },
	{ code: 'CH', iso3: 'CHE', name: 'Suiza', aliases: ['Switzerland', 'Swiss', 'Berna'], demonym: 'suizo', currency: 'CHF', center: [46.8, 8.2] },
	{ code: 'SE', iso3: 'SWE', name: 'Suecia', aliases: ['Sweden', 'Swedish', 'Estocolmo', 'Stockholm'], demonym: 'sueco', currency: 'SEK', center: [62.0, 15.0] },
	{ code: 'NO', iso3: 'NOR', name: 'Noruega', aliases: ['Norway', 'Norwegian', 'Oslo'], demonym: 'noruego', currency: 'NOK', center: [61.0, 9.0] },
	{ code: 'DK', iso3: 'DNK', name: 'Dinamarca', aliases: ['Denmark', 'Danish', 'Copenhague', 'Copenhagen', 'Groenlandia', 'Greenland'], demonym: 'danés', currency: 'DKK', center: [56.0, 10.0] },
	{ code: 'PL', iso3: 'POL', name: 'Polonia', aliases: ['Poland', 'Varsovia', 'Warsaw'], demonym: 'polaco', currency: 'PLN', center: [52.0, 19.4] },
	{ code: 'UA', iso3: 'UKR', name: 'Ucrania', aliases: ['Ukraine', 'Ukrainian', 'Kiev', 'Kyiv', 'Zelenski', 'Zelensky'], demonym: 'ucraniano', currency: 'UAH', center: [49.0, 31.4] },
	{ code: 'RU', iso3: 'RUS', name: 'Rusia', aliases: ['Russia', 'Russian', 'Russians', 'Kremlin', 'Moscú', 'Moscow', 'Putin'], demonym: 'ruso', currency: 'RUB', center: [61.5, 99.0] },
	{ code: 'TR', iso3: 'TUR', name: 'Turquía', aliases: ['Turkey', 'Türkiye', 'Turkish', 'Ankara', 'Erdogan', 'Erdoğan'], demonym: 'turco', currency: 'TRY', center: [39.0, 35.2] },

	// América
	{ code: 'US', iso3: 'USA', name: 'Estados Unidos', aliases: ['EE. UU.', 'EE.UU.', 'EEUU', 'United States', 'U.S.', 'US', 'USA', 'Casa Blanca', 'White House'], demonym: 'estadounidense', currency: 'USD', center: [39.8, -98.6] },
	{ code: 'CA', iso3: 'CAN', name: 'Canadá', aliases: ['Canada', 'Canadian', 'Ottawa'], demonym: 'canadiense', currency: 'CAD', center: [56.1, -106.3] },
	{ code: 'MX', iso3: 'MEX', name: 'México', aliases: ['Mexico', 'Mexican', 'Sheinbaum'], demonym: 'mexicano', currency: 'MXN', center: [23.6, -102.5] },
	{ code: 'BR', iso3: 'BRA', name: 'Brasil', aliases: ['Brazil', 'Brazilian', 'Lula'], demonym: 'brasileño', currency: 'BRL', center: [-14.2, -51.9] },
	{ code: 'AR', iso3: 'ARG', name: 'Argentina', aliases: ['Argentine', 'Argentinian', 'Milei', 'Buenos Aires'], demonym: 'argentino', currency: 'ARS', center: [-38.4, -63.6] },
	{ code: 'CL', iso3: 'CHL', name: 'Chile', aliases: ['Chilean'], demonym: 'chileno', currency: 'CLP', center: [-35.7, -71.5] },
	{ code: 'CO', iso3: 'COL', name: 'Colombia', aliases: ['Colombian', 'Bogotá'], demonym: 'colombiano', currency: 'COP', center: [4.6, -74.3] },
	{ code: 'VE', iso3: 'VEN', name: 'Venezuela', aliases: ['Venezuelan', 'Caracas'], demonym: 'venezolano', currency: 'VES', center: [6.4, -66.6] },
	{ code: 'CU', iso3: 'CUB', name: 'Cuba', aliases: ['Cuban', 'La Habana', 'Havana'], demonym: 'cubano', currency: 'CUP', center: [21.5, -77.8] },

	// Asia y Oceanía
	{ code: 'CN', iso3: 'CHN', name: 'China', aliases: ['Chinese', 'Pekín', 'Beijing', 'Xi Jinping'], demonym: 'chino', currency: 'CNY', center: [35.9, 104.2] },
	{ code: 'JP', iso3: 'JPN', name: 'Japón', aliases: ['Japan', 'Japanese', 'Tokio', 'Tokyo'], demonym: 'japonés', currency: 'JPY', center: [36.2, 138.3] },
	{ code: 'IN', iso3: 'IND', name: 'India', aliases: ['Indian', 'Nueva Delhi', 'New Delhi', 'Modi'], demonym: 'indio', currency: 'INR', center: [20.6, 79.0] },
	{ code: 'KR', iso3: 'KOR', name: 'Corea del Sur', aliases: ['South Korea', 'South Korean', 'Seúl', 'Seoul'], demonym: 'surcoreano', currency: 'KRW', center: [35.9, 127.8] },
	{ code: 'KP', iso3: 'PRK', name: 'Corea del Norte', aliases: ['North Korea', 'North Korean', 'Pionyang', 'Pyongyang', 'Kim Jong-un'], demonym: 'norcoreano', currency: 'KPW', center: [40.3, 127.5] },
	{ code: 'TW', iso3: 'TWN', name: 'Taiwán', aliases: ['Taiwan', 'Taiwanese', 'Taipéi', 'Taipei'], demonym: 'taiwanés', currency: 'TWD', center: [23.7, 121.0] },
	{ code: 'ID', iso3: 'IDN', name: 'Indonesia', aliases: ['Indonesian', 'Yakarta', 'Jakarta'], demonym: 'indonesio', currency: 'IDR', center: [-0.8, 113.9] },
	{ code: 'PK', iso3: 'PAK', name: 'Pakistán', aliases: ['Pakistan', 'Pakistani', 'Islamabad'], demonym: 'pakistaní', currency: 'PKR', center: [30.4, 69.3] },
	{ code: 'AU', iso3: 'AUS', name: 'Australia', aliases: ['Australian', 'Canberra', 'Sídney', 'Sydney'], demonym: 'australiano', currency: 'AUD', center: [-25.3, 133.8] },

	// Oriente Próximo y África
	{ code: 'IL', iso3: 'ISR', name: 'Israel', aliases: ['Israeli', 'Israelis', 'Netanyahu', 'Tel Aviv'], demonym: 'israelí', currency: 'ILS', center: [31.0, 34.9] },
	{ code: 'PS', iso3: 'PSE', name: 'Palestina', aliases: ['Palestine', 'Palestinian', 'Palestinians', 'Gaza', 'Cisjordania', 'West Bank'], demonym: 'palestino', currency: 'ILS', center: [31.9, 35.2] },
	{ code: 'IR', iso3: 'IRN', name: 'Irán', aliases: ['Iran', 'Iranian', 'Teherán', 'Tehran'], demonym: 'iraní', currency: 'IRR', center: [32.4, 53.7] },
	{ code: 'SA', iso3: 'SAU', name: 'Arabia Saudí', aliases: ['Arabia Saudita', 'Saudi Arabia', 'Saudi', 'Riad', 'Riyadh'], demonym: 'saudí', currency: 'SAR', center: [23.9, 45.1] },
	{ code: 'AE', iso3: 'ARE', name: 'Emiratos Árabes Unidos', aliases: ['Emiratos', 'United Arab Emirates', 'UAE', 'Dubái', 'Dubai', 'Abu Dabi', 'Abu Dhabi'], demonym: 'emiratí', currency: 'AED', center: [23.4, 53.8] },
	{ code: 'EG', iso3: 'EGY', name: 'Egipto', aliases: ['Egypt', 'Egyptian', 'El Cairo', 'Cairo'], demonym: 'egipcio', currency: 'EGP', center: [26.8, 30.8] },
	{ code: 'MA', iso3: 'MAR', name: 'Marruecos', aliases: ['Morocco', 'Moroccan', 'Rabat'], demonym: 'marroquí', currency: 'MAD', center: [31.8, -7.1] },
	{ code: 'NG', iso3: 'NGA', name: 'Nigeria', aliases: ['Nigerian', 'Abuja', 'Lagos'], demonym: 'nigeriano', currency: 'NGN', center: [9.1, 8.7] },
	{ code: 'ZA', iso3: 'ZAF', name: 'Sudáfrica', aliases: ['South Africa', 'South African', 'Pretoria'], demonym: 'sudafricano', currency: 'ZAR', center: [-30.6, 22.9] }
];

/** Quita tildes y pasa a minúsculas, para comparar lo que escribe Sergi: «Japón» = «japon». */
const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[.\s]+/g, ' ')
		.trim();

/**
 * Formas del gentilicio a partir del masculino singular: «alemán» → alemán, alemana, alemanes, alemanas.
 * Reglas del español: -o → -a, -os, -as; -án/-és/-ín/-ón → sin tilde + -a, -es, -as; -í → -íes, -ís;
 * -e o -a → +s; otra consonante (español) → +a, +es, +as.
 */
export function demonymForms(m: string): string[] {
	const accented: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o' };
	const last = m.slice(-1);
	if (last === 'o') {
		const stem = m.slice(0, -1);
		return [m, `${stem}a`, `${stem}os`, `${stem}as`];
	}
	if (/[áéíó]n$|[áéíó]s$/.test(m)) {
		const stem = m.slice(0, -2) + accented[m.slice(-2, -1)] + last;
		return [m, `${stem}a`, `${stem}es`, `${stem}as`];
	}
	if (last === 'í') return [m, `${m}es`, `${m}s`];
	if (last === 'e' || last === 'a') return [m, `${m}s`];
	return [m, `${m}a`, `${m}es`, `${m}as`];
}

/** Nombres con los que se busca el país en los titulares: nombre, otros nombres y gentilicios. */
export function countryNames(c: Country): string[] {
	return [c.name, ...(c.aliases ?? []), ...demonymForms(c.demonym)];
}

/** Lo mismo con la forma que pide mentions() de src/lib/news.ts. */
export function countryTicker(c: Country): { name: string; aliases: string[] } {
	const [name, ...aliases] = countryNames(c);
	return { name, aliases };
}

/**
 * El país que se pide en la barra o en la URL: código ISO de dos o tres letras («DE», «deu»), nombre en
 * español o en inglés («Alemania», «germany») o gentilicio («alemán»). Sin tildes ni mayúsculas.
 */
export function findCountry(query: string | null | undefined): Country | undefined {
	const q = fold(query ?? '');
	if (!q) return undefined;
	const upper = q.toUpperCase();
	return (
		COUNTRIES.find((c) => c.code === upper || c.iso3 === upper) ??
		COUNTRIES.find((c) => [c.name, ...(c.aliases ?? [])].some((n) => fold(n) === q)) ??
		COUNTRIES.find((c) => demonymForms(c.demonym).some((n) => fold(n) === q)) ??
		// Por el principio del nombre: «reino» → Reino Unido, «corea del s» → Corea del Sur.
		(q.length >= 3 ? COUNTRIES.find((c) => fold(c.name).startsWith(q)) : undefined)
	);
}
