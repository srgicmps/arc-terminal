import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { isDateFormat, readXlsx } from '../xlsx.ts';

// Un .xlsx de verdad es un ZIP de XML: se monta aquí mismo, sin archivos binarios en el repo.
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS = `xmlns="${MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xlsx = (files: Record<string, string>) =>
	zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(xml)])));

const rels = (list: [string, string, string][]) =>
	`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list
		.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`)
		.join('')}</Relationships>`;

// Estilos: 0 normal, 1 fecha de Excel (14), 2 fecha propia, 3 número con texto « m», 4 número en rojo.
// cellStyleXfs lleva una fecha a propósito: no cuenta, solo cuentan los cellXfs.
const STYLES = `<styleSheet ${NS}>
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.0&quot; m&quot;"/><numFmt numFmtId="166" formatCode="[Red]#,##0.00"/></numFmts>
<cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs>
</styleSheet>`;

const BOOK = xlsx({
	'xl/workbook.xml': `<workbook ${NS}><workbookPr/><sheets>
<sheet name="Precios" sheetId="1" r:id="rId2"/>
<sheet name="Gráfico" sheetId="3" r:id="rId9"/>
<sheet name="Notas &amp; fuentes" sheetId="2" r:id="rId1"/>
</sheets></workbook>`,
	'xl/_rels/workbook.xml.rels': rels([
		['rId1', 'worksheet', 'worksheets/sheet1.xml'],
		['rId2', 'worksheet', '/xl/worksheets/sheet2.xml'],
		['rId9', 'chartsheet', 'chartsheets/sheet1.xml'],
		['rId3', 'sharedStrings', 'sharedStrings.xml'],
		['rId4', 'styles', 'styles.xml']
	]),
	'xl/sharedStrings.xml': `<sst ${NS} count="5" uniqueCount="5">
<si><t>Fecha</t></si>
<si><t xml:space="preserve"> Brent &amp; WTI </t></si>
<si><r><rPr><b/></rPr><t>Gas</t></r><r><t xml:space="preserve"> natural</t></r><rPh sb="0" eb="1"><t>NO</t></rPh></si>
<si><t>línea_x000D_</t></si>
<si><t/></si>
</sst>`,
	'xl/styles.xml': STYLES,
	// La hoja de las pestañas va en sheet2.xml: manda el orden del libro, no el de los archivos.
	'xl/worksheets/sheet2.xml': `<worksheet ${NS}><dimension ref="A1:E9"/><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" s="1"><v>45658</v></c><c r="B2"><v>74.5</v></c><c r="D2" s="3"><v>2.5</v></c></row>
<row r="3" spans="1:5"><c r="A3" s="1"/><c r="B3" s="4"/></row>
<row r="5"><c r="A5" s="2"><v>45689.5</v></c><c r="B5"><f>B2*2</f><v>149</v></c><c r="C5" t="str"><f>"x"&amp;"y"</f><v>x&amp;y&#x21;</v></c><c r="D5"><f t="shared" ref="D5:D6" si="0">B2-B2</f><v>0</v></c><c r="E5"><f>NOW()</f></c></row>
<row r="6"><c r="A6" t="b"><v>1</v></c><c r="B6" t="e"><v>#N/A</v></c><c r="C6" t="inlineStr"><is><t>en línea</t></is></c><c r="D6" t="s"><v>3</v></c><c r="E6" t="s"><v>4</v></c></row>
<row r="7"><c r="A7" s="4"><v>45658</v></c><c><v>8</v></c><c><v>9</v></c></row>
<row r="8"><c r="A8" t="s"><v>0</v></c><c r="D8" s="1"/></row>
</sheetData><mergeCells count="2"><mergeCell ref="A8:C9"/><mergeCell ref="D8:E8"/></mergeCells></worksheet>`,
	// Con prefijo de espacio de nombres (<x:c>), como lo escriben algunos programas.
	'xl/worksheets/sheet1.xml': `<x:worksheet xmlns:x="${MAIN}"><x:sheetData>
<x:row r="2"><x:c r="B2" t="s"><x:v>0</x:v></x:c></x:row>
</x:sheetData></x:worksheet>`,
	'xl/chartsheets/sheet1.xml': `<chartsheet ${NS}/>`
});

