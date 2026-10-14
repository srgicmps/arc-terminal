// Configuración de ESLint (formato «flat config»: un array de bloques que se aplican en orden).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
	// Generado o descargado: no se revisa.
	{ ignores: ['build/', '.svelte-kit/', 'static/data/', 'node_modules/'] },

	// Reglas recomendadas: JavaScript, TypeScript y Svelte 5.
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,

	// Desactiva las reglas de estilo que ya decide Prettier (el formato no es cosa de ESLint).
	prettier,
	...svelte.configs.prettier,

	// La web se ejecuta en el navegador; vite.config.ts y compañía, en Node al construir.
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},

	// Ajustes a reglas recomendadas que chocan con patrones legítimos del repo.
	{
		rules: {
			// `try { localStorage… } catch {}`: si el navegador bloquea el almacenamiento, se sigue sin él.
			'no-empty': ['error', { allowEmptyCatch: true }],
			// Casi todos los enlaces son a noticias externas que vienen en los datos (href={item.url}),
			// y resolve() solo vale para rutas de la propia web. Se sigue revisando goto().
			'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }]
		}
	},

	// Los scripts que descargan datos solo corren en Node (GitHub Actions).
	{
		files: ['scripts/**'],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			// Las respuestas crudas de las APIs externas se leen como `any` antes de limpiarlas y tiparlas.
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},

	// El service worker vive en otro entorno: sin DOM, con self, caches, clients…
	{
		files: ['src/service-worker/**'],
		languageOptions: { globals: { ...globals.serviceworker } }
	},

	// Dentro de los .svelte el <script lang="ts"> se analiza con el parser de TypeScript.
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	}
);
