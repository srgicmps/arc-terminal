// @ts-nocheck
/// <reference types="node" />
// TEMPORAL (rama de comparación, no se fusiona): descarga los .xlsx de SIPRI, Pink Sheet, EPU y Oil Bulletin y
// compara exceljs (como en main) con readXlsx (scripts/xlsx.ts) sobre los mismos bytes: celda a celda y la salida
// de cada parser.
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { parseOilBulletin } from '../src/lib/fuel.ts';
import { parseMilex } from '../src/lib/milex.ts';
import { parsePinkSheet, pinkLink } from '../src/lib/pinksheet.ts';
import { EPU_URL, parseGlobalEpu } from '../src/lib/uncertainty.ts';
import { getText, request } from './lib.ts';
import { historyLink } from './sources/oilbulletin.ts';
import { milexLink } from './sources/sipri.ts';
import { readXlsx } from './xlsx.ts';

const plainCell = (v) => (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? v.result : v);
const rowsOf = (sheet, plain = true) => {
	const cells = [];
	sheet?.eachRow((row) => cells.push(plain ? row.values.slice(1).map(plainCell) : row.values.slice(1)));
	return cells;
};

const FILES = {
	sipri: async () => {
		const page = 'https://www.sipri.org/databases/milex';
		const direct = milexLink(await getText(page).catch(() => ''));
		// Si la web del SIPRI está caída, sus copias del Internet Archive (cualquier Excel real del SIPRI vale).
		const files = ['SIPRI-Milex-data-1949-2025_v1.2.xlsx', 'SIPRI-Milex-data-1949-2025_v1.1.xlsx', 'SIPRI-Milex-data-1949-2025.xlsx', 'SIPRI-Milex-data-1949-2024.xlsx'];
		return [
			...(direct ? [direct] : []),
			...files.map((f) => `https://web.archive.org/web/2026id_/https://www.sipri.org/sites/default/files/${f}`),
			...files.map((f) => `https://web.archive.org/web/2025id_/https://www.sipri.org/sites/default/files/${f}`)
		];
	},
	pinksheet: async () => pinkLink(await getText('https://www.worldbank.org/en/research/commodity-markets')),
	uncertainty: async () => `${EPU_URL}media/Global_Policy_Uncertainty_Data.xlsx`,
	oilbulletin: async () =>
		historyLink(await getText('https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en').catch(() => '')) ??
		'https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx'
};

// Lo que hacía cada fuente en main (exceljs) y lo que hace en la rama (readXlsx).
const OLD = {
	sipri: (book) =>
		parseMilex(
			book.worksheets
				.filter((s) => /^(current|constant|share of gdp)/i.test(s.name))
				.map((s) => ({ name: s.name, cells: rowsOf(s) }))
		),
	pinksheet: (book) => ({ rows: parsePinkSheet(rowsOf(book.worksheets.find((s) => /monthly prices/i.test(s.name)))) }),
	uncertainty: (book) => parseGlobalEpu(rowsOf(book.worksheets[0], false)),
	oilbulletin: (book) => parseOilBulletin(book.worksheets.filter((s) => /price/i.test(s.name)).map((s) => rowsOf(s)))
};
const NEW = {
	sipri: (bytes) =>
		parseMilex(
			readXlsx(bytes, (name) => /^(current|constant|share of gdp)/i.test(name)).map(({ name, rows }) => ({ name, cells: rows }))
		),
	pinksheet: (bytes) => ({ rows: parsePinkSheet(readXlsx(bytes, (name) => /monthly prices/i.test(name))[0].rows) }),
	uncertainty: (bytes) => parseGlobalEpu(readXlsx(bytes, (_, i) => i === 0)[0]?.rows ?? []),
	oilbulletin: (bytes) => parseOilBulletin(readXlsx(bytes, (name) => /price/i.test(name)).map((s) => s.rows))
};

const sorted = (v) =>
	JSON.stringify(v, (_, x) =>
		x && typeof x === 'object' && !Array.isArray(x)
			? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
			: x
	);
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const show = (v) => (v instanceof Date ? `Date(${v.toISOString()})` : (JSON.stringify(v) ?? String(v)));
const same = (a, b) => {
	if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));
	if (a && typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
	return a === b;
};

