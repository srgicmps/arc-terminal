/// <reference types="node" />
// Herramienta de desarrollo: consulta las URL de scripts/probe.txt y enseña el principio de cada
// respuesta. Solo se ejecuta en los PR, para explorar APIs nuevas antes de convertirlas en fuentes.
// Formato de cada línea: «URL» o «URL ~ patrón» (si la respuesta es una lista JSON, solo enseña los
// elementos que contienen el patrón).
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
			try {
				const re = new RegExp(pattern, 'i');
				const items = JSON.parse(body) as unknown[];
				body = JSON.stringify(items.filter((i) => re.test(JSON.stringify(i))));
			} catch {}
		}
		console.log(`\nPROBE ${res.status} ${line}\n${body.slice(0, 3000)}`);
	} catch (error) {
		console.log(`\nPROBE ERROR ${line}\n${error}`);
	}
}