describe('readXlsx', () => {
	const [precios, notas] = readXlsx(BOOK);
	const rows = precios.rows;

	it('da las hojas en el orden de las pestañas, sin las de solo gráfico', () => {
		expect(readXlsx(BOOK).map((s) => s.name)).toEqual(['Precios', 'Notas & fuentes']);
		expect(notas.rows).toEqual([[undefined, 'Fecha']]);
		expect(0 in notas.rows[0]).toBe(false);
	});

	it('se salta las filas sin datos y deja huecos en las columnas vacías', () => {
		expect(rows).toHaveLength(7);
		expect(rows[1]).toHaveLength(4);
		expect(2 in rows[1]).toBe(false);
	});

	it('texto: compartido, enriquecido (sin la fonética), en línea, con sus espacios y escapes', () => {
		expect(rows[0]).toEqual(['Fecha', ' Brent & WTI ', 'Gas natural']);
		expect(rows[3].slice(2)).toEqual(['en línea', 'línea\r', '']);
	});

	it('números y fechas según el formato de la celda', () => {
		expect(rows[1][0]).toEqual(new Date('2025-01-01T00:00:00Z'));
		expect(rows[1][1]).toBe(74.5);
		// «0.0" m"»: la m va entre comillas, así que no es una fecha.
		expect(rows[1][3]).toBe(2.5);
		expect(rows[2][0]).toEqual(new Date('2025-02-01T12:00:00Z'));
		// [Red]#,##0.00 no es fecha, aunque «Red» lleve una d.
		expect(rows[4]).toEqual([45658, 8, 9]);
	});

	it('fórmulas: el resultado guardado, también 0; sin resultado, la celda cuenta pero sin valor', () => {
		expect(rows[2].slice(1)).toEqual([149, 'x&y!', 0, undefined]);
		expect(4 in rows[2]).toBe(true);
	});

	it('verdadero o falso y errores', () => {
		expect(rows[3].slice(0, 2)).toEqual([true, '#N/A']);
	});

	it('celdas combinadas: repiten el valor de la primera (null si está vacía), también en filas que no existían', () => {
		expect(rows[5]).toEqual(['Fecha', 'Fecha', 'Fecha', undefined, null]);
		expect(3 in rows[5]).toBe(false);
		expect(rows[6]).toEqual(['Fecha', 'Fecha', 'Fecha']);
	});

	it('con pick, solo las hojas elegidas, por nombre o por posición', () => {
		expect(readXlsx(BOOK, (name) => /notas/i.test(name)).map((s) => s.name)).toEqual(['Notas & fuentes']);
		expect(readXlsx(BOOK.slice().buffer, (_, i) => i === 0).map((s) => s.name)).toEqual(['Precios']);
	});

	it('libros con fechas desde 1904', () => {
		const book = xlsx({
			'xl/workbook.xml': `<workbook ${NS}><workbookPr date1904="1"/><sheets><sheet name="H" sheetId="1" r:id="rId1"/></sheets></workbook>`,
			'xl/_rels/workbook.xml.rels': rels([['rId1', 'worksheet', 'worksheets/sheet1.xml']]),
			'xl/styles.xml': STYLES,
			'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="A1" s="1"><v>44196</v></c></row></sheetData></worksheet>`
		});
		expect(readXlsx(book)[0].rows).toEqual([[new Date('2025-01-01T00:00:00Z')]]);
	});
});

describe('isDateFormat', () => {
	it('fechas y horas, fuera del texto literal', () => {
		for (const f of ['dd/mm/yy;@', 'yyyy-mm-dd', 'DD/MM/YYYY', 'h:mm AM/PM', '[$-409]mmm-yy', '[h]:mm:ss']) {
			expect(isDateFormat(f), f).toBe(true);
		}
		for (const f of [
			'General',
			'0.0',
			'#,##0.00',
			'0.0" m"',
			'[Red]#,##0',
			'#,##0\\ \\M',
			'_-* #,##0_-;\\-* #,##0_-;_-* "-"??_-;_-@_-'
		]) {
			expect(isDateFormat(f), f).toBe(false);
		}
	});
});
