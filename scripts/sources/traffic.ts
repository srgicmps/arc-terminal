// ES, tráfico (F4): incidencias activas en las carreteras de España, de la DGT. DATEX II v3.7 del Punto de Acceso
// Nacional (nap.dgt.es), sin clave, licencia libre con atribución; se actualiza cada minuto. No cubre Cataluña ni
// el País Vasco. Se guarda un resumen por provincia y, aparte, las incidencias de cada una (traffic/<id>.json),
// que la vista pide al elegir provincia.
import { XMLParser } from 'fast-xml-parser';
import { provinceId, type TrafficData, type TrafficItem, type TrafficKind, type TrafficProvince } from '../../src/lib/traffic.ts';
import { getText, list, writeExtra, type Source } from '../lib.ts';

export const TRAFFIC_URL = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';

type Node = Record<string, any>;

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });

/** Todos los valores de una etiqueta, en cualquier nivel. */
function all(node: unknown, key: string, out: unknown[] = []): unknown[] {
	if (Array.isArray(node)) node.forEach((n) => all(n, key, out));
	else if (node && typeof node === 'object') {
		for (const [k, v] of Object.entries(node)) {
			if (k === key) out.push(...(Array.isArray(v) ? v : [v]));
			all(v, key, out);
		}
	}
	return out;
}
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : v && typeof v === 'object' && '#text' in v ? String((v as Node)['#text']).trim() : '');
const first = (node: unknown, key: string) => all(node, key).map(text).find(Boolean) ?? '';

const WHAT: Record<string, string> = {
	roadworks: 'Obras',
	maintenanceWork: 'Mantenimiento',
	resurfacingWork: 'Asfaltado',
	roadClosed: 'Carretera cortada',
	carriagewayClosures: 'Calzada cortada',
	laneClosures: 'Carril cortado',
	lanesDeviated: 'Desvío de carriles',
	newRoadworksLayout: 'Obras con nuevo trazado',
	useOfSpecifiedLanesOrCarriageways: 'Por carriles señalizados',
	doNotUseSpecifiedLanesOrCarriageways: 'Carriles cerrados',
	obstructionOnTheRoad: 'Obstáculo en la calzada',
	avalanches: 'Aludes',
	singleAlternateLineTraffic: 'Paso alternativo',
	stationaryTraffic: 'Tráfico detenido',
	queuingTraffic: 'Retención',
	slowTraffic: 'Tráfico lento',
	heavyTraffic: 'Tráfico denso',
	accident: 'Accidente',
	snow: 'Nieve',
	ice: 'Hielo',
	fog: 'Niebla',
	flooding: 'Inundación',
	strongWinds: 'Viento fuerte',
	heavyRain: 'Lluvia fuerte',
	rockfalls: 'Desprendimientos',
	landslips: 'Corrimiento de tierras',
	vehicleOnFire: 'Vehículo ardiendo',
	brokenDownVehicle: 'Vehículo averiado',
	objectOnTheRoad: 'Objeto en la calzada',
	animalsOnTheRoad: 'Animales en la calzada',
	chainsRequired: 'Cadenas obligatorias',
	forestFire: 'Incendio forestal'
};

/** Tipo de incidencia a partir del tipo DATEX («sit:Accident») y de la causa («roadMaintenance»). */
export function kindOf(type: string, cause: string): TrafficKind {
	const t = `${type} ${cause}`.toLowerCase();
	if (/abnormaltraffic/.test(t)) return 'retencion';
	if (/accident/.test(t)) return 'accidente';
	if (/poorenvironment|weatherrelated|roadconditions/.test(t)) return 'meteo';
	if (/maintenance|roadworks|construction/.test(t)) return 'obras';
	if (/obstruction|animal|vehicle/.test(t)) return 'obstaculo';
	return 'otro';
}

const DIRECTION: Record<string, string> = { both: 'ambos sentidos', positive: 'creciente', negative: 'decreciente' };

