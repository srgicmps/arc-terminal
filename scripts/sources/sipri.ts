// SIPRI Military Expenditure Database: gasto militar por país, en dólares y en % del PIB. Sin clave.
// https://www.sipri.org/databases/milex · El Excel se publica una vez al año (en abril) y alguna corrección
// después («_v1.2»). Uso libre citando al SIPRI. Se lee con exceljs, solo aquí.
import ExcelJS from 'exceljs';
import { parseMilex, type MilexData, type Sheet } from '../../src/lib/milex.ts';
import { getText, request, type Source } from '../lib.ts';

const PAGE = 'https://www.sipri.org/databases/milex';

/** El enlace al Excel que da la página («…/SIPRI-Milex-data-1949-2025_v1.2.xlsx»); null si no lo encuentra. */
export function milexLink(html: string): string | null {
	const links = [...html.matchAll(/[^"'<>\s]*SIPRI-Milex-data-\d{4}-(\d{4})[^"'<>\s]*?\.xlsx/gi)];
	// Si hay varios, el del último año.
	const best = links.sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
	return best ? new URL(best, PAGE).href : null;
}

/** El valor de una celda de exceljs, sin envoltorios: fórmulas → su resultado. */
function plainCell(v: ExcelJS.CellValue): unknown {
	return v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? v.result : v;
}

export const sipri: Source<MilexData> = {
	name: 'sipri',
	label: 'Gasto militar por país · SIPRI',
	// Sale una vez al año: una vez al día sobra.
	maxAgeMinutes: 1440,
	deadlineMs: 150_000,
	async fetch() {
		const year = new Date().getUTCFullYear();
		const url =
			milexLink(await getText(PAGE).catch(() => '')) ??
			`https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-${year - 1}.xlsx`;
		const book = new ExcelJS.Workbook();
		await book.xlsx.load(await (await request(url)).arrayBuffer());
		const sheets: Sheet[] = book.worksheets
			.filter((s) => /^(current|constant|share of gdp)/i.test(s.name))
			.map((sheet) => {
				const cells: unknown[][] = [];
				sheet.eachRow((row) => cells.push((row.values as ExcelJS.CellValue[]).slice(1).map(plainCell)));
				return { name: sheet.name, cells };
			});
		const data = parseMilex(sheets);
		if (!data) throw new Error(`el Excel del SIPRI no trae la hoja en dólares corrientes (${url})`);
		return data;
	}
};
