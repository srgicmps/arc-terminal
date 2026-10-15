import type { Command } from '../commands.ts';

export default {
	order: 290, code: 'ADMIN', route: '/admin', key: 'Administración', desc: 'Solo Sergi: usuarios, invitaciones y sugerencias', sources: 'Cloudflare Access', aliases: ['administrador', 'usuarios'],
	manual: {
		section: 'Sistema',
		what: 'Panel del administrador: quién usa la web y cuándo entró por última vez, invitar o quitar a alguien y las sugerencias recibidas. A cualquier otra cuenta le dice «Solo para el administrador».',
		panels: [
			{ name: 'Usuarios', what: 'Último acceso, si tiene avisos y «Quitar».' },
			{ name: 'Invitar', what: 'Añade un email a la política de Access: le llega un código al entrar.' },
			{ name: 'Sugerencias', what: 'Lo que llega por «Sugerencias / algo va mal», con la vista y la fecha.' }
		]
	}
} satisfies Command;
