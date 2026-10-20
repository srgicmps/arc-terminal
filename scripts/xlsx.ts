// Lector mínimo de hojas de cálculo .xlsx, para las fuentes que publican Excel (SIPRI, Pink Sheet, EPU, Oil
// Bulletin) y para scripts/probe.ts. Un .xlsx es un ZIP de archivos XML: basta con fflate (descomprimir) y
// fast-xml-parser (leer el XML), que ya son dependencias. Sustituye a exceljs, que traía 142 paquetes más al
// proceso de `pnpm data`, el que corre en la Action con los Secrets.
// Da lo mismo que daba exceljs con eachRow + row.values: una matriz por hoja, solo con las filas que tienen algo,
// y en cada fila la columna A en el índice 0 (las celdas vacías quedan como huecos).
// - Número → number; con formato de fecha u hora → Date en UTC. Texto (compartido, enriquecido o en línea) →
//   string. Verdadero o falso → boolean. Error (#N/A…) → su texto. Fórmula → el último resultado que guardó Excel.
// - Celdas combinadas: todas repiten el valor de la de arriba a la izquierda, como en exceljs.
// - Hoja mal formada o parte enorme al descomprimirla: error al momento (ni se cuelga ni agota la memoria).
// No lee el .xls antiguo (binario), ni comentarios, ni enlaces, ni colores.
import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';

export interface XlsxSheet {
	/** Nombre de la pestaña: «Monthly Prices». */
	name: string;
	/** Filas con datos, de arriba abajo; rows[i][0] es la columna A. */
	rows: unknown[][];
}

type Node = Record<string, unknown>;

interface Book {
	/** Cadenas compartidas (sharedStrings.xml): las celdas de texto guardan su posición en esta lista. */
	strings: string[];
	/** Estilos de celda (posición en cellXfs) con formato de fecha u hora. */
	dates: Set<number>;
	/** Libro con fechas desde 1904 (Excel antiguo de Mac). */
	date1904: boolean;
}

// Elementos que pueden repetirse: siempre como lista, aunque solo haya uno.
const LISTS = new Set(['sheet', 'Relationship', 'si', 'r', 'numFmt', 'xf']);

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@',
	// <x:sheet> (algunos programas ponen prefijo) es <sheet>; r:id queda como @id.
	removeNSPrefix: true,
	// Los valores, tal cual: se convierten aquí según el tipo de celda.
	parseTagValue: false,
	parseAttributeValue: false,
	// « texto » con sus espacios, como lo guarda Excel.
	trimValues: false,
	// También las entidades numéricas (&#10;).
	htmlEntities: true,
	isArray: (name, _path, _leaf, isAttribute) => !isAttribute && LISTS.has(name)
});

// Las hojas no pasan por fast-xml-parser: se recorren con expresiones regulares, sin montar el árbol. El
// histórico del Oil Bulletin tiene hojas de 9 MB y el árbol de cada una tarda unos 2,5 s (con el proceso parado);
// así, 0,2 s. El XML de una hoja es muy regular (<row><c><f/><v/></c></row>) y en el texto «<» va escapado.
const P = '(?:\\w+:)?'; // prefijo de espacio de nombres opcional: <x:c>
const SHEET_DATA = new RegExp(`<${P}sheetData\\b[^>]*>([\\s\\S]*?)</${P}sheetData>`);
const ROW = new RegExp(`<${P}row\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}row>)`, 'g');
const CELL = new RegExp(`<${P}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}c>)`, 'g');
const VALUE = new RegExp(`<${P}v\\b[^>]*?(?:/>|>([\\s\\S]*?)</${P}v>)`);
const FORMULA = new RegExp(`<${P}f\\b`);
const INLINE = new RegExp(`<${P}is\\b[\\s\\S]*?</${P}is>`);
// La referencia («A8:C9») sin comillas ni «<>»: así la búsqueda no sigue por la hoja si falta la comilla.
const MERGE = new RegExp(`<${P}mergeCell\\b[^>]*?\\sref=(["'])([^"'<>]*)\\1`, 'g');
// Las etiquetas que las expresiones de arriba buscan hasta su cierre.
const TAG = new RegExp(`<(/?)${P}(row|c|v|is)\\b[^>]*?(/?)>`, 'g');
const attr = (name: string) => new RegExp(`(?:^|\\s)${name}=(["'])(.*?)\\1`);
const [REF, STYLE, TYPE] = [attr('r'), attr('s'), attr('t')];

