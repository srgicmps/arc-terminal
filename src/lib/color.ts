// Colores para librerías que no entienden variables CSS (TradingView). Los valores salen siempre de los
// tokens de app.css: así un cambio de paleta se hace en un solo sitio.

/** Valor de un token de app.css (p. ej. '--up') con el tema activo. Vacío fuera del navegador. */
export function token(name: string): string {
	if (typeof document === 'undefined') return '';
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Pasa #rrggbb o #rrggbbaa a rgba() (el navegador puede devolver así un token rgba). Lo demás, igual. */
export function rgba(color: string, alpha?: number): string {
	const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
	if (!hex) return color;
	const n = parseInt(hex[1], 16);
	const a = alpha ?? (hex[2] ? Math.round((parseInt(hex[2], 16) / 255) * 100) / 100 : 1);
	return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
