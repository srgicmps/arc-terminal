// FAO: índice de precios de los alimentos (FFPI) y sus 5 subíndices, mensuales, 2014–2016 = 100. Sin clave.
// https://www.fao.org/worldfoodsituation/foodpricesindex/en/ · Sale una vez al mes, el primer viernes.
// La FAO da un .xlsx con el mes en el nombre y un CSV con nombre fijo («Date,Food Price Index,Meat,…»):
// se usa el CSV, que se lee sin librerías. La fecha de publicación sale de la página.
import { parseFaoSheet, releaseDate, type FaoData } from '../../src/lib/fao.ts';
import { getText, type Source } from '../lib.ts';

const PAGE = 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/';
const CSV = 'https://www.fao.org/media/docs/worldfoodsituationlibraries/wfs-library/food_price_indices_data.csv';

export const fao: Source<FaoData> = {
	name: 'fao',
	label: 'Índice de precios de los alimentos · FAO',
	// Sale una vez al mes: una vez al día sobra.
	maxAgeMinutes: 1440,
	async fetch() {
		const [csv, page] = await Promise.all([
			getText(CSV),
			// La fecha de publicación es un extra: si la página falla, la tabla sale igual.
			getText(PAGE).catch(() => '')
		]);
		const series = parseFaoSheet(csv.split(/\r?\n/).map((line) => line.split(',')));
		if (series.length < 6) throw new Error(`el CSV de la FAO trae ${series.length} de 6 series`);
		// Se guardan 3 años y un mes: lo que enseña el minigráfico y la variación anual.
		return { series: series.map((s) => ({ ...s, points: s.points.slice(-37) })), released: releaseDate(page) };
	}
};
