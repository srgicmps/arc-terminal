/// <reference types="node" />
// QA (borrador, no se mezcla): ¿qué hay publicado de Finnhub y qué dice CAL?
const BASE = 'https://srgicmps.github.io/arc-terminal';
const get = async (path: string) => {
	const res = await fetch(BASE + path, { headers: { 'Cache-Control': 'no-cache' } });
	const body = await res.text();
	return { status: res.status, body, age: res.headers.get('age'), lm: res.headers.get('last-modified') };
};
const f = await get('/data/finnhub.json');
console.log(`QA finnhub.json → ${f.status} last-modified ${f.lm}, ${f.body.length} B: ${f.body.slice(0, 300)}`);
try {
	const d = JSON.parse(f.body);
	console.log(`QA finnhub fetchedAt ${d.fetchedAt}, earnings ${d.data?.earnings?.length}, news ${d.data?.news?.length}, quotes ${d.data?.quotes?.length}`);
} catch (e) {
	console.log(`QA finnhub.json no es JSON: ${e}`);
}
const s = await get('/data/status.json');
try {
	const st = JSON.parse(s.body);
	console.log(`QA status fetchedAt ${st.fetchedAt}: ${JSON.stringify(st.data.find((x: { name: string }) => x.name === 'finnhub'))}`);
} catch (e) {
	console.log(`QA status.json: ${s.status} ${e}`);
}
const h = await get('/data/status-history.json');
try {
	const sh = JSON.parse(h.body);
	console.log(`QA historial finnhub: ${JSON.stringify(sh.data.find((x: { name: string }) => x.name === 'finnhub'))}`);
} catch (e) {
	console.log(`QA status-history.json: ${h.status} ${e}`);
}
for (const path of ['/cal', '/cal.html', '/s?sym=NVDA']) {
	const c = await get(path);
	const text = c.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
	const hit = text.match(/.{0,80}(Falta la clave|Resultados|No hay resultados).{0,120}/g) ?? [];
	console.log(`QA ${path} → ${c.status}, last-modified ${c.lm}: ${hit.slice(0, 3).join(' | ')}`);
}
