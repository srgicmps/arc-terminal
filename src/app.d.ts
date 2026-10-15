// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
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
