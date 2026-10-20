// Configuración de los tests (Vitest). Va aparte de vite.config.ts para no cargar el plugin de
// SvelteKit: los tests solo prueban lógica pura en TypeScript (scripts/ y src/lib/).
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['scripts/**/*.test.ts', 'src/**/*.test.ts', 'cloud/**/*.test.ts'],
		// Después de cada test, deshace los `vi.stubGlobal('fetch', …)` y los relojes falsos.
		unstubGlobals: true,
		restoreMocks: true,
		// Cobertura (`pnpm test:cov`, la usa el job checks de los PR). Cuenta TODOS los .ts de estas carpetas,
		// también los que ningún test carga (salen al 0 %): sin `include`, el porcentaje saldría inflado.
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts', 'cloud/**/*.ts', 'scripts/**/*.ts'],
			exclude: ['**/*.test.ts', '**/__tests__/**', '**/*.d.ts'],
			reporter: ['text-summary', 'json-summary'],
			reportsDirectory: 'coverage',
			// Suelo por carpeta (% de líneas): lo medido al ponerlo, redondeado hacia abajo. Si un PR baja de
			// aquí, `pnpm test:cov` falla. Se sube a mano cuando la cobertura suba; nunca se baja para pasar.
			// Sin autoUpdate: reescribiría este archivo en cada PR y chocarían las sesiones en paralelo.
			// La raíz de scripts/ (smoke, e2e-os, tv-shots…, ~43 %) sale en el informe pero no tiene suelo: son
			// herramientas de navegador que ya prueba su propio job.
			thresholds: {
				'src/lib/**': { lines: 94 },
				'cloud/**': { lines: 89 },
				'scripts/sources/**': { lines: 92 },
				'scripts/alerts/**': { lines: 95 }
			}
		}
	}
});
