/// <reference types="node" />
// Herramienta de desarrollo: consulta las URL de scripts/probe.txt y enseña el principio de cada
// respuesta. Solo se ejecuta en los PR, para explorar APIs nuevas antes de convertirlas en fuentes.
// Una línea «URL ~ expresión» enseña solo los elementos de la lista JSON que encajan con la expresión
// (sin distinguir mayúsculas), para buscar dentro de respuestas largas.
import { readFile } from 'node:fs/promises';

const urls = (await readFile('scripts/probe.txt', 'utf8'))
	.split('\n')
	.map((l) => l.trim())
	.filter((l) => l && !l.startsWith('#'));

for (const line of urls) {
	const [url, filter] = line.split(/\s+~\s+/);
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)', Accept: '*/*' },
			signal: AbortSignal.timeout(30_000)
		});
		const text = await res.text();
		if (filter) {
			const re = new RegExp(filter, 'i');
			const hits = (JSON.parse(text) as unknown[]).map((item) => JSON.stringify(item)).filter((s) => re.test(s));
			console.log(`\nPROBE ${res.status} ${url} ~ ${filter} (${hits.length})\n${hits.join('\n').slice(0, 8000)}`);
		} else {
			console.log(`\nPROBE ${res.status} ${url}\n${text.replace(/\s+/g, ' ').slice(0, 1200)}`);
		}
	} catch (error) {
		console.log(`\nPROBE ERROR ${url}\n${error}`);
	}
}
