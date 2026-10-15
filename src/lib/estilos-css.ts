// Carga las hojas de las estéticas (src/styles/estilos/*.css). +layout.svelte importa app.css, luego esto y
// luego styles/ajustes.css (densidad y modo Sencillo, que mandan sobre la estética): el orden importa.
// READY: las estéticas que ya tienen archivo (y Terminal, que es tokens.css). Solo esas salen en el selector.

const sheets = import.meta.glob('../styles/estilos/*.css', { eager: true });

export const READY: string[] = ['terminal', ...Object.keys(sheets).map((p) => p.replace(/^.*\//, '').replace(/\.css$/, ''))];
