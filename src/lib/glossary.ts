// Glosario en contexto: qué significa cada término de economía y mercados, en español sencillo y en una o
// dos líneas. <Term of="…"> (src/lib/components/ui/Term.svelte) busca aquí el texto que se ve en una tabla
// o en una cifra y, si lo encuentra, pone un ⓘ con la definición.

export interface GlossaryEntry {
	id: string;
	/** Cómo se llama, para la cabecera de la definición. */
	term: string;
	/**
	 * Palabras que lo identifican en un texto, sin tildes y en minúscula; se buscan como palabras enteras.
	 * El orden del glosario importa: gana la primera entrada que encaja, así que las más concretas van antes
	 * («paro juvenil» antes que «paro»).
	 */
	match: string[];
	def: string;
}

export const GLOSSARY: GlossaryEntry[] = [
	// ---------- Tipos de interés y deuda ----------
	{ id: 'premium', term: 'Prima de riesgo', match: ['prima de riesgo', 'prima'], def: 'Lo que paga de más un país por su deuda a 10 años frente a Alemania, en puntos básicos. Mide la desconfianza del mercado.' },
	{ id: 'euribor', term: 'Euríbor', match: ['euribor'], def: 'Tipo al que se prestan dinero los bancos de la zona euro. El de 12 meses es la referencia de casi todas las hipotecas variables en España.' },
	{ id: 'estr', term: '€STR', match: ['€str', 'estr'], def: 'Tipo de interés de un día para otro entre bancos de la zona euro, que publica el BCE. Sigue muy de cerca al tipo de depósito.' },
	{ id: 'yield-curve', term: 'Curva de tipos', match: ['curva de tipos', 'curva'], def: 'La rentabilidad de la deuda a cada plazo, de 1 mes a 30 años. Si los plazos cortos pagan más que los largos (curva invertida), suele anticipar una recesión.' },
	{ id: 'spread-10-2', term: 'Diferencial 10 años − 2 años', match: ['diferencial', '10y2y', 't10y2y'], def: 'Bono a 10 años menos bono a 2 años. Negativo quiere decir curva invertida, una señal clásica de recesión.' },
	{ id: 'bond10', term: 'Bono a 10 años', match: ['bono a 10 anos', 'bono 10a', '10 anos'], def: 'Lo que cobra al año quien presta dinero al Estado durante 10 años. Es la referencia del coste de la deuda de un país.' },
	{ id: 'deposit', term: 'Facilidad de depósito', match: ['facilidad de deposito', 'tipo de deposito', 'dfr'], def: 'Lo que paga el BCE a los bancos por dejarle dinero de un día para otro. Hoy es el tipo con el que el BCE dirige la política monetaria.' },
	{ id: 'mro', term: 'Operaciones principales de financiación', match: ['operaciones principales de financiacion', 'mro'], def: 'Lo que cobra el BCE a los bancos por prestarles a una semana. Es el «precio oficial del dinero» del que hablan las noticias.' },
	{ id: 'fedfunds', term: 'Fondos federales', match: ['fondos federales', 'fed funds'], def: 'Tipo al que se prestan los bancos de EE. UU. de un día para otro. La Reserva Federal lo dirige con una horquilla de 0,25 puntos.' },
	{ id: 'policy', term: 'Tipo oficial', match: ['tipo oficial', 'tipos oficiales', 'bce', 'fed', 'boe', 'boj', 'bns', 'boc', 'rba', 'pboc', 'banxico', 'bcb', 'rbi', 'tcmb'], def: 'El tipo de interés que fija el banco central para encarecer o abaratar el dinero: lo sube para frenar la inflación y lo baja para animar la economía.' },
	{ id: 'mortgage', term: 'Hipotecas nuevas', match: ['hipotecas nuevas', 'hipoteca'], def: 'Tipo medio de las hipotecas firmadas ese mes (TAE sin comisiones, según el BCE). Recoge lo que de verdad pagan los que compran casa.' },
	{ id: 'debt', term: 'Deuda pública sobre el PIB', match: ['deuda publica', 'deuda / pib', 'deuda/pib'], def: 'Todo lo que debe el Estado comparado con lo que produce el país en un año. Las reglas europeas fijan el 60 % como referencia.' },

	// ---------- Precios ----------
	{ id: 'pce', term: 'PCE', match: ['pce'], def: 'Inflación del gasto de los hogares en EE. UU. Es la que mira la Reserva Federal; su objetivo es el 2 %, sobre todo la subyacente.' },
	{ id: 'core', term: 'Inflación subyacente', match: ['subyacente', 'core'], def: 'La inflación sin energía ni alimentos frescos, que suben y bajan mucho. Dice mejor hacia dónde van los precios de fondo.' },
	{ id: 'hicp', term: 'IPCA', match: ['ipca', 'hicp'], def: 'Índice de precios armonizado: la inflación calculada igual en todos los países de la UE, para poder compararlos. El BCE busca que esté en el 2 %.' },
	{ id: 'cpi', term: 'IPC', match: ['ipc', 'inflacion', 'cpi'], def: 'Índice de precios de consumo: cuánto ha subido, en un año, lo que compra un hogar típico. Es la inflación de la que hablan las noticias.' },
	{ id: 'ipv', term: 'IPV', match: ['ipv', 'precio de la vivienda'], def: 'Índice de precios de la vivienda del INE, con las compraventas reales ante notario, nuevas y usadas. Variación interanual.' },
	{ id: 'pvpc', term: 'PVPC', match: ['pvpc'], def: 'La tarifa regulada de la luz en España: cambia cada hora según el mercado mayorista. La tienen los contratos de hasta 10 kW con comercializadora de referencia.' },
	{ id: 'pool', term: 'Mercado mayorista', match: ['mercado mayorista', 'mayorista', 'pool'], def: 'Subasta diaria donde se compra y vende la electricidad de cada hora del día siguiente. Marca el precio base del PVPC.' },

	// ---------- Actividad y empleo ----------
	{ id: 'pmi', term: 'PMI', match: ['pmi'], def: 'Encuesta a los jefes de compras de las empresas. Por encima de 50, la actividad crece; por debajo, se contrae. Sale antes que el PIB.' },
	{ id: 'gdp', term: 'PIB', match: ['pib', 'gdp'], def: 'Producto interior bruto: todo lo que produce un país. Aquí, cuánto crece frente al trimestre anterior; EE. UU. lo da «anualizado» (como si siguiera así un año).' },
	{ id: 'recession', term: 'Recesión técnica', match: ['recesion tecnica', 'recesion'], def: 'Dos trimestres seguidos con el PIB a la baja.' },
	{ id: 'youth', term: 'Paro juvenil', match: ['paro juvenil'], def: 'Paro de los menores de 25 años que buscan trabajo. No cuenta a los que estudian sin buscar empleo.' },
	{ id: 'claims', term: 'Solicitudes de paro', match: ['solicitudes de paro', 'claims'], def: 'Personas que piden el subsidio por primera vez cada semana en EE. UU. Es el dato de empleo más rápido.' },
	{ id: 'epa', term: 'EPA', match: ['epa'], def: 'Encuesta de Población Activa del INE: la tasa de paro oficial de España, cada trimestre.' },
	{ id: 'payrolls', term: 'Empleo no agrícola', match: ['empleo no agricola', 'nominas', 'payrolls'], def: 'Empleos creados en EE. UU. ese mes fuera del campo (los «payrolls»). Sale el primer viernes de cada mes y mueve mucho los mercados.' },
	{ id: 'unemployment', term: 'Tasa de paro', match: ['paro', 'desempleo'], def: 'Parte de las personas que quieren trabajar y no encuentran empleo, sobre el total de las que trabajan o buscan.' },
	{ id: 'm2', term: 'M2', match: ['m2'], def: 'El dinero en circulación más los depósitos de los bancos. Si crece muy deprisa, puede haber más inflación más adelante.' },
	{ id: 'weo', term: 'Previsiones del FMI', match: ['fmi', 'weo', 'world economic outlook'], def: 'El Fondo Monetario Internacional publica en abril y octubre (con retoques en enero y julio) sus previsiones de crecimiento e inflación de cada país.' },

	// ---------- Mercados ----------
	{ id: 'vix', term: 'VIX', match: ['vix'], def: 'El «índice del miedo»: la volatilidad que espera el mercado para el S&P 500 en el próximo mes. Por encima de 30, hay nervios.' },
	{ id: 'dxy', term: 'Índice del dólar', match: ['indice del dolar', 'dolar, indice amplio', 'dxy'], def: 'El valor del dólar frente a una cesta de monedas de sus socios comerciales. Si sube, el dólar se fortalece.' },
	{ id: 'brent', term: 'Brent', match: ['brent'], def: 'Petróleo del mar del Norte: el precio de referencia en Europa, en dólares por barril.' },
	{ id: 'wti', term: 'WTI', match: ['wti'], def: 'Petróleo de Texas: el precio de referencia en EE. UU., en dólares por barril. Suele ir algo por debajo del Brent.' },
	{ id: 'spx', term: 'S&P 500', match: ['s&p 500', 'sp500', 'spx'], def: 'Índice de las 500 mayores empresas de EE. UU., ponderado por su tamaño. Es la referencia de la bolsa mundial.' },
	{ id: 'ibex', term: 'IBEX 35', match: ['ibex 35', 'ibex'], def: 'Índice de las 35 empresas con más negociación de la bolsa española.' },
	{ id: 'nasdaq', term: 'Nasdaq 100', match: ['nasdaq 100', 'nasdaq'], def: 'Las 100 mayores empresas no financieras del Nasdaq, la bolsa tecnológica de EE. UU.' },
	{ id: 'mcap', term: 'Capitalización', match: ['capitalizacion', 'market cap'], def: 'Lo que vale en bolsa una empresa o criptomoneda: precio por número de acciones (o monedas).' },
	{ id: 'fx-ref', term: 'Tipo de referencia del BCE', match: ['tipo de referencia', 'tipos de referencia'], def: 'Cambio oficial del euro que publica el BCE cada día laborable hacia las 16:00. No es el que da un banco en ventanilla.' },

	// ---------- Otros ----------
	{ id: 'elo', term: 'Elo', match: ['elo'], def: 'Puntuación de fuerza de un jugador de ajedrez: sube al ganar y baja al perder, más o menos según el rival. 1500 es un aficionado; 2700, la élite.' },

	// ---------- Generales: al final, para que gane el término concreto («M2, interanual» → M2) ----------
	{ id: 'bp', term: 'Punto básico', match: ['puntos basicos', 'punto basico', 'pb'], def: 'Una centésima de punto porcentual: 0,25 % son 25 pb.' },
	{ id: 'yoy', term: 'Interanual', match: ['interanual', 'yoy'], def: 'Comparado con el mismo mes (o trimestre) del año anterior.' }
];

/** Sin tildes, en minúscula y con los espacios normalizados. */
const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Una expresión por entrada: alguna de sus palabras, entera (sin letras ni números pegados).
const PATTERNS = GLOSSARY.map((e) => ({
	entry: e,
	re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${e.match.map((m) => escape(fold(m))).join('|')})(?![\\p{L}\\p{N}])`, 'u')
}));

/** La entrada del glosario que corresponde a un texto («Euríbor a 12 meses» → euríbor), o undefined. */
export function lookup(text: string | null | undefined): GlossaryEntry | undefined {
	const t = fold(text ?? '');
	if (!t) return undefined;
	return GLOSSARY.find((e) => e.id === t) ?? PATTERNS.find((p) => p.re.test(t))?.entry;
}