for (const [name, link] of Object.entries(FILES)) {
	try {
		let url = '';
		let bytes = null;
		for (const candidate of [await link()].flat()) {
			try {
				const res = await request(candidate, {}, 1);
				const buf = new Uint8Array(await res.arrayBuffer());
				// Un .xlsx empieza por «PK» (es un ZIP).
				if (buf[0] === 0x50 && buf[1] === 0x4b) {
					url = candidate;
					bytes = buf;
					break;
				}
				console.log(`COMPARA ${name}: ${candidate} no es un .xlsx`);
			} catch (error) {
				console.log(`COMPARA ${name}: ${candidate} falla: ${error?.message ?? error}`);
			}
		}
		if (!bytes) throw new Error('ninguna URL dio el .xlsx');
		console.log(`\nCOMPARA ${name}: ${(bytes.length / 1e6).toFixed(2)} MB · ${url}`);
		let t = performance.now();
		const book = new ExcelJS.Workbook();
		await book.xlsx.load(bytes);
		const tOld = Math.round(performance.now() - t);
		t = performance.now();
		const mine = readXlsx(bytes);
		const tNew = Math.round(performance.now() - t);
		console.log(`COMPARA ${name}: lectura de todas las hojas · exceljs ${tOld} ms · readXlsx ${tNew} ms`);
		const names = book.worksheets.map((s) => s.name);
		console.log(`COMPARA ${name}: hojas iguales ${sorted(names) === sorted(mine.map((s) => s.name))} · ${names.join(' | ')}`);
		const kinds = new Map();
		const add = (k, msg) => kinds.set(k, [...(kinds.get(k) ?? []), msg]);
		let seen = 0;
		book.worksheets.forEach((sheet, k) => {
			const old = rowsOf(sheet);
			const neu = mine[k]?.rows ?? [];
			if (old.length !== neu.length) add('número de filas', `${sheet.name}: ${old.length} vs ${neu.length}`);
			for (let i = 0; i < Math.max(old.length, neu.length); i++) {
				const a = old[i] ?? [];
				const b = neu[i] ?? [];
				if (a.length !== b.length) add('largo de fila', `${sheet.name} [${i}]: ${a.length} vs ${b.length}`);
				for (let j = 0; j < Math.max(a.length, b.length); j++) {
					seen++;
					if (j in a !== j in b) add(`hueco (exceljs ${j in a ? 'tiene' : 'no tiene'})`, `${sheet.name} [${i}][${j}] ${show(a[j])} vs ${show(b[j])}`);
					else if (!same(a[j], b[j])) {
						const ta = a[j] instanceof Date ? 'Date' : a[j] && typeof a[j] === 'object' ? Object.keys(a[j]).join('+') : typeof a[j];
						const tb = b[j] instanceof Date ? 'Date' : typeof b[j];
						add(`valor ${ta} → ${tb}`, `${sheet.name} [${i}][${j}] ${show(a[j])} vs ${show(b[j])}`);
					}
				}
			}
		});
		console.log(`COMPARA ${name}: ${seen} celdas comparadas${kinds.size ? '' : ' · MATRICES IDÉNTICAS celda a celda'}`);
		for (const [k, list] of kinds) console.log(`COMPARA ${name}: DIFERENCIA ${k}: ${list.length}\n   ${list.slice(0, 8).join('\n   ')}`);
		const o = sorted(OLD[name](book));
		const n = sorted(NEW[name](bytes));
		console.log(`COMPARA ${name}: salida del parser · exceljs ${hash(o)} · readXlsx ${hash(n)} · ${o === n ? 'IDÉNTICA' : 'DISTINTA'} (${o.length} bytes)`);
		if (o !== n) {
			let d = 0;
			while (o[d] === n[d]) d++;
			console.log(`   exceljs  …${o.slice(Math.max(0, d - 100), d + 150)}\n   readXlsx …${n.slice(Math.max(0, d - 100), d + 150)}`);
		}
		console.log(`COMPARA ${name}: muestra ${n.slice(0, 400)}`);
	} catch (error) {
		console.log(`COMPARA ${name}: ERROR ${error?.stack ?? error}`);
	}
}
