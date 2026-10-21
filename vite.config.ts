import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { precachePlugin } from './scripts/precache.ts';

// `pnpm dev` arranca en modo 'serve'; `pnpm build` y `pnpm preview`, como la web publicada.
export default defineConfig(() => ({
	// El commit de esta build (en las Actions, GITHUB_SHA; en local, 'local'). Solo lo usa /code.json, al construir:
	// si solo cambian los datos, la pestaña abierta se refresca en su sitio (src/lib/fresh.ts). El código del
	// navegador no lo lleva, para que un commit nuevo no cambie el nombre de los archivos de la build.
	define: { __ARC_CODE__: JSON.stringify(process.env.GITHUB_SHA ?? 'local') },
	plugins: [
		sveltekit({
			compilerOptions: {
				// Fuerza el modo runes de Svelte 5 en nuestro código (no en las librerías).
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Genera HTML, CSS y JS estáticos en /build, sin servidor.
			adapter: adapter({ fallback: '404.html' }),
			// Sin el sondeo de SvelteKit: lo hace src/lib/fresh.ts, que distingue datos nuevos (refresca en su
			// sitio) de código nuevo («Recargar»). `updated` sigue mirando al fallar una navegación.
			version: { pollInterval: 0 },
			prerender: {
				// Los enlaces que vienen de fuentes externas no deben tumbar la publicación.
				handleHttpError: 'warn'
			},
		}),
		// Tras el adaptador: lo que precachea el service worker (build/_app/precache.json, scripts/precache.ts).
		precachePlugin()
	]
}));
