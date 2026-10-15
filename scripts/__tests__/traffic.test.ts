import { describe, expect, it } from 'vitest';
import { kindOf, parseTraffic } from '../sources/traffic.ts';

// Recortado de la respuesta real de la DGT (sondeo del 15/10/2026).
const point = (lat: number, lon: number, km: number, prov: string, town: string) => `
	<loc:pointCoordinates><loc:latitude>${lat}</loc:latitude><loc:longitude>${lon}</loc:longitude></loc:pointCoordinates>
	<loc:_tpegNonJunctionPointExtension><loc:extendedTpegNonJunctionPoint>
		<lse:autonomousCommunity>Castilla - La Mancha</lse:autonomousCommunity><lse:kilometerPoint>${km}</lse:kilometerPoint>
		<lse:municipality>${town}</lse:municipality><lse:province>${prov}</lse:province>
	</loc:extendedTpegNonJunctionPoint></loc:_tpegNonJunctionPointExtension>`;
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<d2:payload xsi:type="sit:SituationPublication" xmlns:com="c" xmlns:loc="l" xmlns:lse="e" xmlns:d2="d" xmlns:sit="s" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<com:publicationTime>2026-10-15T13:11:12.026+02:00</com:publicationTime>
<sit:situation id="2816645"><sit:situationRecord xsi:type="sit:RoadOrCarriagewayOrLaneManagement" id="18811074" version="2">
	<sit:validity><com:validityTimeSpecification><com:overallStartTime>2025-12-12T08:05:19.000+01:00</com:overallStartTime></com:validityTimeSpecification></sit:validity>
	<sit:cause><sit:causeType>roadMaintenance</sit:causeType><sit:detailedCauseType><sit:roadMaintenanceType>roadworks</sit:roadMaintenanceType></sit:detailedCauseType></sit:cause>
	<sit:locationReference xsi:type="loc:SingleRoadLinearLocation">
		<loc:supplementaryPositionalDescription><loc:carriageway><loc:lane><loc:laneUsage>allLanesCompleteCarriageway</loc:laneUsage></loc:lane></loc:carriageway>
		<loc:roadInformation><loc:roadName>N-400</loc:roadName></loc:roadInformation></loc:supplementaryPositionalDescription>
		<loc:tpegLinearLocation><loc:to>${point(39.994446, -3.6054852, 37.3, 'Toledo', 'Ontígola')}</loc:to><loc:from>${point(39.993732, -3.6074991, 37.1, 'Toledo', 'Ontígola')}</loc:from>
		<loc:_tpegLinearLocationExtension><loc:extendedTpegLinearLocation><lse:tpegDirectionRoad>both</lse:tpegDirectionRoad></loc:extendedTpegLinearLocation></loc:_tpegLinearLocationExtension></loc:tpegLinearLocation>
	</sit:locationReference>
</sit:situationRecord></sit:situation>
<sit:situation id="2"><sit:situationRecord xsi:type="sit:AbnormalTraffic" id="9"><sit:abnormalTrafficType>stationaryTraffic</sit:abnormalTrafficType>
	<sit:locationReference><loc:roadInformation><loc:roadName>A-4</loc:roadName></loc:roadInformation>${point(40.1, -3.6, 12, 'Toledo', 'Seseña')}</sit:locationReference>
</sit:situationRecord></sit:situation>
<sit:situation id="3"><sit:situationRecord xsi:type="sit:Accident" id="10"><sit:locationReference>${point(1, 1, 1, '', '')}</sit:locationReference></sit:situationRecord></sit:situation>
</d2:payload>`;

describe('traffic (F4)', () => {
	it('lee las incidencias, las agrupa por provincia y descarta las que no tienen carretera', () => {
		const { data, byProvince } = parseTraffic(XML);
		expect(data.published).toBe('2026-10-15T13:11:12.026+02:00');
		expect(data.provinces).toEqual([
			{ id: 'toledo', name: 'Toledo', region: 'Castilla - La Mancha', total: 2, closed: 1, kinds: { obras: 1, retencion: 1 } }
		]);
		const [works, jam] = byProvince.get('toledo')!;
		expect(works).toMatchObject({
			id: '18811074',
			kind: 'obras',
			closed: true,
			what: 'Obras',
			road: 'N-400',
			town: 'Ontígola',
			km: [37.1, 37.3],
			direction: 'ambos sentidos',
			start: '2025-12-12T08:05:19.000+01:00',
			end: ''
		});
		expect(jam).toMatchObject({ kind: 'retencion', closed: false, what: 'Tráfico detenido', road: 'A-4', km: [12, 12] });
	});

	it('kindOf', () => {
		expect(kindOf('Accident', '')).toBe('accidente');
		expect(kindOf('PoorEnvironmentConditions', 'poorEnvironment')).toBe('meteo');
		expect(kindOf('GeneralObstruction', 'obstruction')).toBe('obstaculo');
		expect(kindOf('RoadOrCarriagewayOrLaneManagement', '')).toBe('otro');
	});
});
