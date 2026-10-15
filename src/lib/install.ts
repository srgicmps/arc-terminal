// Aviso «Instalar en tu móvil»: qué instrucciones tocan según el navegador. Lógica pura, con tests.

export type InstallPlatform = 'ios' | 'android';

/**
 * iPhone/iPad (Safari: Compartir → Añadir a pantalla de inicio) o Android (menú ⋮ → Instalar app).
 * Nada si ya está instalada o no es un móvil: en el ordenador no se avisa.
 */
export function installPlatform(ua: string, standalone: boolean, touchPoints = 0): InstallPlatform | null {
	if (standalone) return null;
	// El iPad con iPadOS se presenta como un Mac, pero tiene pantalla táctil.
	if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
	if (/Android/.test(ua)) return 'android';
	return null;
}

/** En el iPhone solo Safari sabe instalar (los demás navegadores de iOS lo ocultan o lo llaman distinto). */
export const iosSafari = (ua: string) => /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