/** Una incidencia de la DGT (situationRecord) con su provincia y comunidad; null si no tiene carretera. */
export function parseRecord(r: Node): { item: TrafficItem; province: string; region: string } | null {
	const type = String(r['@_type'] ?? '').replace(/^.*:/, '');
	const cause = first(r, 'causeType');
	const road = first(r, 'roadName');
	const province = first(r, 'province');
	if (!road || !province) return null;
	// Primero la causa (accidente, nieve, desprendimientos…) y después lo que se hace con los carriles.
	const details = [
		'accidentType',
		'poorEnvironmentType',
		'nonWeatherRelatedRoadConditionType',
		'weatherRelatedRoadConditionType',
		'environmentalObstructionType',
		'vehicleObstructionType',
		'animalPresenceType',
		'obstructionType',
		'abnormalTrafficType',
		'roadMaintenanceType',
		'roadworksType',
		'roadOrCarriagewayOrLaneManagementType'
	].flatMap((k) => all(r, k).map(text));
	const what = details.map((d) => WHAT[d]).find(Boolean) ?? WHAT[cause] ?? '';
	const lanes = all(r, 'laneUsage').map(text);
	const closed =
		lanes.includes('allLanesCompleteCarriageway') || details.some((d) => d === 'roadClosed' || d === 'carriagewayClosures');
	const kms = all(r, 'kilometerPoint')
		.map((v) => Number(text(v)))
		.filter(Number.isFinite);
	const lat = Number(first(r, 'latitude'));
	const lon = Number(first(r, 'longitude'));
	return {
		province,
		region: first(r, 'autonomousCommunity'),
		item: {
			id: String(r['@_id'] ?? ''),
			kind: kindOf(type, cause),
			closed,
			what,
			road,
			town: first(r, 'municipality'),
			km: kms.length ? [Math.min(...kms), Math.max(...kms)] : null,
			direction: DIRECTION[first(r, 'tpegDirectionRoad') || first(r, 'tpegDirection')] ?? '',
			start: first(r, 'overallStartTime'),
			end: first(r, 'overallEndTime'),
			lat: Number.isFinite(lat) && lat ? lat : null,
			lon: Number.isFinite(lon) && lon ? lon : null
		}
	};
}

/** Agrupa por provincia. */
export function parseTraffic(body: string): { data: TrafficData; byProvince: Map<string, TrafficItem[]> } {
	const doc = xml.parse(body) as Node;
	const payload = doc.payload ?? {};
	const byProvince = new Map<string, TrafficItem[]>();
	const meta = new Map<string, { name: string; region: string }>();
	for (const situation of list<Node>(payload.situation)) {
		for (const record of list<Node>(situation.situationRecord)) {
			const got = parseRecord(record);
			if (!got) continue;
			const id = provinceId(got.province);
			if (!byProvince.has(id)) byProvince.set(id, []);
			byProvince.get(id)!.push(got.item);
			if (!meta.has(id)) meta.set(id, { name: got.province, region: got.region });
		}
	}
	const provinces: TrafficProvince[] = [...byProvince].map(([id, items]) => {
		const kinds: TrafficProvince['kinds'] = {};
		for (const i of items) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
		return { id, ...meta.get(id)!, total: items.length, closed: items.filter((i) => i.closed).length, kinds };
	});
	provinces.sort((a, b) => a.name.localeCompare(b.name, 'es'));
	return { data: { published: text(payload.publicationTime), provinces }, byProvince };
}

export const traffic: Source<TrafficData> = {
	name: 'traffic',
	label: 'Tráfico: incidencias en las carreteras de España · DGT (DATEX II)',
	maxAgeMinutes: 25,
	files: (data) => data.provinces.map((p) => `traffic/${p.id}.json`),
	async fetch() {
		const { data, byProvince } = parseTraffic(await getText(TRAFFIC_URL));
		if (data.provinces.length < 20) throw new Error(`solo ${data.provinces.length} provincias`);
		for (const [id, items] of byProvince) await writeExtra(`traffic/${id}.json`, items);
		return data;
	}
};
