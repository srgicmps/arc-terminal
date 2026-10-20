// Comisión Europea, Weekly Oil Bulletin: precios de venta al público de la gasolina 95 y el diésel en cada
// país de la UE, con y sin impuestos. Sin clave. Sale los jueves con los precios del lunes.
// https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en
// Se usa el histórico (.xlsx): trae la media ponderada de la UE y columnas con nombre fijo
// («ES_price_with_tax_euro95»), en dos hojas, con y sin impuestos. Se lee con scripts/xlsx.ts.
import { parseOilBulletin, type EuFuelData } from '../../src/lib/fuel.ts';
import { getText, request, type Source } from '../lib.ts';
import { readXlsx } from '../xlsx.ts';

const PAGE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
// El enlace del histórico, por si la página cambia de forma: se busca primero en ella.
const HISTORY =
	'https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx';

/** El enlace al histórico que da la página («…/document/download/<id>_en?filename=…Prices_History…xlsx»). */
export function historyLink(html: string): string | null {
	const path = /\/document\/download\/[^"'<>\s]+?Prices_History[^"'<>\s]*?\.xlsx/i.exec(html)?.[0];
	return path ? new URL(path.replaceAll('&amp;', '&'), PAGE).href : null;
}

export const oilbulletin: Source<EuFuelData> = {
	name: 'oilbulletin',
	label: 'Gasolina y diésel en Europa · Comisión Europea (Weekly Oil Bulletin)',
	// Sale una vez por semana: dos veces al día sobra.
	maxAgeMinutes: 720,
	// El histórico pesa unos megas: más plazo que el de por defecto.
	deadlineMs: 150_000,
	async fetch() {
		const url = historyLink(await getText(PAGE).catch(() => '')) ?? HISTORY;
		// Solo las hojas de precios (las demás ni se leen); cada una, como matriz de celdas.
		const sheets = readXlsx(await (await request(url)).arrayBuffer(), (name) => /price/i.test(name));
		const data = parseOilBulletin(sheets.map((s) => s.rows));
		if (!data) throw new Error('el histórico del Oil Bulletin no trae precios de España');
		return data;
	}
};
