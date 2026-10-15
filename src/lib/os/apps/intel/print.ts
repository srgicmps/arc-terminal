// El Expediente como página para imprimir (o guardar en PDF desde el diálogo del navegador). Colores del sistema
// (Canvas, CanvasText, GrayText): en papel, negro sobre blanco con cualquier tema. Letra y tamaños, los de los
// tokens, que llegan ya leídos.
import { refKind, type Dossier } from './dossier.ts';
import { kindLabel } from './model.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface PrintFonts {
	sans: string;
	mono: string;
	/** Tamaños (con su unidad) de los tokens --fs-s, --fs-m y --fs-xl. */
	s: string;
	m: string;
	xl: string;
}

export function printHtml(d: Dossier, generated: string, f: PrintFonts): string {
	const rows = (list: string[][]) => list.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
	return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Expediente · ${esc(d.label)}</title>
<style>
body{margin:2em;font-family:${f.sans};font-size:${f.m};color:CanvasText;background:Canvas}
h1{font-size:${f.xl};margin:0 0 .2em}h2{font-family:${f.mono};font-size:${f.s};letter-spacing:.12em;text-transform:uppercase;margin:1.6em 0 .5em}
.k{font-family:${f.mono};font-size:${f.s};color:GrayText}table{border-collapse:collapse;width:100%}
td{border-bottom:1px solid GrayText;padding:.3em .5em .3em 0;vertical-align:top}td:first-child{white-space:nowrap}
.foot{margin-top:2em;font-size:${f.s};color:GrayText}a{color:inherit}
</style></head><body>
<p class="k">${esc(d.kindLabel)} · ${esc(d.sub)}</p><h1>${esc(d.label)}</h1><p>${esc(d.summary)}</p>
${d.at ? `<p class="k">Ubicación: ${d.at[0].toFixed(2)}, ${d.at[1].toFixed(2)}</p>` : ''}
${d.facts.length ? `<h2>Datos clave</h2><table>${rows(d.facts.map((x) => [esc(x.label), esc(x.value), esc(x.note ?? '')]))}</table>` : ''}
${d.timeline.length ? `<h2>Cronología</h2><table>${rows(d.timeline.map((r) => [esc(r.time?.slice(0, 10) ?? ''), esc(refKind(r.kind)), `<a href="${esc(r.url)}">${esc(r.title)}</a>`, esc(r.source)]))}</table>` : ''}
${d.related.length ? `<h2>Relaciones</h2><table>${rows(d.related.map((r) => [esc(r.label), esc(kindLabel(r.kind)), String(r.w), esc(r.why)]))}</table>` : ''}
<p class="foot">Expediente de Arc Terminal · ${esc(generated)}</p>
</body></html>`;
}
