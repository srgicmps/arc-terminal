import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// `pnpm dev` arranca en modo 'serve'; `pnpm build` y `pnpm preview`, como la web publicada.
export default defineConfig(({ command, isPreview }) => ({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Fuerza el modo runes de Svelte 5 en nuestro código (no en las librerías).
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Genera HTML, CSS y JS estáticos en /build, sin servidor.
			adapter: adapter({ fallback: '404.html' }),
			// Cada minuto comprueba si se ha publicado una versión nueva (con datos nuevos) para avisar.
			version: { pollInterval: 60_000 },
			prerender: {
				// Los enlaces que vienen de fuentes externas no deben tumbar la publicación.
				handleHttpError: 'warn'
			},
			paths: {
				// GitHub Pages sirve la web en https://srgicmps.github.io/arc-terminal/,
				// así que al construir todas las rutas empiezan por /arc-terminal.
				// Cloudflare Pages la sirve en la raíz: la Action construye con BASE_PATH vacío.
				// En desarrollo se queda en la raíz: http://localhost:5173/
				base: (process.env.BASE_PATH as '' | `/${string}` | undefined) ?? (command === 'build' || isPreview ? '/arc-terminal' : '')
			}
		})
	]
}));
