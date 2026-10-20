// SIPRI Military Expenditure Database: gasto militar por país, en dólares y en % del PIB. Sin clave.
// https://www.sipri.org/databases/milex · El Excel se publica una vez al año (en abril) y alguna corrección
// después («_v1.2»). Uso libre citando al SIPRI. Se lee con scripts/xlsx.ts.
import { parseMilex, type MilexData } from '../../src/lib/milex.ts';
import { getText, request, type Source } from '../lib.ts';
import { readXlsx } from '../xlsx.ts';

const PAGE = 'https://www.sipri.org/databases/milex';

/** El enlace al Excel que da la página («…/SIPRI-Milex-data-1949-2025_v1.2.xlsx»); null si no lo encuentra. */
export function milexLink(html: string): string | null {
	const links = [...html.matchAll(/[^"'<>\s]*SIPRI-Milex-data-\d{4}-(\d{4})[^"'<>\s]*?\.xlsx/gi)];
	// Si hay varios, el del último año.
	const best = links.sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
	return best ? new URL(best, PAGE).href : null;
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
		const sheets = readXlsx(await (await request(url)).arrayBuffer(), (name) =>
			/^(current|constant|share of gdp)/i.test(name)
		);
		const data = parseMilex(sheets.map(({ name, rows }) => ({ name, cells: rows })));
		if (!data) throw new Error(`el Excel del SIPRI no trae la hoja en dólares corrientes (${url})`);
		return data;
	}
};
