// Explicaciones para el modo Sencillo: qué es un dato, por qué importa y cómo leerlo, en una o dos frases sin
// jerga. Parte del glosario (glossary.ts, el «qué es») y le añade el porqué y el cómo. <Term> (ui/Term.svelte)
// las enseña al tocar el ⓘ de un dato o del título de un panel; en Terminal solo sale el «qué es».

import { GLOSSARY, lookup, type GlossaryEntry } from './glossary.ts';
import { fold } from './simple.ts';

export interface Explanation {
	id: string;
	term: string;
	what: string;
	why?: string;
	how?: string;
}

/** Por qué importa y cómo leerlo, para las entradas del glosario (por id). */
export const MORE: Record<string, { why: string; how: string }> = {
	premium: { why: 'Cuanto más alta, más caro le sale al país pedir prestado, y eso acaba en impuestos o en recortes.', how: 'Por debajo de 100 es tranquilidad; por encima de 300, alarma (como en la crisis de 2012).' },
	euribor: { why: 'Si tienes una hipoteca variable, tu cuota sube o baja con él cuando te la revisan.', how: 'Si sube, pagarás más en la próxima revisión; si baja, menos.' },
	'yield-curve': { why: 'Es una de las señales que mejor han anticipado las recesiones.', how: 'Lo normal es que suba hacia la derecha. Si baja (invertida), el mercado teme que vengan tiempos peores.' },
	'spread-10-2': { why: 'Resume en un número si la curva de tipos está invertida.', how: 'Positivo es lo normal; negativo, señal de alerta de recesión.' },
	bond10: { why: 'Marca lo que cuesta pedir prestado a largo plazo, también para las hipotecas fijas y las empresas.', how: 'Si sube, el dinero se encarece para todos.' },
	deposit: { why: 'Es la palanca del BCE: de él dependen el euríbor y lo que te dan por tus ahorros.', how: 'Si lo sube, préstamos más caros y ahorro mejor pagado; si lo baja, al revés.' },
	fedfunds: { why: 'Lo que hace la Reserva Federal mueve el dólar y las bolsas de todo el mundo.', how: 'Si sube, frena la economía para bajar la inflación; si baja, la anima.' },
	policy: { why: 'Decide si el dinero es caro o barato: hipotecas, préstamos y ahorro dependen de él.', how: 'Subidas para frenar la inflación; bajadas cuando la economía flojea.' },
	mortgage: { why: 'Es lo que pagan de verdad quienes firman hoy una hipoteca.', how: 'Si sube, comprar casa con préstamo sale más caro.' },
	debt: { why: 'Mucha deuda deja al Estado con menos margen si llega una crisis.', how: 'Por encima del 100 % el país debe más de lo que produce en un año.' },
	core: { why: 'Quita lo que sube y baja por sorpresa y deja ver si la inflación está de verdad bajo control.', how: 'Si baja despacio, los bancos centrales tardarán en bajar los tipos.' },
	hicp: { why: 'Es la inflación que mira el BCE para decidir los tipos de interés.', how: 'Cerca del 2 % es lo deseado; muy por encima, el BCE tiende a subir tipos.' },
	cpi: { why: 'Te dice cuánto poder de compra pierde tu dinero.', how: 'Un 2 % al año es lo sano. Más, y tu sueldo cunde menos si no sube igual.' },
	pce: { why: 'Es la que vigila la Reserva Federal para mover los tipos.', how: 'El objetivo es el 2 %: más alto, tipos altos más tiempo.' },
	pvpc: { why: 'Si tienes esta tarifa, lo que pagas por la luz cambia cada hora.', how: 'Pon la lavadora o el lavavajillas en las horas más baratas.' },
	gdp: { why: 'Si crece, suele haber más empleo y más ingresos; si cae, llegan los problemas.', how: 'Por trimestre, un 0,5 % es buen ritmo. Dos trimestres seguidos en negativo es una recesión técnica.' },
	recession: { why: 'Suele traer más paro y menos ingresos.', how: 'Dos trimestres seguidos de caída del PIB.' },
	unemployment: { why: 'Es el dato que más se nota en la calle: cuánta gente quiere trabajar y no puede.', how: 'Si baja, la economía va bien. España suele estar por encima de la media europea.' },
	youth: { why: 'Mide lo difícil que es para los jóvenes empezar a trabajar.', how: 'Suele ser el doble que el paro general o más.' },
	pmi: { why: 'Es de los primeros datos del mes y adelanta por dónde va la economía.', how: 'Por encima de 50, la actividad crece; por debajo, se contrae.' },
	vix: { why: 'Mide el nerviosismo de los inversores.', how: 'Por debajo de 20, calma; por encima de 30, miedo.' },
	brent: { why: 'Del petróleo dependen la gasolina, el transporte y buena parte de la inflación.', how: 'Si sube, suelen subir la gasolina y los precios unas semanas después.' },
	wti: { why: 'Es la referencia del petróleo en EE. UU.', how: 'Se mueve casi a la par que el Brent.' },
	spx: { why: 'Es el termómetro de la bolsa mundial y de muchos planes de pensiones y fondos.', how: 'En verde sube y en rojo baja respecto al cierre anterior.' },
	ibex: { why: 'Es el termómetro de las grandes empresas españolas.', how: 'En verde sube y en rojo baja respecto al cierre anterior.' },
	nasdaq: { why: 'Refleja cómo van las grandes tecnológicas.', how: 'Suele moverse más que el S&P 500, para arriba y para abajo.' },
	dxy: { why: 'Un dólar fuerte encarece el petróleo y lo que compramos en dólares.', how: 'Si sube, el euro compra menos dólares.' },
	ipv: { why: 'Dice cuánto más cara está la vivienda que hace un año.', how: 'Si sube más que los sueldos, comprar casa es cada vez más difícil.' },
	bp: { why: 'Los cambios de tipos y primas se cuentan así para no liarse con decimales.', how: '100 pb son 1 punto: de 3 % a 4 %.' },
	yoy: { why: 'Quita los efectos de cada época del año (rebajas, verano…).', how: 'Compara siempre con el mismo mes del año anterior.' }
};

