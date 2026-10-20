// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** El commit de esta build ('local' sin GITHUB_SHA): vite.config.ts, `define`. Solo para /code.json (al construir). */
	const __ARC_CODE__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Modo OS en el móvil: hay una app, la multitarea o una hoja encima (el «atrás» la cierra). */
			phone?: string;
		}
		// interface Platform {}
	}
}

export {};
