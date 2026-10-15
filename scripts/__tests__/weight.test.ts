// Presupuesto de peso por vista: qué archivos cuenta de cada página.
import { describe, expect, it } from 'vitest';
import { overLimit, refsOf } from '../weight.ts';

describe('weight', () => {
	it('cuenta el JS y el CSS propios de la página, sin repetir ni contar los de fuera', () => {
		const html =
			'<link href="./_app/immutable/assets/0.abc.css" rel="stylesheet">' +
			'<link rel="modulepreload" href="../_app/immutable/entry/start.js">' +
			'<link rel="modulepreload" href="./_app/immutable/entry/start.js">' +
			'<script src="https://s3.tradingview.com/tv.js"></script>' +
			'<script>Promise.all([import("./_app/immutable/entry/app.js"), import("./_app/immutable/nodes/3.x.js")])</script>';
		expect(refsOf(html).sort()).toEqual([
			'_app/immutable/assets/0.abc.css',
			'_app/immutable/entry/app.js',
			'_app/immutable/entry/start.js',
			'_app/immutable/nodes/3.x.js'
		]);
	});

	it('Arc OS (/os) no tiene tope; las demás vistas, sí', () => {
		const rows = [
			{ page: 'os.html', bytes: 900_000 },
			{ page: 'geo.html', bytes: 400_000 },
			{ page: 'eco.html', bytes: 100_000 }
		];
		expect(overLimit(rows, 300_000).map((r) => r.page)).toEqual(['geo.html']);
	});
});
