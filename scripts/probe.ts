/// <reference types="node" />
// QA (borrador, no se mezcla): lee los RSS que fallan con el lector real y enseña por qué.
import { XMLValidator } from 'fast-xml-parser';
import { getText } from './lib.ts';
import { parseFeed } from './sources/news.ts';

const URLS = [
	'https://e00-expansion.uecdn.es/rss/economia.xml',
	'https://www.eldiario.es/rss/',
	'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml',
	'https://www.europarl.europa.eu/rss/doc/top-stories/es.xml'
];
const ACCEPTS = ['application/rss+xml, application/atom+xml, application/xml, text/xml', '*/*'];

for (const url of URLS) {
	for (const accept of ACCEPTS) {
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)', Accept: accept } });
			const body = await res.text();
			let items = -1;
			let err = '';
			try {
				items = parseFeed(body, 'x').length;
			} catch (e) {
				err = String(e);
			}
			const valid = XMLValidator.validate(body);
			console.log(`\nQA ${url} [${accept}] → ${res.status} ${res.headers.get('content-type')} ${body.length} B, items=${items} ${err}`);
			console.log(`  valid: ${JSON.stringify(valid).slice(0, 300)}`);
			console.log(`  inicio: ${body.slice(0, 200).replace(/\s+/g, ' ')}`);
		} catch (e) {
			console.log(`\nQA ${url} [${accept}] ERROR ${e}`);
		}
	}
	try {
		const body = await getText(url, { headers: { Accept: ACCEPTS[0] } });
		console.log(`  getText: ${body.length} B, items=${parseFeed(body, 'x').length}`);
	} catch (e) {
		console.log(`  getText ERROR ${e}`);
	}
}
