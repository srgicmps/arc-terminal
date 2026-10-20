// Arc OS tiene su propio aspecto: el escritorio, la barra, los menús y la decoración de ventana no usan la estética
// de la web (data-style, acento ni densidad), sino los colores y la letra del aspecto (data-os-skin, «Mando» en
// tokens.css). Las vistas dentro de las ventanas (?embed=1) sí siguen la estética: son otro documento, y
// webLook las mantiene al día. Fuera de /os todo sigue igual: al salir se vuelve a lo guardado.
// src/app.html hace lo mismo antes de pintar (data-os-look), para que no parpadee.

/** Atributos de <html> que pone la web y que en Arc OS no se usan. */
export const WEB_LOOK = ['style', 'accent', 'density'] as const;

const sheet = () => document.getElementById('style-sheet') as HTMLLinkElement | null;

/** Quita lo de la web (atributos y hoja de la estética) y pone el aspecto. */
function strip(root: HTMLElement, skin: string | null) {
	for (const k of WEB_LOOK) if (k in root.dataset) delete root.dataset[k];
	const link = sheet();
	if (link && !link.disabled) link.disabled = true;
	if (skin && root.dataset.osSkin !== skin) root.dataset.osSkin = skin;
}

/**
 * Pone el aspecto del OS en <html> y lo mantiene aunque algo vuelva a poner la estética (la nube al sincronizar,
 * ESTILO abierto en una ventana…). `skin` da el aspecto actual. Devuelve la limpieza, que devuelve la web a lo
 * guardado en localStorage (por si se cambió algo desde dentro).
 */
export function osLook(skin: () => string | null) {
	const root = document.documentElement;
	root.dataset.osLook = '1';
	const apply = () => strip(root, skin());
	apply();
	// Al entrar desde la web (navegación en el cliente), la barra del móvil aún lleva el fondo de la estética: ahora va
	// el del aspecto, que está en tokens.css (no hay hoja que esperar). Con import(), por lo mismo que barColor.
	void import('../theme.svelte.ts').then((m) => m.syncThemeColor());
	const watch = new MutationObserver(apply);
	watch.observe(root, { attributes: true, attributeFilter: WEB_LOOK.map((k) => `data-${k}`) });
	watch.observe(document.head, { childList: true });
	return {
		/** Vuelve a mirar el aspecto (al cambiarlo). */
		refresh: apply,
		stop() {
			watch.disconnect();
			delete root.dataset.osLook;
			delete root.dataset.osSkin;
			void webLook(root).then(barColor);
		}
	};
}

/**
 * La barra del navegador del móvil (meta theme-color) vuelve al fondo de la estética: dentro de /os se queda con el
 * del aspecto. Como setStyle (src/lib/taste.svelte.ts): en el acto (Terminal no tiene hoja, y una ya cargada vale
 * en cuanto se vuelve a activar) y otra vez al cargar la hoja (al entrar directo en /os no la había).
 * Con import(): theme.svelte.ts usa runas, y look.ts también llega a los tests por embed.ts.
 */
async function barColor() {
	const { syncThemeColor } = await import('../theme.svelte.ts');
	sheet()?.addEventListener('load', syncThemeColor, { once: true });
	syncThemeColor();
}

/**
 * Pone en `root` la estética, el acento y la densidad guardados (lo mismo que src/app.html al cargar). La promesa se
 * cumple cuando el <link> de la hoja ya apunta a la estética (no cuando ha cargado).
 */
export function webLook(root: HTMLElement): Promise<void> {
	const get = (k: string) => {
		try {
			return localStorage.getItem(k);
		} catch {
			return null;
		}
	};
	const st = get('arc-style');
	let ready = Promise.resolve();
	if (st && /^[a-z]+$/.test(st)) {
		if (root.dataset.style !== st) root.dataset.style = st;
		// Con import(): apps.ts (y sus tests) llega aquí por embed.ts, y estilos-css necesita $app/paths.
		ready = import('../estilos-css.ts').then((m) => m.useSheet(st, 'style-sheet'));
	}
	const a = get('arc-accent');
	if (a === 'amber' || a === 'cyan' || a === 'blue') root.dataset.accent = a;
	else delete root.dataset.accent;
	const d = get('arc-density');
	if (d === 'compacta' || d === 'comoda') root.dataset.density = d;
	else delete root.dataset.density;
	const link = sheet();
	if (link) link.disabled = false;
	return ready;
}
