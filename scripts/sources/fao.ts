// FAO: índice de precios de los alimentos (FFPI) y sus 5 subíndices, mensuales, 2014–2016 = 100. Sin clave.
// La FAO solo lo publica como .xlsx (https://www.fao.org/worldfoodsituation/foodpricesindex/en/), una vez
// al mes, el primer viernes. Se lee con exceljs, que solo usa este script: no llega al navegador.
import ExcelJS from 'exceljs';
import { parseFaoSheet, releaseDate, type FaoData } from '../../src/lib/fao.ts';
import { getText, request, type Source } from '../lib.ts';

const PAGE = 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/';
const XLSX = 'https://www.fao.org/media/docs/worldfoodsituationlibraries/default-document-library/food_price_indices_data.xlsx';

/** El valor de una celda de exceljs, sin envoltorios: fórmulas → su resultado, texto enriquecido → texto. */
function plainCell(v: ExcelJS.CellValue): unknown {
	if (v && typeof v === 'object' && !(v instanceof Date)) {
		if ('result' in v) return v.result;
		if ('richText' in v) return v.richText.map((t) => t.text).join('');
		if ('text' in v) return v.text;
	}
	return v;
}

export const fao: Source<FaoData> = {
	name: 'fao',
	label: 'Índice de precios de los alimentos · FAO',
	// Sale una vez al mes: una vez al día sobra.
	maxAgeMinutes: 1440,
	async fetch() {
		const [file, page] = await Promise.all([
			request(XLSX).then((r) => r.arrayBuffer()),
			// La fecha de publicación es un extra: si la página falla, la tabla sale igual.
			getText(PAGE).catch(() => '')
		]);
		const book = new ExcelJS.Workbook();
		await book.xlsx.load(file);
		// La hoja mensual es la que da más puntos (la anual no tiene meses y se queda vacía).
		let best: FaoData['series'] = [];
		for (const sheet of book.worksheets) {
			const cells: unknown[][] = [];
			sheet.eachRow((row) => cells.push((row.values as ExcelJS.CellValue[]).slice(1).map(plainCell)));
			const series = parseFaoSheet(cells);
			if ((series[0]?.points.length ?? 0) > (best[0]?.points.length ?? 0)) best = series;
		}
		if (best.length < 6) throw new Error(`el .xlsx de la FAO trae ${best.length} de 6 series`);
		// Se guardan 3 años: lo que enseña el minigráfico y la variación anual.
		const series = best.map((s) => ({ ...s, points: s.points.slice(-37) }));
		return { series, released: releaseDate(page) };
	}
};
