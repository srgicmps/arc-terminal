// Últimos documentos que las empresas presentan en la SEC (EDGAR): resultados (8-K), informes
// trimestrales y anuales (10-Q, 10-K, 6-K, 20-F) y operaciones de directivos (Form 4).
// API pública sin clave: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
// Condiciones (https://www.sec.gov/os/accessing-edgar-data): un User-Agent con nombre y correo de
// contacto («Nombre correo@ejemplo.com») y como mucho 10 peticiones por segundo. Con solo la URL del
// repo la SEC responde 403, y como el repo es público el correo va en el secreto SEC_USER_AGENT:
// sin él, la fuente se salta.
import { TICKERS } from '../../src/lib/commands.ts';
import type { SecCompany, SecData, SecFiling } from '../../src/lib/types.ts';
import { getJson, type Source } from '../lib.ts';

const API = 'https://data.sec.gov/submissions';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
/** Pausa entre peticiones: unas 6 por segundo, bien por debajo del límite de 10. */
const PAUSE_MS = 150;
/** Documentos que se guardan por empresa. */
const MAX = 15;
/** Los Form 4 son muy frecuentes y taparían el resto: como mucho estos. */
const MAX_FORM4 = 5;

/** Qué es cada formulario. */
const FORMS: Record<string, string> = {
	'8-K': 'Hecho relevante',
	'10-Q': 'Informe trimestral',
	'10-K': 'Informe anual',
	'4': 'Compraventa de un directivo o gran accionista',
	'6-K': 'Informe de emisor extranjero',
	'20-F': 'Informe anual de emisor extranjero'
};

/** Apartados de un 8-K (https://www.sec.gov/files/form8-k.pdf). */
const ITEMS: Record<string, string> = {
	'1.01': 'Acuerdo relevante',
	'1.02': 'Fin de un acuerdo relevante',
	'1.03': 'Quiebra o suspensión de pagos',
	'1.05': 'Incidente de ciberseguridad',
	'2.01': 'Compra o venta de activos',
	'2.02': 'Resultados',
	'2.03': 'Nueva deuda u obligación financiera',
	'2.04': 'Vencimiento anticipado de deuda',
	'2.05': 'Costes de reestructuración',
	'2.06': 'Deterioro de activos',
	'3.01': 'Aviso de exclusión de cotización',
	'3.02': 'Venta de acciones no registrada',
	'3.03': 'Cambio en los derechos de los accionistas',
	'4.01': 'Cambio de auditor',
	'4.02': 'Cuentas anteriores no fiables',
	'5.01': 'Cambio de control',
	'5.02': 'Cambios en la dirección o el consejo',
	'5.03': 'Cambio de estatutos o de ejercicio fiscal',
	'5.05': 'Cambio en el código ético',
	'5.07': 'Votación de la junta de accionistas',
	'7.01': 'Información al mercado (Reg FD)',
	'8.01': 'Otros hechos',
	'9.01': 'Estados financieros y anexos'
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** «8-K/A» → «8-K»; las enmiendas cuentan como su formulario. */
const baseForm = (form: string) => form.replace(/\/A$/, '');

function describe(form: string, items: string): string {
	const amended = form.endsWith('/A') ? ' (corrección)' : '';
	if (baseForm(form) === '8-K' && items) {
		const codes = items.split(',').map((c) => c.trim());
		// El 9.01 (anexos) acompaña casi siempre a otro apartado: solo se nombra si va solo.
		const shown = codes.length > 1 ? codes.filter((c) => c !== '9.01') : codes;
		const text = shown.map((c) => ITEMS[c] ?? `Apartado ${c}`).join(' · ');
		if (text) return text + amended;
	}
	return (FORMS[baseForm(form)] ?? form) + amended;
}

/** Convierte la respuesta de /submissions/CIK##########.json en los documentos que interesan. */
export function parseSubmissions(body: any): Omit<SecCompany, 'cik'> {
	const recent = body?.filings?.recent ?? {};
	const forms: string[] = recent.form ?? [];
	const cikInt = String(Number(body?.cik ?? 0));
	const filings: SecFiling[] = [];
	let form4 = 0;

	// La SEC las da ya ordenadas de la más reciente a la más antigua.
	for (let i = 0; i < forms.length && filings.length < MAX; i++) {
		const form = String(forms[i] ?? '');
		if (!(baseForm(form) in FORMS)) continue;
		if (baseForm(form) === '4' && ++form4 > MAX_FORM4) continue;

		const accession = String(recent.accessionNumber?.[i] ?? '');
		if (!accession) continue;
		const folder = `${ARCHIVES}/${cikInt}/${accession.replaceAll('-', '')}`;
		const doc = String(recent.primaryDocument?.[i] ?? '');
		filings.push({
			form: baseForm(form) === '4' ? `Form ${form}` : form,
			date: String(recent.filingDate?.[i] ?? ''),
			desc: describe(form, String(recent.items?.[i] ?? '')),
			url: doc ? `${folder}/${doc}` : `${folder}/${accession}-index.htm`
		});
	}
	return { name: String(body?.name ?? ''), filings };
}

export const sec: Source<SecData> = {
	name: 'sec',
	label: 'SEC EDGAR · documentos de las empresas (EE. UU.)',
	maxAgeMinutes: 60,
	requires: 'SEC_USER_AGENT',
	async fetch() {
		const headers = { 'User-Agent': process.env.SEC_USER_AGENT ?? '' };
		const companies: Record<string, SecCompany> = {};
		const listed = TICKERS.filter((t) => t.cik);

		// En serie y con pausa, para respetar el límite de la SEC.
		for (const [i, t] of listed.entries()) {
			if (i > 0) await wait(PAUSE_MS);
			try {
				const body = await getJson(`${API}/CIK${t.cik}.json`, { headers });
				// Comprobación de que el CIK es el del valor (la SEC escribe «BRK-B» en vez de «BRK.B»).
				const tickers: string[] = body?.tickers ?? [];
				if (tickers.length && !tickers.includes(t.code.replace('.', '-'))) {
					console.log(`::warning::sec · ${t.code}: el CIK ${t.cik} es de ${tickers.join(', ')}`);
				}
				const parsed = parseSubmissions(body);
				if (parsed.filings.length) companies[t.code] = { cik: t.cik!, ...parsed };
			} catch (error) {
				console.log(`  sec · ${t.code}: ${error instanceof Error ? error.message : error}`);
			}
		}
		if (!Object.keys(companies).length) throw new Error('sin documentos');
		return { companies };
	}
};
