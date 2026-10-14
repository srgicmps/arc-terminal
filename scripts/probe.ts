/// <reference types="node" />
// Herramienta de desarrollo: consulta las URL de scripts/probe.txt y enseña el principio de cada
// respuesta. Solo se ejecuta en los PR, para explorar APIs nuevas antes de convertirlas en fuentes.
// Formato de cada línea: «URL» o «URL ~ patrón» (si la respuesta es una lista JSON, solo enseña los
// elementos que contienen el patrón; si es un feed Atom, solo las <entry> que lo contienen; si es una
// página web, solo los trozos de texto que encajan).
import { readFile } from 'node:fs/promises';

const lines = (await readFile('scripts/probe.txt', 'utf8'))
	.split('\n')
	.map((l) => l.trim())
	.filter((l) => l && !l.startsWith('#'));

for (const line of lines) {
	const [url, pattern] = line.split(/\s+~\s+/);
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)', Accept: '*/*' },
			signal: AbortSignal.timeout(30_000)
		});
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
					body = [...text.matchAll(new RegExp(pattern, 'gi'))].map((m) => m[0]).join('\n');
				}
			}
		}
		console.log(`\nPROBE ${res.status} ${line}\n${body.slice(0, 3000)}`);
	} catch (error) {
		console.log(`\nPROBE ERROR ${line}\n${error}`);
	}
}
