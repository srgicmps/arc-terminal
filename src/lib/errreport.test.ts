import { describe as group, expect, it } from 'vitest';
import {
	canReport,
	clean,
	describe,
	REPORT_LIMITS,
	reporter,
	scrub,
	shape,
	signature,
	skip,
	type ErrorReport
} from './errreport.ts';

const ORIGIN = 'https://arcterminal.dev';
/** Una pila de Chrome de la web publicada, con el hash de la build en los archivos. */
const chrome = (hash: string, fn = 'Xe') =>
	[
		"TypeError: Cannot read properties of undefined (reading 'price')",
		`    at ${fn} (${ORIGIN}/_app/immutable/nodes/12.${hash}.js:3:1520)`,
		`    at Ce (${ORIGIN}/_app/immutable/chunks/${hash.slice(0, 4)}xYz9.js:1:200)`
	].join('\n');

group('scrub', () => {
	it('quita la consulta y el # de las URL, pero deja línea y columna', () => {
		expect(scrub(`at f (${ORIGIN}/s?q=NVDA&lat=39.9#panel:3:15)`)).toBe(`at f (${ORIGIN}/s:3:15)`);
		expect(scrub(`fetch ${ORIGIN}/data/fuel.json?t=1 falló`)).toBe(`fetch ${ORIGIN}/data/fuel.json falló`);
	});

	it('quita la consulta de una ruta suelta y tapa los emails, pero no los marcos de Firefox y Safari', () => {
		expect(scrub('No se pudo abrir /viaje?ciudad=Maó')).toBe('No se pudo abrir /viaje');
		// Entre comillas o tras «=» y «:» (History, new URL…), también.
		expect(scrub("No se pudo abrir '/viaje?ciudad=Maó'")).toBe("No se pudo abrir '/viaje'");
		expect(scrub('Unexpected "/s?sym=NVDA#x" here')).toBe('Unexpected "/s" here');
		expect(scrub('url=/viaje?ciudad=Maó ruta:/s?q=NVDA')).toBe('url=/viaje ruta:/s');
		expect(scrub('Sin acceso: ana.perez@correo.es')).toBe('Sin acceso: [email]');
		const frame = `render@${ORIGIN}/_app/immutable/nodes/3.Abc.js:1:2`;
		expect(scrub(frame)).toBe(frame);
	});
});

