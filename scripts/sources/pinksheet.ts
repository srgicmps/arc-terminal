// Banco Mundial, Pink Sheet: precios medios mensuales de materias primas (cacao, café, fertilizantes, níquel…).
// Sin clave; datos abiertos (CC BY 4.0, citando al Banco Mundial). Sale a primeros de cada mes.
// https://www.worldbank.org/en/research/commodity-markets · El enlace al .xlsx cambia con cada publicación:
// se saca de la página en cada pasada. Se lee con scripts/xlsx.ts.
import { parsePinkSheet, pinkLink, type PinkSheetData } from '../../src/lib/pinksheet.ts';
import { getText, request, type Source } from '../lib.ts';
import { readXlsx } from '../xlsx.ts';

const PAGE = 'https://www.worldbank.org/en/research/commodity-markets';

export const pinksheet: Source<PinkSheetData> = {
	name: 'pinksheet',
	label: 'Materias primas, precios mensuales · Banco Mundial (Pink Sheet)',
	// Sale una vez al mes: una vez al día sobra.
	maxAgeMinutes: 1440,
	// El .xlsx pesa unos megas: más plazo que el de por defecto.
	deadlineMs: 150_000,
	async fetch() {
		const url = pinkLink(await getText(PAGE));
		if (!url) throw new Error('la página del Banco Mundial no trae el enlace al CMO-Historical-Data-Monthly.xlsx');
		// Solo se lee la hoja de precios; los nombres de todas, por si falta.
		const names: string[] = [];
		const [sheet] = readXlsx(await (await request(url)).arrayBuffer(), (name) => {
			names.push(name);
			return /monthly prices/i.test(name);
		});
		if (!sheet) throw new Error(`el .xlsx no tiene la hoja «Monthly Prices» (${names.join(', ')})`);
		const rows = parsePinkSheet(sheet.rows);
		if (rows.length < 10) throw new Error(`el Pink Sheet trae ${rows.length} de las materias primas que se piden`);
		return { rows };
	}
};
