// Dónde vive la web publicada, en un solo sitio: los avisos (ntfy), los issues de fuentes caídas, las
// miniaturas y la lectura de la copia anterior (lib.ts) salen de aquí.
// La URL se cambia sin tocar código con la Variable de GitHub SITE_URL (Settings → Secrets and variables →
// Actions → Variables), p. ej. al pasar a un dominio propio.

/** La web privada: Cloudflare Pages, con Cloudflare Access delante (login por código al email). */
export const SITE = (process.env.SITE_URL || 'https://arc-terminal.pages.dev').replace(/\/+$/, '');

/** La web antigua en GitHub Pages, mientras conviva con la nueva. Se quita al apagar Pages. */
export const LEGACY_SITE = 'https://srgicmps.github.io/arc-terminal';