group('clean', () => {
	it('recorta mensaje y pila, quita la cabecera repetida de Chrome y la consulta de la ruta', () => {
		const e = describe(Object.assign(new TypeError('x'.repeat(500)), { stack: '' }));
		const r = clean({ msg: e.msg, stack: chrome('DwOWLKJQ'), path: '/s?q=NVDA#x', ver: '1760968000000' });
		expect(r.msg.length).toBe(REPORT_LIMITS.message);
		expect(r.path).toBe('/s');
		const lines = clean({
			msg: "TypeError: Cannot read properties of undefined (reading 'price')",
			stack: chrome('DwOWLKJQ')
		}).stack.split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatch(/^at Xe \(/);
		const long = Array.from(
			{ length: 30 },
			(_, i) => `at f${i} (${ORIGIN}/_app/immutable/chunks/${'a'.repeat(200)}.js:1:1)`
		).join('\n');
		const s = clean({ msg: 'Error: x', stack: long }).stack;
		expect(s.split('\n').length).toBeLessThanOrEqual(REPORT_LIMITS.stackLines);
		expect(s.length).toBeLessThanOrEqual(REPORT_LIMITS.stack);
	});

	it('lo que no tiene la forma esperada se queda en nada, y limpiar dos veces da lo mismo', () => {
		const r = clean({
			msg: 42,
			stack: {},
			path: 'javascript:alert(1)',
			ver: 'a b',
			style: '<b>',
			modo: 'x'.repeat(40),
			embed: 'sí'
		});
		expect(r).toEqual({ msg: 'Error', stack: '', path: '/', ver: '', style: '', modo: '', embed: false });
		const once = clean({
			msg: 'TypeError: x',
			stack: `TypeError: x\n    at f (${ORIGIN}/a.js?v=2:1:2)`,
			path: '/geo',
			style: 'grafito',
			modo: 'sencillo',
			embed: true
		});
		expect(clean({ ...once })).toEqual(once);
	});
});

group('describe', () => {
	it('un Error, un texto, un objeto suelto y nada', () => {
		expect(describe(new RangeError('fuera'))).toMatchObject({ msg: 'RangeError: fuera', name: 'RangeError' });
		expect(describe('falló')).toEqual({ msg: 'falló', stack: '', name: '' });
		// Un objeto cualquiera no se pasa a texto: podría llevar datos de la persona.
		expect(describe({ email: 'ana@x.es' }).msg).toBe('[object Object]');
		expect(describe(null, 'Script error.').msg).toBe('Script error.');
		expect(describe(undefined).msg).toBe('Error');
	});
});

group('skip', () => {
	it('descarta «Script error.» sin pila, ResizeObserver, AbortError y extensiones', () => {
		expect(skip('Script error.', '')).toBe(true);
		expect(skip('Uncaught Script error.', '')).toBe(true);
		expect(skip('ResizeObserver loop completed with undelivered notifications.', '')).toBe(true);
		expect(skip('AbortError: The operation was aborted.', '', 'AbortError')).toBe(true);
		expect(skip('TypeError: x', 'at f (chrome-extension://abcdef/content.js:1:2)')).toBe(true);
		expect(skip('TypeError: x', 'f@moz-extension://1234/a.js:1:2')).toBe(true);
		expect(skip('Error: y', 'g@safari-web-extension://id/b.js:3:4')).toBe(true);
	});

	it('deja pasar los errores de verdad', () => {
		expect(skip("TypeError: Cannot read properties of undefined (reading 'x')", `at f (${ORIGIN}/a.js:1:2)`)).toBe(
			false
		);
		expect(skip('Script error.', `at f (${ORIGIN}/a.js:1:2)`)).toBe(false);
	});
});

group('signature', () => {
	it('quita el hash de la build: nodes/12.Hash.js → nodes/12.js y chunks/Hash.js → chunks/*.js', () => {
		expect(shape(`${ORIGIN}/_app/immutable/nodes/12.DwOWLKJQ.js`)).toBe('/_app/immutable/nodes/12.js');
		expect(shape(`${ORIGIN}/_app/immutable/chunks/-5CveK48.js`)).toBe('/_app/immutable/chunks/*.js');
		expect(shape(`${ORIGIN}/_app/immutable/entry/app.Nd7LqZBf.js`)).toBe('/_app/immutable/entry/app.js');
	});

	it('el mismo error da la misma firma con dos builds, otro dominio y otra función minimizada', () => {
		const msg = "TypeError: Cannot read properties of undefined (reading 'price')";
		const a = clean({ msg, stack: chrome('DwOWLKJQ', 'Xe') });
		const b = clean({ msg, stack: chrome('Bq7_x-Z1', 'Ab').replaceAll(ORIGIN, 'https://arc-terminal.pages.dev') });
		expect(a.stack).not.toBe(b.stack);
		expect(signature(a.msg, a.stack)).toBe(signature(b.msg, b.stack));
		expect(signature(a.msg, a.stack)).toMatch(/^[0-9a-f]{8}$/);
		// Otro mensaje u otro archivo: otra firma.
		expect(signature('TypeError: otro', a.stack)).not.toBe(signature(a.msg, a.stack));
		expect(signature(a.msg, `at f (${ORIGIN}/_app/immutable/nodes/13.DwOWLKJQ.js:3:1520)`)).not.toBe(
			signature(a.msg, a.stack)
		);
	});

	it('vale con pilas de Safari (sin «at») y sin pila', () => {
		const msg = "TypeError: undefined is not an object (evaluating 'a.price')";
		const s1 = `render@${ORIGIN}/_app/immutable/nodes/12.AAAA1111.js:3:15`;
		const s2 = `x@${ORIGIN}/_app/immutable/nodes/12.BBBB2222.js:9:99`;
		expect(signature(msg, clean({ msg, stack: s1 }).stack)).toBe(signature(msg, clean({ msg, stack: s2 }).stack));
		expect(signature(msg, '')).toBe(signature(msg, ''));
		// Un marco sin URL (eval, <anonymous>): tampoco cuentan la línea ni la columna.
		expect(signature(msg, 'at eval (<anonymous>:3:9)')).toBe(signature(msg, 'at eval (<anonymous>:7:9)'));
	});
});

group('reporter', () => {
	const report = (msg: string): ErrorReport => clean({ msg, stack: `at f (${ORIGIN}/a.js:1:2)` });

	it('uno por firma y como mucho 5 por carga', () => {
		const sent: string[] = [];
		const send = reporter((r) => sent.push(r.msg));
		expect(send(report('Error: a'))).toBe(true);
		expect(send(report('Error: a'))).toBe(false);
		for (const m of ['b', 'c', 'd', 'e', 'f', 'g']) send(report(`Error: ${m}`));
		expect(sent).toEqual(['Error: a', 'Error: b', 'Error: c', 'Error: d', 'Error: e']);
	});
});

group('canReport', () => {
	it('solo en la web publicada: ni en dev ni en localhost', () => {
		expect(canReport(false, 'arcterminal.dev')).toBe(true);
		expect(canReport(false, 'arc-terminal.pages.dev')).toBe(true);
		expect(canReport(true, 'arcterminal.dev')).toBe(false);
		for (const host of ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', 'arc.localhost'])
			expect(canReport(false, host), host).toBe(false);
	});
});
