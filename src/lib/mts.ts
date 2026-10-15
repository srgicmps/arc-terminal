// Cuentas del Tesoro de EE. UU. (Monthly Treasury Statement): déficit del año fiscal y aranceles cobrados.
// El año fiscal va de octubre a septiembre: «FY2026» empieza el 1 de octubre de 2025.

export interface MtsData {
	/** Último mes publicado (fin de mes, AAAA-MM-DD). */
	asOf: string;
	fiscalYear: number;
	/** Déficit acumulado del año fiscal, en dólares (positivo = déficit). */
	deficit: number;
	/** El mismo acumulado un año antes, si está. */
	deficitPrior: number | null;
	/** Aranceles cobrados en el año fiscal: bruto y neto de devoluciones. */
	customsGross: number;
	customsNet: number;
	customsGrossPrior: number | null;
	customsNetPrior: number | null;
}

export type MtsRow = Record<string, string | undefined>;

const num = (s: string | undefined): number | null => {
	const n = s === undefined || s === 'null' ? NaN : Number(s);
	return Number.isFinite(n) ? n : null;
};

/** Mismo fin de mes, un año antes. */
function yearBefore(date: string): string {
	return `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
}

/**
 * Déficit acumulado por fecha. Cada mes, la tabla 1 trae dos filas «Year-to-Date»: la del año fiscal anterior
 * completo y la del año en curso, que va más abajo en el informe (`src_line_nbr` mayor).
 */
export function deficitByDate(rows: MtsRow[]): Map<string, number> {
	const best = new Map<string, { line: number; v: number }>();
	for (const r of rows) {
		const v = num(r.current_month_dfct_sur_amt);
		const line = Number(r.src_line_nbr);
		if (!r.record_date || v === null || !Number.isFinite(line)) continue;
		const prev = best.get(r.record_date);
		if (!prev || line > prev.line) best.set(r.record_date, { line, v });
	}
	return new Map([...best].map(([d, { v }]) => [d, v]));
}

/** Junta la tabla 1 (déficit) y la fila «Customs Duties» de la tabla 4 del último mes que tengan las dos. */
export function parseMts(table1: MtsRow[], customs: MtsRow[]): MtsData | null {
	const deficits = deficitByDate(table1);
	const latest = customs
		.filter((r) => r.record_date && deficits.has(r.record_date))
		.sort((a, b) => b.record_date!.localeCompare(a.record_date!))[0];
	if (!latest) return null;
	const asOf = latest.record_date!;
	const gross = num(latest.current_fytd_gross_rcpt_amt);
	const net = num(latest.current_fytd_net_rcpt_amt);
	if (gross === null || net === null) return null;
	return {
		asOf,
		fiscalYear: Number(latest.record_fiscal_year) || Number(asOf.slice(0, 4)) + (Number(asOf.slice(5, 7)) >= 10 ? 1 : 0),
		deficit: deficits.get(asOf)!,
		deficitPrior: deficits.get(yearBefore(asOf)) ?? null,
		customsGross: gross,
		customsNet: net,
		customsGrossPrior: num(latest.prior_fytd_gross_rcpt_amt),
		customsNetPrior: num(latest.prior_fytd_net_rcpt_amt)
	};
}
