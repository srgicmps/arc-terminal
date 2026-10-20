import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { precachePlugin } from './scripts/precache.ts';

// `pnpm dev` arranca en modo 'serve'; `pnpm build` y `pnpm preview`, como la web publicada.
export default defineConfig(() => ({
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
		}),
		// Tras el adaptador: lo que precachea el service worker (build/_app/precache.json, scripts/precache.ts).
		precachePlugin()
	]
}));
