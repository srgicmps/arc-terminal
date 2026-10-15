import type { Command } from '../commands.ts';

export default {
	order: 192, code: 'QUIEN', route: '/quien', key: 'Quién lo cuenta', desc: 'Quién lo cuenta: el mismo hecho en varios medios, su cobertura por región y los ángulos muertos', sources: 'Todos los medios', aliases: ['quién lo cuenta', 'quien lo cuenta', 'cobertura', 'medios'],
	manual: {
		section: 'Mundo',
		what: 'Las noticias que dan varios medios a la vez, con la región de cada medio (España, Europa, Reino Unido, EE. UU., Oriente Medio, Asia, África) y las regiones que no las cuentan.',
		tips: [
			'Sin IA: junta los titulares que se parecen (también la traducción al español de los que están en inglés) publicados con menos de 24 h de diferencia.',
			'Un «ángulo muerto» es una región con prensa en Arc Terminal que no da la noticia. No quiere decir que la oculte: puede que sus medios no la tengan en portada.'
		],
		panels: [
			{ name: 'Historias', what: 'Cada noticia con las regiones que la cuentan (en color) y las que no (tachadas), y sus medios.' },
			{ name: 'Medios por región', what: 'Qué medios cuentan para cada región.' }
		]
	}
} satisfies Command;
