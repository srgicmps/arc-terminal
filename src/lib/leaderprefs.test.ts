// Tus líderes: cuáles salen en LIDER y en qué orden.
import { describe, expect, it } from 'vitest';
import { allInOrder, cleanLeaderIds, moveLeader, myLeaders, toggleLeader } from './leaderprefs.ts';
import { LEADERS } from './leaders.ts';

const ALL = LEADERS.map((l) => l.id);
const ids = (list: { id: string }[]) => list.map((l) => l.id);

describe('leaderprefs', () => {
	it('sin nada guardado, todos en el orden de siempre', () => {
		expect(ids(myLeaders(null))).toEqual(ALL);
		expect(cleanLeaderIds('x')).toBeNull();
		expect(cleanLeaderIds([])).toBeNull();
	});

	it('limpia lo guardado: ids que existen, sin repetir', () => {
		expect(cleanLeaderIds(['lagarde', 'nadie', 'lagarde', 3, 'trump'])).toEqual(['lagarde', 'trump']);
	});

	it('apagar quita y encender añade al final; el último no se apaga', () => {
		const off = toggleLeader(null, 'trump');
		expect(off).toEqual(ALL.filter((x) => x !== 'trump'));
		expect(toggleLeader(off, 'trump')).toEqual([...ALL.filter((x) => x !== 'trump'), 'trump']);
		expect(toggleLeader(['lagarde'], 'lagarde')).toEqual(['lagarde']);
	});

	it('mueve arriba y abajo; volver al orden de siempre es null', () => {
		const moved = moveLeader(null, ALL[1], -1);
		expect(moved?.slice(0, 2)).toEqual([ALL[1], ALL[0]]);
		expect(moveLeader(moved, ALL[1], 1)).toBeNull();
		expect(moveLeader(null, ALL[0], -1)).toBeNull();
	});

	it('allInOrder pone los ocultos al final', () => {
		expect(ids(allInOrder(['lagarde']))).toEqual(['lagarde', ...ALL.filter((x) => x !== 'lagarde')]);
	});
});
