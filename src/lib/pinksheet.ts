// Pink Sheet del Banco Mundial: precios medios mensuales de materias primas que no salen ya en directo en WS
// (TradingView da el petróleo, el gas de EE. UU., el oro, la plata, el cobre, el trigo y el maíz).
// scripts/sources/pinksheet.ts lee el .xlsx y pasa la hoja «Monthly Prices» como matriz de celdas. Pura, para probarla.

export interface PinkRow {
	id: string;
	label: string;
	group: string;
	/** Unidad tal como la da el Banco Mundial: «$/mt», «$/kg», «$/mmbtu». */
	unit: string;
	/** Meses («2026-09») del más antiguo al más reciente; los 13 últimos, para la variación anual. */
	points: { t: string; v: number }[];
}

export interface PinkSheetData {
	rows: PinkRow[];
}

/** Lo que se toma, con el nombre de la columna en la hoja (en inglés, sin los «**» de las notas). */
export const PINK_WANTED = [
	{ id: 'gas-eu', match: 'Natural gas, Europe', label: 'Gas natural, Europa', group: 'Energía' },
	{ id: 'lng-jp', match: 'Liquefied natural gas, Japan', label: 'GNL, Japón', group: 'Energía' },
	{ id: 'coal', match: 'Coal, Australian', label: 'Carbón, Australia', group: 'Energía' },
	{ id: 'cocoa', match: 'Cocoa', label: 'Cacao', group: 'Alimentos' },
	{ id: 'arabica', match: 'Coffee, Arabica', label: 'Café arábica', group: 'Alimentos' },
	{ id: 'robusta', match: 'Coffee, Robusta', label: 'Café robusta', group: 'Alimentos' },
	{ id: 'sugar', match: 'Sugar, world', label: 'Azúcar', group: 'Alimentos' },
	{ id: 'rice', match: 'Rice, Thai 5%', label: 'Arroz, Tailandia 5 %', group: 'Alimentos' },
	{ id: 'soybeans', match: 'Soybeans', label: 'Soja', group: 'Alimentos' },
	{ id: 'palm', match: 'Palm oil', label: 'Aceite de palma', group: 'Alimentos' },
	{ id: 'cotton', match: 'Cotton, A Index', label: 'Algodón', group: 'Materias agrícolas' },
	{ id: 'rubber', match: 'Rubber, RSS3', label: 'Caucho', group: 'Materias agrícolas' },
	{ id: 'urea', match: 'Urea', label: 'Urea', group: 'Fertilizantes' },
	{ id: 'dap', match: 'DAP', label: 'Fosfato diamónico (DAP)', group: 'Fertilizantes' },
	{ id: 'potash', match: 'Potassium chloride', label: 'Cloruro potásico', group: 'Fertilizantes' },
	{ id: 'aluminum', match: 'Aluminum', label: 'Aluminio', group: 'Metales' },
	{ id: 'iron', match: 'Iron ore, cfr spot', label: 'Mineral de hierro', group: 'Metales' },
	{ id: 'nickel', match: 'Nickel', label: 'Níquel', group: 'Metales' },
	{ id: 'zinc', match: 'Zinc', label: 'Zinc', group: 'Metales' },
	{ id: 'tin', match: 'Tin', label: 'Estaño', group: 'Metales' },
	{ id: 'platinum', match: 'Platinum', label: 'Platino', group: 'Metales' }
] as const;

/** Cuántos meses se guardan: el último y el de hace un año. */
const KEEP = 13;

const clean = (c: unknown) => String(c ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** El enlace al .xlsx mensual que da la página («…/CMO-Historical-Data-Monthly.xlsx»). */
export function pinkLink(html: string): string | null {
	return /https?:\/\/[^"'<>\s]+CMO-Historical-Data-Monthly\.xlsx/i.exec(html)?.[0] ?? null;
}

/**
 * Busca la fila con los nombres (la que tiene «Cocoa»), toma las unidades de la siguiente («($/mt)») y lee las
 * filas que empiezan por un mes («2026M09»). Las celdas vacías o con «…» no cuentan.
 */
export function parsePinkSheet(cells: unknown[][]): PinkRow[] {
	const head = cells.findIndex((row) => row.some((c) => clean(c) === 'cocoa'));
	if (head < 0) return [];
	const names = cells[head].map(clean);
	const units = cells[head + 1] ?? [];
	const months = cells.slice(head + 1).flatMap((row) => {
		const m = /^(\d{4})M(\d{2})$/.exec(String(row[0] ?? '').trim());
		return m ? [{ t: `${m[1]}-${m[2]}`, row }] : [];
	});
	return PINK_WANTED.flatMap((w) => {
		const col = names.indexOf(w.match.toLowerCase());
		if (col < 0) return [];
		const points = months.flatMap(({ t, row }) => {
			const v = row[col];
			return typeof v === 'number' && Number.isFinite(v) ? [{ t, v }] : [];
		});
		if (!points.length) return [];
		const unit = String(units[col] ?? '').replace(/[()]/g, '').trim();
		return [{ id: w.id, label: w.label, group: w.group, unit, points: points.slice(-KEEP) }];
	});
}

/** Variación en % del último mes frente al anterior y frente al mismo mes de hace un año (null si falta). */
export function pinkChanges(points: PinkRow['points']): { month: number | null; year: number | null } {
	const last = points.at(-1);
	if (!last) return { month: null, year: null };
	const pct = (p?: { v: number }) => (p && p.v ? (last.v / p.v - 1) * 100 : null);
	const yearAgo = `${Number(last.t.slice(0, 4)) - 1}${last.t.slice(4)}`;
	return { month: pct(points.at(-2)), year: pct(points.find((p) => p.t === yearAgo)) };
}