/**
 * Términos que no están en el glosario y salen en los títulos de los paneles. Se buscan antes que el glosario:
 * así «Tu hipoteca» explica la calculadora y no el tipo medio de las hipotecas nuevas.
 */
export const EXTRA: (GlossaryEntry & { why: string; how: string })[] = [
	{ id: 'my-mortgage', term: 'Tu hipoteca', match: ['tu hipoteca'], def: 'Una calculadora: con tu deuda y tu diferencial, la cuota con el último euríbor.', why: 'Te dice cuánto pagarás en la próxima revisión si el euríbor sigue así.', how: 'Escribe lo que te queda por pagar, los años y tu diferencial (el «+ x %» de tu contrato).' },
	{ id: 'central-banks', term: 'Bancos centrales', match: ['bancos centrales', 'proximas reuniones', 'banco central europeo'], def: 'El BCE, la Reserva Federal y los demás fijan el precio del dinero de su país.', why: 'Sus decisiones mueven hipotecas, préstamos, ahorro, divisas y bolsas.', how: 'Mira el último cambio: una subida encarece el dinero; una bajada lo abarata.' },
	{ id: 'premiums', term: 'Prima de riesgo', match: ['primas de riesgo', 'prima de riesgo'], def: 'Lo que paga de más un país por su deuda a 10 años frente a Alemania, en puntos básicos.', why: 'Cuanto más alta, más caro le sale al país pedir prestado.', how: 'Por debajo de 100, tranquilidad; por encima de 300, alarma.' },
	{ id: 'bonds-10', term: 'Bonos a 10 años', match: ['bonos a 10 anos'], def: 'Lo que cobra al año quien presta dinero a cada Estado durante 10 años.', why: 'Marca lo que cuesta pedir prestado a largo plazo en cada país.', how: 'Más alto quiere decir que el mercado pide más por fiarse de ese país.' },
	{ id: 'food', term: 'Precio de los alimentos', match: ['precios de los alimentos'], def: 'Índice de la FAO con el precio mundial de cereales, aceites, carne, lácteos y azúcar.', why: 'Lo que pasa aquí llega a la cesta de la compra unos meses después.', how: 'Si sube, la comida tenderá a encarecerse.' },
	{ id: 'heatmap', term: 'Mapa de calor', match: ['mapa de calor'], def: 'Cada cuadro es una empresa: el tamaño es lo que vale y el color, cuánto sube o baja hoy.', why: 'Ves de un vistazo si la bolsa va bien o mal y qué sectores tiran.', how: 'Verde sube, rojo baja; cuanto más intenso, más se mueve.' },
	{ id: 'movers', term: 'Los que más se mueven', match: ['los que mas se mueven'], def: 'Las acciones que más suben, más bajan y más se negocian hoy.', why: 'Suelen ser las que tienen noticias: resultados, compras, problemas.', how: 'Un movimiento de más del 10 % en un día es mucho para una empresa grande.' },
	{ id: 'predictions', term: 'Mercados de predicción', match: ['mercados de prediccion'], def: 'Webs donde la gente apuesta dinero a que algo pasará o no (unas elecciones, una bajada de tipos).', why: 'El precio de cada apuesta funciona como una probabilidad que cambia al momento.', how: 'Un 70 % quiere decir que los apostantes lo ven bastante probable, no seguro.' },
	{ id: 'markets', term: 'Mercados', match: ['mercados'], def: 'Las bolsas, el dinero y las materias primas más importantes, con su cambio de hoy.', why: 'Son el termómetro de cómo ve el mundo la economía.', how: 'Verde sube y rojo baja respecto al cierre anterior.' },
	{ id: 'fx', term: 'Divisas', match: ['divisas', 'monedas', 'moneda', 'conversor'], def: 'Cuánto vale una moneda en otra: euros por dólar, por libra…', why: 'Importa si viajas, compras fuera o tienes ahorros en otra moneda.', how: 'Si el EUR/USD sube, con un euro compras más dólares.' },
	{ id: 'crypto', term: 'Criptomonedas', match: ['cripto', 'criptomonedas', 'divisas y cripto'], def: 'Monedas digitales como el bitcoin, sin banco central detrás.', why: 'Mucha gente invierte en ellas, pero su precio cambia muchísimo.', how: 'Un 5 % en un día es normal aquí; en una bolsa sería mucho.' },
	{ id: 'commodities', term: 'Materias primas', match: ['materias primas'], def: 'Petróleo, gas, oro, trigo y otros productos básicos que se compran y venden en todo el mundo.', why: 'Sus precios acaban en la gasolina, la luz y la comida.', how: 'Si el petróleo o el gas suben mucho, la inflación suele seguirlos.' },
	{ id: 'per', term: 'PER', match: ['per'], def: 'Cuántos años de beneficios actuales cuesta comprar la empresa entera.', why: 'Ayuda a ver si una acción está cara o barata frente a otras.', how: 'Entre 10 y 20 es lo habitual; muy alto quiere decir que se espera mucho crecimiento.' },
	{ id: 'dividend', term: 'Dividendo', match: ['dividendo', 'rentabilidad por dividendo'], def: 'La parte del beneficio que la empresa reparte a sus accionistas.', why: 'Es un ingreso para quien tiene las acciones, aparte de lo que suba el precio.', how: 'Un 3–4 % al año es un dividendo generoso.' },
	{ id: 'quakes', term: 'Terremotos', match: ['terremotos'], def: 'Los terremotos recientes, con su magnitud y dónde han sido.', why: 'Los fuertes pueden causar daños y alertas de tsunami.', how: 'Por debajo de 4 apenas se notan; de 6 para arriba pueden hacer mucho daño.' },
	{ id: 'map', term: 'Mapa', match: ['mapa'], def: 'Lo que está pasando en el mundo, situado en el mapa.', why: 'Ayuda a ver dónde se concentran los conflictos y las noticias.', how: 'Toca un punto para ver qué ha pasado allí.' },
	{ id: 'headlines', term: 'Titulares', match: ['titulares', 'en las noticias'], def: 'Las últimas noticias de medios de confianza sobre este tema.', why: 'Te pone al día en un minuto.', how: 'Las más recientes van arriba; toca una para leerla entera.' },
	{ id: 'uv-pollen', term: 'UV y polen', match: ['uv y polen'], def: 'El índice UV mide la fuerza del sol; el polen, cuántos granos de cada planta hay en el aire.', why: 'Con UV alto te quemas antes; con polen alto, los alérgicos lo notan.', how: 'UV de 3 o más: crema y gorra en esas horas. Polen moderado o alto de tu planta: ventanas cerradas y la medicación a mano.' },
	{ id: 'elections', term: 'Próximas elecciones', match: ['proximas elecciones'], def: 'Las elecciones que vienen en el mundo, con su fecha.', why: 'Un cambio de gobierno puede mover mercados y relaciones entre países.', how: 'Las más cercanas van primero.' }
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXTRA_PATTERNS = EXTRA.map((e) => ({
	entry: e,
	re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${e.match.map((m) => escape(fold(m))).join('|')})(?![\\p{L}\\p{N}])`, 'u')
}));

const fromGlossary = (e: GlossaryEntry): Explanation => ({ id: e.id, term: e.term, what: e.def, ...MORE[e.id] });
const fromExtra = (e: (typeof EXTRA)[number]): Explanation => ({ id: e.id, term: e.term, what: e.def, why: e.why, how: e.how });

/** La explicación de un texto (un título de panel, el nombre de una serie) o de un id, o undefined. */
export function explain(text: string | null | undefined): Explanation | undefined {
	const t = fold(text ?? '');
	if (!t) return undefined;
	const byId = EXTRA.find((e) => e.id === t);
	if (byId) return fromExtra(byId);
	const extra = EXTRA_PATTERNS.find((p) => p.re.test(t))?.entry;
	if (extra) return fromExtra(extra);
	const g = lookup(t);
	return g ? fromGlossary(g) : undefined;
}

/** Ids del glosario sin «por qué» ni «cómo»: para el test (que no se quede ninguno importante sin explicar). */
export const unexplained = () => GLOSSARY.filter((e) => !MORE[e.id]).map((e) => e.id);
