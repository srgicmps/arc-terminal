// Presupuesto de peso por vista: qué archivos cuenta de cada página.
import { describe, expect, it } from 'vitest';
import { refsOf } from '../weight.ts';

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
});
