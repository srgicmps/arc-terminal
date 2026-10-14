/// <reference types="node" />
// Herramienta de desarrollo: consulta las URL de scripts/probe.txt y enseña el principio de cada
// respuesta. Solo se ejecuta en los PR, para explorar APIs nuevas antes de convertirlas en fuentes.
import { readFile } from 'node:fs/promises';

const urls = (await readFile('scripts/probe.txt', 'utf8'))
	.split('\n')
	.map((l) => l.trim())
	.filter((l) => l && !l.startsWith('#'));

for (const url of urls) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)', Accept: '*/*' },
			signal: AbortSignal.timeout(30_000)
		});
		const body = (await res.text()).replace(/\s+/g, ' ');
		console.log(`\nPROBE ${res.status} ${url}\n${body.slice(0, 1200)}`);
	} catch (error) {
		console.log(`\nPROBE ERROR ${url}\n${error}`);
	}
}
