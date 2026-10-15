// Banco Mundial, Pink Sheet: precios medios mensuales de materias primas (cacao, café, fertilizantes, níquel…).
// Sin clave; datos abiertos (CC BY 4.0, citando al Banco Mundial). Sale a primeros de cada mes.
// https://www.worldbank.org/en/research/commodity-markets · El enlace al .xlsx cambia con cada publicación:
// se saca de la página en cada pasada. Se lee con exceljs, solo aquí.
import ExcelJS from 'exceljs';
import { parsePinkSheet, pinkLink, type PinkSheetData } from '../../src/lib/pinksheet.ts';
import { getText, request, type Source } from '../lib.ts';

const PAGE = 'https://www.worldbank.org/en/research/commodity-markets';

/** El valor de una celda de exceljs, sin envoltorios: fórmulas → su resultado. */
function plainCell(v: ExcelJS.CellValue): unknown {
	return v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? v.result : v;
}

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
		const book = new ExcelJS.Workbook();
		await book.xlsx.load(await (await request(url)).arrayBuffer());
		const sheet = book.worksheets.find((s) => /monthly prices/i.test(s.name));
		if (!sheet) throw new Error(`el .xlsx no tiene la hoja «Monthly Prices» (${book.worksheets.map((s) => s.name).join(', ')})`);
		const cells: unknown[][] = [];
		sheet.eachRow((row) => cells.push((row.values as ExcelJS.CellValue[]).slice(1).map(plainCell)));
		const rows = parsePinkSheet(cells);
		if (rows.length < 10) throw new Error(`el Pink Sheet trae ${rows.length} de las materias primas que se piden`);
		return { rows };
	}
};
