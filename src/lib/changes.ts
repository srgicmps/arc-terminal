// NOVEDADES: lo fusionado en Arc Terminal, agrupado por día de Madrid. Funciones puras (con tests).
import { COMMANDS } from './commands.ts';
import { dm, weekday } from './format.ts';
import { madridDate } from './meetings.ts';
import type { Change } from './types.ts';

/**
 * La vista a la que se refiere un cambio, si el título empieza por su comando: «LUZ: 25 horas…» → LUZ,
 * «ECO (M6): PIB…» → ECO, «GEO y USGOV: sanciones…» → GEO. null si no empieza por un comando conocido.
 */
export function changeCommand(title: string): (typeof COMMANDS)[number] | null {
	const head = /^([A-ZÁÉÍÓÚÑ]{2,})\b[^:]{0,30}:/.exec(title.trim())?.[1];
	return (head && COMMANDS.find((c) => c.code === head)) || null;
}

export interface ChangeDay {
	/** «2026-10-14» en Madrid. */
	day: string;
	/** «Hoy», «Ayer» o «lun 12 oct». */
	label: string;
	items: Change[];
}

/** Los cambios agrupados por día de Madrid, del más reciente al más antiguo (como vienen). */
export function byDay(items: Change[], now: number): ChangeDay[] {
	const today = madridDate(now);
	const yesterday = madridDate(now - 86_400_000);
	const days: ChangeDay[] = [];
	for (const item of items) {
		const day = madridDate(Date.parse(item.mergedAt));
		let group = days.at(-1);
		if (group?.day !== day) {
			const label =
				day === today ? 'Hoy' : day === yesterday ? 'Ayer' : `${weekday(day).split(' ')[0]} ${dm(`${day}T12:00:00Z`)}`;
			group = { day, label, items: [] };
			days.push(group);
		}
		group.items.push(item);
	}
	return days;
}
