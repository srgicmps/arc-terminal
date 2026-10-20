/// <reference types="node" />
// Herramienta de desarrollo: consulta las URL de scripts/probe.txt y enseña el principio de cada
// respuesta. Solo se ejecuta en los PR, para explorar APIs nuevas antes de convertirlas en fuentes.
// Formato de cada línea: «URL» o «URL ~ patrón» (si la respuesta es una lista JSON, solo enseña los
// elementos que contienen el patrón; si es un feed Atom, solo las <entry> que lo contienen; si es una
// página web, solo los trozos de texto que encajan o, si no hay ninguno, los del HTML sin quitar etiquetas).
// Si es un .xlsx, enseña las primeras filas de cada hoja (con patrón, solo las filas que lo contienen).
import { readFile } from 'node:fs/promises';
import { readXlsx } from './xlsx.ts';

/** Una celda como texto: las fechas, «2026-10-12». */
const cellText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

/**
 * Las primeras filas de cada hoja de un .xlsx, como texto: «[Hoja] 40 filas con datos» y «rows[3]: a | b | c».
 * El número es la posición en las filas que da readXlsx (scripts/xlsx.ts), la que verá el parser.
 */
function sheets(data: ArrayBuffer, pattern?: string): string {
	const re = pattern ? new RegExp(pattern, 'i') : null;
	const out: string[] = [];
	for (const sheet of readXlsx(data)) {
		out.push(`[${sheet.name}] ${sheet.rows.length} filas con datos`);
		let shown = 0;
		sheet.rows.forEach((row, n) => {
			const text = Array.from(row, cellText).join(' | ');
			if (shown < 15 && (!re || re.test(text))) {
				out.push(`rows[${n}]: ${text.slice(0, 600)}`);
				shown++;
			}
		});
	}
	return out.join('\n');
}

/**
 * La SEC responde 403 sin un User-Agent con nombre y correo: a sec.gov se le manda el del secreto
 * SEC_USER_AGENT (la Action lo pasa a este paso), y a las demás webs, el genérico.
 */
function userAgent(url: string): string {
	const secret = process.env.SEC_USER_AGENT;
	const host = new URL(url).hostname;
	if (secret && (host === 'sec.gov' || host.endsWith('.sec.gov'))) return secret;
	return 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)';
}

const lines = (await readFile('scripts/probe.txt', 'utf8'))
	.split('\n')
	.map((l) => l.trim())
	.filter((l) => l && !l.startsWith('#'));

for (const line of lines) {
	const [url, pattern] = line.split(/\s+~\s+/);
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': userAgent(url), Accept: '*/*' },
			signal: AbortSignal.timeout(30_000)
		});
		if (/\.xlsx($|\?|&)/i.test(url) || (res.headers.get('content-type') ?? '').includes('spreadsheet')) {
			console.log(`\nPROBE ${res.status} ${line}\n${sheets(await res.arrayBuffer(), pattern).slice(0, 20000)}`);
			continue;
		}
		let body = (await res.text()).replace(/\s+/g, ' ');
		if (pattern) {
			const re = new RegExp(pattern, 'i');
			try {
				const items = JSON.parse(body) as unknown[];
				body = JSON.stringify(items.filter((i) => re.test(JSON.stringify(i))));
			} catch {
				// No es JSON: si es un feed Atom, solo las entradas que contienen el patrón.
				const entries = body.match(/<entry[\s>].*?<\/entry>/g);
				if (entries) {
					const hits = entries.filter((e) => re.test(e));
					body = `${entries.length} entradas, ${hits.length} con «${pattern}»: ${hits.join(' ')}`;
				} else {
					// Una página web: quita las etiquetas y enseña solo los trozos que encajan.
					const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
					// Si en el texto no sale nada, se busca en el HTML tal cual (enlaces, atributos…).
					const find = (s: string) => [...s.matchAll(new RegExp(pattern, 'gi'))].map((m) => m[0]);
					const hits = find(text);
					body = (hits.length ? hits : find(body)).join('\n');
				}
			}
		}
		console.log(`\nPROBE ${res.status} ${line}\n${body.slice(0, 3000)}`);
	} catch (error) {
		console.log(`\nPROBE ERROR ${line}\n${error}`);
	}
}
