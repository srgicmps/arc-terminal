// Cuota de una hipoteca a tipo variable (sistema francés: todas las cuotas iguales). Se calcula en el navegador.
import { last } from './series.ts';
import type { Point, Series } from './types.ts';

/**
 * Cuota mensual de un préstamo de `capital` euros a `years` años con un tipo anual `ratePct` (en %).
 * Fórmula: cuota = C · i / (1 − (1 + i)^−n), con i el tipo mensual (ratePct / 100 / 12) y n el número de cuotas.
 * Si el tipo es 0 (o negativo: desde la Ley 5/2019 el interés de una hipoteca no puede bajar de 0), es C / n.
 */
export function monthlyPayment(capital: number, years: number, ratePct: number): number | null {
	const n = Math.round(years * 12);
	if (!(capital > 0) || !(n > 0) || !Number.isFinite(ratePct)) return null;
	const i = Math.max(ratePct, 0) / 100 / 12;
	if (i === 0) return capital / n;
	return (capital * i) / (1 - (1 + i) ** -n);
}

/** Último dato de una serie mensual («2026-09») y el del mismo mes del año anterior, si lo hay. */
export function lastAndYearAgo(s: Series | undefined): { now: Point; before: Point | null } | null {
	const now = last(s);
	if (!now) return null;
	const m = now.t.match(/^(\d{4})-(\d{2})$/);
	const t = m ? `${Number(m[1]) - 1}-${m[2]}` : '';
	return { now, before: s?.points.find((p) => p.t === t) ?? null };
}

/** Capital que queda tras pagar `paid` cuotas con un tipo constante. */
export function balanceAfter(capital: number, years: number, ratePct: number, paid: number): number | null {
	const pay = monthlyPayment(capital, years, ratePct);
	if (pay === null) return null;
	const i = Math.max(ratePct, 0) / 100 / 12;
	let left = capital;
	for (let k = 0; k < paid && left > 0; k++) left = Math.max(left * (1 + i) - pay, 0);
	return left;
}

export interface AmortYear {
	/** 1 = los 12 primeros meses desde hoy. */
	year: number;
	paid: number;
	interest: number;
	principal: number;
	/** Lo que queda por pagar al acabar ese año. */
	balance: number;
}

/** Cuadro de amortización resumido por años, suponiendo que el tipo no cambia. */
export function amortization(capital: number, years: number, ratePct: number): AmortYear[] {
	const pay = monthlyPayment(capital, years, ratePct);
	if (pay === null) return [];
	const i = Math.max(ratePct, 0) / 100 / 12;
	const n = Math.round(years * 12);
	const rows: AmortYear[] = [];
	let left = capital;
	for (let m = 0; m < n; m++) {
		if (m % 12 === 0) rows.push({ year: m / 12 + 1, paid: 0, interest: 0, principal: 0, balance: left });
		const row = rows[rows.length - 1];
		const interest = left * i;
		// La última cuota liquida lo que quede (evita restos de céntimos por redondeo).
		const principal = m === n - 1 ? left : Math.min(pay - interest, left);
		left = Math.max(left - principal, 0);
		row.paid += interest + principal;
		row.interest += interest;
		row.principal += principal;
		row.balance = left;
	}
	return rows;
}

/**
 * Próxima revisión de una hipoteca variable que se revisa en `month` (1–12) cada `every` meses (6 o 12).
 * Si toca este mismo mes, cuenta como este mes (0 meses). Devuelve el mes («2027-03») y los meses que faltan.
 */
export function nextReview(month: number, every: 6 | 12, today: Date): { ym: string; months: number } | null {
	if (!(month >= 1 && month <= 12)) return null;
	const y = today.getUTCFullYear();
	const m = today.getUTCMonth() + 1;
	for (let ahead = 0; ahead < 12; ahead++) {
		const mm = ((m - 1 + ahead) % 12) + 1;
		if ((mm - month + 12) % every === 0) {
			const yy = y + Math.floor((m - 1 + ahead) / 12);
			return { ym: `${yy}-${String(mm).padStart(2, '0')}`, months: ahead };
		}
	}
	return null;
}
