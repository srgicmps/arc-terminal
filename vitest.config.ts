// Configuración de los tests (Vitest). Va aparte de vite.config.ts para no cargar el plugin de
// SvelteKit: los tests solo prueban lógica pura en TypeScript (scripts/ y src/lib/).
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['scripts/**/*.test.ts', 'src/**/*.test.ts', 'cloud/**/*.test.ts'],
		// Después de cada test, deshace los `vi.stubGlobal('fetch', …)` y los relojes falsos.
		unstubGlobals: true,
		restoreMocks: true
	}
});
