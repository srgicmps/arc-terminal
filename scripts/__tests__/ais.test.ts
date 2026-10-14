import { afterEach, describe, expect, it, vi } from 'vitest';
import { PORTS, ais, collect, listen, shipType } from '../sources/ais.ts';

const NOW = Date.parse('2026-10-14T12:00:30Z');
const meta = (mmsi: number, name = '', lat = 39.88, lon = 4.27) => ({ MMSI: mmsi, ShipName: name, latitude: lat, longitude: lon, time_utc: '2026-10-14 12:00:05.123456 +0000 UTC' });
const position = (mmsi: number, sog: number, nav = 0, lat = 39.88, lon = 4.27) => ({
	MessageType: 'PositionReport',
	MetaData: meta(mmsi, 'X', lat, lon),
	Message: { PositionReport: { Sog: sog, NavigationalStatus: nav, Latitude: lat, Longitude: lon } }
});
const fixed = (mmsi: number, name: string, type: number, destination = '') => ({
	MessageType: 'ShipStaticData',
	MetaData: meta(mmsi, name),
	Message: { ShipStaticData: { Name: name, Type: type, Destination: destination } }
});

/** WebSocket de mentira: al abrirse, manda `replies` y se cierra cuando lo cierran. */
function fakeSocket(replies: unknown[], sent: string[]) {
	return class {
		binaryType = '';
		onopen?: () => void;
		onmessage?: (e: { data: unknown }) => void;
		onclose?: () => void;
		onerror?: () => void;
		constructor(public url: string) {
			queueMicrotask(() => {
				this.onopen?.();
				for (const r of replies) this.onmessage?.({ data: typeof r === 'string' ? r : new TextEncoder().encode(JSON.stringify(r)).buffer });
			});
		}
		send(text: string) {
			sent.push(text);
		}
		close() {
			queueMicrotask(() => this.onclose?.());
		}
	};
}

afterEach(() => vi.unstubAllEnvs());

describe('ais', () => {
	it('traduce el tipo AIS', () => {
		expect([shipType(60), shipType(70), shipType(84), shipType(37), shipType(0)]).toEqual(['Pasaje', 'Carga', 'Petrolero', 'Recreo', '']);
	});

	it('reparte los barcos por puerto con nombre, tipo, velocidad y estado', () => {
		const data = collect(
			[fixed(1, 'CIUDAD DE MAHON', 60, 'BARCELONA'), position(1, 0, 5), position(2, 7.4, 0, 40.0, 3.83), position(3, 102.3, 0, 41, 2)],
			undefined,
			NOW
		);
		expect(data.ports[0]).toMatchObject({
			id: 'mao',
			total: 1,
			ships: [{ mmsi: 1, name: 'CIUDAD DE MAHON', type: 'Pasaje', speed: 0, status: 'Amarrado', destination: 'BARCELONA', time: '2026-10-14T12:00:05.000Z' }]
		});
		expect(data.ports[1].ships).toMatchObject([{ mmsi: 2, speed: 7.4, status: 'Navegando', type: '' }]);
		// El barco 3 está fuera de los dos recuadros.
		expect(data.ports.flatMap((p) => p.ships).map((s) => s.mmsi)).toEqual([1, 2]);
	});

	it('recuerda el nombre y el tipo de la vez anterior y olvida lo de hace más de 3 h', () => {
		const before = collect([fixed(1, 'ILLA', 70), position(1, 0, 1)], undefined, NOW);
		const later = NOW + 3600_000;
		const moved = { ...position(1, 3), MetaData: { ...meta(1, ''), time_utc: '2026-10-14 13:00:00 +0000 UTC' } };
		expect(collect([moved], before, later).ports[0].ships[0]).toMatchObject({ name: 'ILLA', type: 'Carga', status: 'Navegando', speed: 3 });
		expect(collect([], before, NOW + 4 * 3600_000).ports[0].ships).toEqual([]);
	});

	it('se suscribe con la clave y los recuadros, y falla si aisstream responde con un error', async () => {
		const sent: string[] = [];
		vi.stubGlobal('WebSocket', fakeSocket([position(1, 0)], sent));
		expect(await listen('clave', 10)).toHaveLength(1);
		const sub = JSON.parse(sent[0]);
		expect(sub.APIKey).toBe('clave');
		expect(sub.BoundingBoxes).toHaveLength(PORTS.length);

		vi.stubGlobal('WebSocket', fakeSocket([JSON.stringify({ error: 'Api Key Is Not Valid' })], []));
		await expect(listen('mala', 10)).rejects.toThrow('Api Key Is Not Valid');
	});

	it('necesita la clave AISSTREAM_API_KEY', () => {
		expect(ais.requires).toBe('AISSTREAM_API_KEY');
	});
});
