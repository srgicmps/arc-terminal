// Recorrido corto (6 pasos) que sale al terminar la bienvenida y desde HELP. Cada paso puede señalar algo de la
// pantalla: la primera de sus `targets` (selectores CSS) que se vea. Si no hay ninguna, la tarjeta va sola.

export interface TourStep {
	title: string;
	text: string;
	targets: string[];
}

export const TOUR: readonly TourStep[] = [
	{
		title: 'La barra lo abre todo',
		text: 'Escribe un código (NVDA, ECO, FUEL) o lo que buscas en tu idioma («gasolina», «inflación») y pulsa Intro. En el móvil, el botón «/» de abajo.',
		targets: ['form.cmd input', 'nav.thumb button']
	},
	{
		title: 'Las vistas',
		text: 'Cada sección es una vista: Portada, Economía, Mundo, Wall Street… Están en esta fila (abajo en el móvil) y, todas, en HELP. En el móvil también se pasa de una a otra deslizando.',
		targets: ['nav.keys', 'nav.thumb']
	},
	{
		title: 'Toca un dato',
		text: 'Casi todo se puede tocar: un titular abre la noticia, una cifra enseña su historia y un valor (NVDA) abre su ficha. El título de un panel lo pliega.',
		targets: ['main section']
	},
	{
		title: 'Otras formas de usar Arc',
		text: 'Las experiencias cambian cómo usas Arc con los mismos datos: un periódico, una radio que te lo lee, un muro para la tele, un juego de predicciones… Ábrelas con ✦ (o Mayús + X) y sal con «✕ Salir». Una puede ser tu inicio.',
		targets: ['button.launch.keys', 'button.launch.thumb']
	},
	{
		title: 'Avisos al móvil',
		text: 'En AVISOS eliges qué te llega al móvil (con la app gratuita ntfy): temas, cuántos al día y horas de silencio. La bienvenida te deja una propuesta lista.',
		targets: []
	},
	{
		title: 'Tenlo en el móvil',
		text: 'iPhone: en Safari, Compartir → «Añadir a pantalla de inicio». Android: en Chrome, menú ⋮ → «Instalar aplicación». Se abre como una app y funciona sin conexión con lo último guardado.',
		targets: []
	}
];