const ENTITIES = new Map([
	['lt', '<'],
	['gt', '>'],
	['amp', '&'],
	['quot', '"'],
	['apos', "'"]
]);
/** «a &amp; b» → «a & b», también &#10; y &#x41;. Lo que no se reconoce se queda como está. */
function decode(s: string): string {
	if (!s.includes('&')) return s;
	return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
		if (e[0] !== '#') return ENTITIES.get(e) ?? m;
		const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
		return code <= 0x10ffff ? String.fromCodePoint(code) : m;
	});
}

// Celda sin valor (no es lo mismo que undefined: el de una fórmula sin resultado guardado, que sí cuenta).
const NONE = Symbol('vacía');

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const node = (v: unknown): Node => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Node) : {});

/** El texto de un elemento: «abc», o su #text si lleva atributos (<t xml:space="preserve">). */
function text(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value !== 'object') return String(value);
	return Array.isArray(value) ? value.map(text).join('') : text((value as Node)['#text']);
}

/** Una cadena (<si> o <is>): su <t>, o los trozos <r><t> seguidos si es texto enriquecido. Sin la fonética (<rPh>). */
function richText(s: Node): string {
	const raw =
		s.t !== undefined
			? text(s.t)
			: list(s.r)
					.map((r) => text(node(r).t))
					.join('');
	// Excel guarda algunos caracteres de control como _x000D_.
	return raw.replace(/_x([0-9A-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** «B7» → { row: 7, col: 1 }: las columnas, desde 0 (A = 0). */
function position(ref: string): { row: number; col: number } {
	const m = /^\$?([A-Z]+)\$?(\d*)$/i.exec(ref.trim());
	let col = 0;
	for (const ch of (m?.[1] ?? 'A').toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
	return { row: Number(m?.[2] || 0), col: col - 1 };
}

/**
 * ¿Formato de fecha u hora? Lleva d, m, y, h, s o b (año budista) fuera del texto literal: lo que va entre
 * comillas, entre corchetes ([Red], [$€-1]), escapado (\m) o tras _ y * (relleno).
 */
export function isDateFormat(code: string): boolean {
	return /[dmyhsb]/i.test(code.replace(/"[^"]*"|\[[^\]]*]|\\.|[_*]./g, ''));
}

/** Número de serie de Excel → Date en UTC. 25569 es el 1-1-1970; los libros «1904» empiezan 1462 días después. */
function excelDate(serial: number, date1904: boolean): Date {
	return new Date(Math.round((serial - 25569 + (date1904 ? 1462 : 0)) * 864e5));
}

/** Los estilos de celda con formato de fecha: los de Excel (14–22 y 45–47) o uno propio del libro con fecha. */
function dateStyles(styles: Node): Set<number> {
	const own = new Map(
		list(node(styles.numFmts).numFmt)
			.map(node)
			.map((f) => [Number(f['@numFmtId']), String(f['@formatCode'] ?? '')] as const)
	);
	const out = new Set<number>();
	list(node(styles.cellXfs).xf)
		.map(node)
		.forEach((xf, i) => {
			const id = Number(xf['@numFmtId'] ?? 0);
			const code = own.get(id);
			if (code ? isDateFormat(code) : (id >= 14 && id <= 22) || (id >= 45 && id <= 47)) out.add(i);
		});
	return out;
}

/** El valor de una celda <c> (sus atributos y lo de dentro), según su tipo: t="s", "str", "inlineStr", "b", "e", "d" o número. */
function cellValue(attrs: string, body: string, book: Book): unknown {
	const type = TYPE.exec(attrs)?.[2] ?? 'n';
	if (type === 'inlineStr') {
		// Texto escrito en la propia celda: raro, así que sí pasa por fast-xml-parser.
		const is = INLINE.exec(body)?.[0];
		const s = is ? richText(node(node(parser.parse(is)).is)) : '';
		return s === '' ? NONE : s;
	}
	const raw = decode(VALUE.exec(body)?.[1] ?? '');
	// Una fórmula sin resultado guardado cuenta como celda, sin valor; cualquier otra celda vacía, no.
	if (raw === '') return FORMULA.test(body) ? undefined : NONE;
	switch (type) {
		case 's':
			return book.strings[Number(raw)] ?? NONE;
		case 'str':
		case 'e':
			return raw;
		case 'b':
			return parseInt(raw, 10) !== 0;
		case 'd':
			// Fecha en ISO (pocos programas la escriben así): sin zona, en UTC, como los números de serie.
			return new Date(/T[^Z+-]*$/i.test(raw) ? `${raw}Z` : raw);
		default: {
			const n = parseFloat(raw);
			// El estilo 0 es el normal: nunca es fecha (exceljs tampoco lo mira).
			const style = Number(STYLE.exec(attrs)?.[2] ?? 0);
			return style && book.dates.has(style) ? excelDate(n, book.date1904) : n;
		}
	}
}

/**
 * Comprueba, en una sola pasada, que cada <row>, <c>, <v> e <is> se cierra antes de que se abra otro igual. Sin
 * esto, una hoja rota (un <row> sin </row>) haría que las expresiones de arriba recorrieran el resto de la hoja una
 * vez por fila: minutos con una hoja grande. readXlsx es síncrono, así que se pararía toda la pasada de
 * `pnpm data` (el tope de tiempo de cada fuente no puede cortarlo). Así, error al momento, como con exceljs.
 */
function checkTags(data: string): void {
	const open = new Set<string>();
	for (const [, close, name, empty] of data.matchAll(TAG)) {
		if (close ? !open.delete(name) : open.has(name)) throw new Error(`hoja mal formada: <${close}${name}> sin pareja`);
		if (!close && !empty) open.add(name);
	}
	if (open.size) throw new Error(`hoja mal formada: <${[...open][0]}> sin cerrar`);
}

/** Las filas con datos de una hoja (el XML de <worksheet>), por número de fila. */
function readSheet(xml: string, book: Book): unknown[][] {
	const rows = new Map<number, unknown[]>();
	const rowAt = (n: number): unknown[] => {
		let row = rows.get(n);
		if (!row) rows.set(n, (row = []));
		return row;
	};
	const data = SHEET_DATA.exec(xml)?.[1] ?? '';
	checkTags(data);
	let r = 0;
	for (const [, rowAttrs, cells = ''] of data.matchAll(ROW)) {
		r = Number(REF.exec(rowAttrs)?.[2]) || r + 1;
		let col = -1;
		for (const [, attrs, body = ''] of cells.matchAll(CELL)) {
			// Sin r="B7", la celda va justo después de la anterior.
			const ref = REF.exec(attrs)?.[2];
			col = ref ? position(ref).col : col + 1;
			const value = cellValue(attrs, body, book);
			if (value !== NONE) rowAt(r)[col] = value;
		}
	}
	// Celdas combinadas: todas toman el valor de la primera (arriba a la izquierda), o null si no tiene.
	for (const [, , ref] of xml.matchAll(MERGE)) {
		const [from, to = from] = ref.split(':').map(position);
		const first = rows.get(from.row);
		const value = first && from.col in first ? first[from.col] : null;
		for (let i = from.row; i <= to.row; i++) {
			for (let j = from.col; j <= to.col; j++) if (i > from.row || j > from.col) rowAt(i)[j] = value;
		}
	}
	return [...rows].sort((a, b) => a[0] - b[0]).map(([, cells]) => cells);
}

// Topes de lo descomprimido, por parte y por libro. Hoy la mayor es una hoja del Oil Bulletin, de 9 MB (el libro
// entero, 25 MB). Un .xlsx roto o malicioso (una «bomba ZIP» de varios GB) no tumba así por falta de memoria la
// pasada de `pnpm data`, con todas sus fuentes: fflate reserva de golpe el tamaño que declara cada parte.
const MAX_PART = 64e6;
const MAX_BOOK = 256e6;

/**
 * Lee un .xlsx: sus hojas en el orden de las pestañas (sin las de solo gráfico). Con `pick`, solo las hojas que
 * elige por nombre o posición; las demás ni se leen (el histórico del Oil Bulletin trae hojas de varios MB).
 */
export function readXlsx(
	bytes: ArrayBuffer | Uint8Array,
	pick?: (name: string, index: number) => boolean
): XlsxSheet[] {
	// Solo los XML del libro: fuera imágenes, dibujos y ajustes de impresora. Y con tope (ver MAX_PART): lo que pasa
	// de él no se descomprime, y da error solo si hace falta leerlo.
	const big = new Map<string, number>();
	let total = 0;
	const zip = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
		filter: (f) => {
			if (!/^xl\/.+\.(xml|rels)$/.test(f.name)) return false;
			if (f.originalSize > MAX_PART || total + f.originalSize > MAX_BOOK) {
				big.set(f.name, f.originalSize);
				return false;
			}
			total += f.originalSize;
			return true;
		}
	});
	const source = (path: string) => {
		const size = big.get(path);
		if (size !== undefined) {
			throw new Error(
				`${path} ocupa ${Math.round(size / 1e6)} MB descomprimido: pasa del tope (${MAX_PART / 1e6} MB por parte, ${MAX_BOOK / 1e6} MB por libro)`
			);
		}
		return zip[path] ? new TextDecoder().decode(zip[path]) : '';
	};
	const xml = (path: string): Node => node(parser.parse(source(path)));
	const workbook = node(xml('xl/workbook.xml').workbook);
	const rels = list(node(xml('xl/_rels/workbook.xml.rels').Relationships).Relationship).map(node);
	// Dónde está cada parte en el ZIP: «worksheets/sheet1.xml» o «/xl/worksheets/sheet1.xml» → «xl/worksheets/sheet1.xml».
	const target = (rel: Node) => {
		const t = String(rel['@Target'] ?? '');
		return t.startsWith('/') ? t.slice(1) : `xl/${t}`;
	};
	const part = (type: string, fallback: string) => {
		const rel = rels.find((r) => String(r['@Type']).endsWith(`/${type}`));
		return rel ? target(rel) : fallback;
	};
	const date1904 = String(node(workbook.workbookPr)['@date1904'] ?? '');
	const book: Book = {
		strings: list(node(xml(part('sharedStrings', 'xl/sharedStrings.xml')).sst).si).map((si) => richText(node(si))),
		dates: dateStyles(node(xml(part('styles', 'xl/styles.xml')).styleSheet)),
		date1904: date1904 === '1' || date1904 === 'true'
	};
	const sheets = list(node(workbook.sheets).sheet)
		.map(node)
		.flatMap((s) => {
			const rel = rels.find((r) => r['@Id'] === s['@id']);
			if (!rel || !String(rel['@Type']).endsWith('/worksheet')) return [];
			if (!zip[target(rel)] && !big.has(target(rel))) return [];
			return [{ name: String(s['@name'] ?? ''), path: target(rel) }];
		});
	return sheets
		.filter((s, i) => !pick || pick(s.name, i))
		.map((s) => ({ name: s.name, rows: readSheet(source(s.path), book) }));
}
