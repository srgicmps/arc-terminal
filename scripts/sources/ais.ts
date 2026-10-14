// Barcos en los puertos, con los mensajes AIS en directo de aisstream.io (gratis, en beta y sin
// garantía). Solo hay WebSocket: en cada pasada se abre una conexión, se escucha unos 45 s dentro de
// los recuadros de PORTS y se cierra. Sin reintentos: si falla, se reutiliza la copia anterior.
// Términos: https://aisstream.io/ (los datos se dan tal cual; hay que citar a aisstream.io).
// La clave va en el secreto AISSTREAM_API_KEY: sin ella, la fuente se salta.
import type { PortShips, Ship, ShipsData } from '../../src/lib/types.ts';
import { plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const ENV = 'AISSTREAM_API_KEY';
const STREAM = 'wss://stream.aisstream.io/v0/stream';
const LISTEN_MS = 45_000;
/** Un barco del que no llega nada en 3 h ya no está en el puerto. */
const KEEP_MS = 3 * 3600_000;

interface Port {
	id: string;
	name: string;
	/** Recuadro [[lat, lon] suroeste, [lat, lon] noreste], con la bocana y la zona de espera. */
	box: [[number, number], [number, number]];
}

/** Puertos vigilados. Para añadir uno, basta con otra línea. */
export const PORTS: Port[] = [
	{ id: 'mao', name: 'Maó', box: [[39.84, 4.24], [39.91, 4.36]] },
	{ id: 'ciutadella', name: 'Ciutadella', box: [[39.98, 3.79], [40.02, 3.86]] }
];

/**
 * Solo en las Actions de los PR (SAMPLE=1): un recuadro muy transitado (el Estrecho de Gibraltar) para
 * comprobar en el registro que la suscripción funciona aunque en los puertos no haya nadie. Sus barcos
 * no se guardan: collect() solo se queda con los de PORTS.
 */
const CHECK_BOX: Port['box'] = [[35.85, -5.75], [36.1, -5.3]];

/** Tipo de barco según el código AIS (ITU-R M.1371). */
export function shipType(code: number | null | undefined): string {
	const c = Number(code);
	if (!c) return '';
	if (c === 30) return 'Pesca';
	if (c === 31 || c === 32 || c === 52) return 'Remolcador';
	if (c === 35) return 'Militar';
	if (c === 36) return 'Velero';
	if (c === 37) return 'Recreo';
	if (c >= 40 && c < 50) return 'Alta velocidad';
	if (c === 50) return 'Práctico';
	if (c === 51) return 'Salvamento';
	if (c === 55) return 'Policía';
	if (c >= 60 && c < 70) return 'Pasaje';
	if (c >= 70 && c < 80) return 'Carga';
	if (c >= 80 && c < 90) return 'Petrolero';
	return 'Otro';
}

/** Estado: el que da el barco (amarrado, fondeado) o, si no, según su velocidad. */
function status(nav: number | undefined, speed: number | null): string {
	if (nav === 5) return 'Amarrado';
	if (nav === 1) return 'Fondeado';
	if (speed !== null && speed < 0.5) return 'Parado';
	return 'Navegando';
}

const inBox = (lat: number, lon: number, [[s, w], [n, e]]: Port['box']) => lat >= s && lat <= n && lon >= w && lon <= e;

/** «2026-10-14 12:00:05.123456 +0000 UTC» → ISO 8601. */
function aisTime(raw: unknown): string {
	const m = String(raw ?? '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
	return m ? `${m[1]}T${m[2]}.000Z` : new Date().toISOString();
}

/**
 * Junta los mensajes recibidos con lo que ya se sabía de cada barco. Las posiciones dicen dónde está;
 * los datos fijos (nombre, tipo, destino) llegan cada pocos minutos, así que se recuerdan de la vez
 * anterior.
 */
export function collect(messages: Raw[], previous: ShipsData | undefined, now = Date.now()): ShipsData {
	const ships = new Map<number, Ship>();
	for (const port of previous?.ports ?? []) for (const s of port.ships) ships.set(s.mmsi, { ...s });

	for (const msg of messages) {
		const meta = msg?.MetaData ?? {};
		const mmsi = Number(meta.MMSI);
		if (!mmsi) continue;
		const known = ships.get(mmsi);
		const fixed = msg?.Message?.ShipStaticData;
		const pos = msg?.Message?.PositionReport ?? msg?.Message?.StandardClassBPositionReport;
		const name = plain(fixed?.Name, 60) || known?.name || plain(meta.ShipName, 60);
		if (fixed) {
			const ship = known ?? { mmsi, name, type: '', speed: null, status: '', destination: '', lat: Number(meta.latitude), lon: Number(meta.longitude), time: aisTime(meta.time_utc) };
			ship.name = name;
			ship.type = shipType(fixed.Type) || ship.type;
			ship.destination = plain(fixed.Destination, 40) || ship.destination;
			ships.set(mmsi, ship);
		}
		if (pos) {
			// 102,3 nudos significa «no disponible».
			const sog = Number(pos.Sog);
			const speed = Number.isFinite(sog) && sog < 102 ? sog : null;
			ships.set(mmsi, {
				...(ships.get(mmsi) ?? { mmsi, type: '', destination: '' }),
				name,
				speed,
				status: status(pos.NavigationalStatus, speed),
				lat: Number(pos.Latitude ?? meta.latitude),
				lon: Number(pos.Longitude ?? meta.longitude),
				time: aisTime(meta.time_utc)
			} as Ship);
		}
	}

	const ports: PortShips[] = PORTS.map((port) => ({
		id: port.id,
		name: port.name,
		ships: [...ships.values()]
			.filter((s) => s.status && inBox(s.lat, s.lon, port.box) && now - Date.parse(s.time) < KEEP_MS)
			.sort((a, b) => b.time.localeCompare(a.time))
	}));
	return { ports, listened: LISTEN_MS / 1000 };
}

/** Abre una conexión, se suscribe a los recuadros y devuelve los mensajes que lleguen en `ms`. */
export function listen(key: string, ms = LISTEN_MS): Promise<Raw[]> {
	return new Promise((resolve, reject) => {
		const messages: Raw[] = [];
		let error: string | null = null;
		const ws = new WebSocket(STREAM);
		ws.binaryType = 'arraybuffer';
		const done = setTimeout(() => ws.close(), ms);
		ws.onopen = () => {
			// La suscripción tiene que llegar en menos de 3 s desde que se abre la conexión.
			ws.send(
				JSON.stringify({
					APIKey: key,
					BoundingBoxes: [...PORTS.map((p) => p.box), ...(process.env.SAMPLE ? [CHECK_BOX] : [])],
					FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData']
				})
			);
		};
		ws.onmessage = (event) => {
			try {
				const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
				const msg = JSON.parse(text);
				if (msg?.error) error = String(msg.error);
				else messages.push(msg);
			} catch {}
		};
		ws.onerror = () => (error ??= 'error en la conexión con aisstream.io');
		ws.onclose = () => {
			clearTimeout(done);
			// Sin mensajes y con error (clave mala, servicio caído): falla. Sin barcos, es normal.
			if (error && !messages.length) reject(new Error(error));
			else resolve(messages);
		};
	});
}

export const ais: Source<ShipsData> = {
	name: 'ais',
	label: `Barcos en los puertos (${PORTS.map((p) => p.name).join(', ')}) · AIS de aisstream.io`,
	// Cada pasada ocupa 45 s de la Action: con una cada media hora basta.
	maxAgeMinutes: 30,
	requires: ENV,
	async fetch(previous) {
		const messages = await listen(process.env[ENV] ?? '');
		console.log(`  ais · ${messages.length} mensajes AIS en ${LISTEN_MS / 1000} s`);
		return collect(messages, previous);
	}
};
