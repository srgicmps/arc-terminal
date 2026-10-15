// Umbrales visuales: estado guardado en este navegador (arc-thresholds), como un store de Pinia.
import { cleanRules, hits, type Rule, type Rules } from './thresholds.ts';

const KEY = 'arc-thresholds';

export const thresholds = $state({ rules: {} as Rules, ready: false });

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(thresholds.rules));
	} catch {}
}

/** Se llama al arrancar en el navegador (desde el layout). */
export function initThresholds() {
	if (thresholds.ready) return;
	try {
		thresholds.rules = cleanRules(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
	} catch {}
	thresholds.ready = true;
}

export function setRule(id: string, rule: Omit<Rule, 'last'>, last?: number) {
	thresholds.rules = { ...thresholds.rules, [id]: { ...rule, ...(last !== undefined ? { last } : {}) } };
	save();
}

export function removeRule(id: string) {
	const { [id]: _, ...rest } = thresholds.rules;
	thresholds.rules = rest;
	save();
}

/** La tabla avisa del último dato de una serie con regla; solo se guarda si cambia. */
export function seen(id: string, value: number) {
	const rule = thresholds.rules[id];
	if (!rule || rule.last === value) return;
	thresholds.rules = { ...thresholds.rules, [id]: { ...rule, last: value } };
	save();
}

/** Reglas cruzadas, para el contador de la barra. */
export const crossedNow = () => hits(thresholds.rules);
