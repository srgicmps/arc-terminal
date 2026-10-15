// Alt+Tab visual de Arc OS: en qué orden salen las ventanas y cómo se dibuja cada miniatura. Lógica pura.
// Las miniaturas no son capturas (una vista dentro de un iframe no se puede fotografiar sin coste): son el
// escritorio en pequeño, con la ventana elegida en su sitio y las demás en tenue, como el mapa de un dock.
import type { Rect, Win } from '../wm.ts';

/** Por orden de uso: la que tiene el foco primero (las minimizadas también entran). */
export const switchOrder = (wins: readonly Win[]) => [...wins].sort((a, b) => b.z - a.z);

/** El siguiente índice dando la vuelta. */
export const stepIndex = (i: number, n: number, dir: 1 | -1) => (n ? (((i + dir) % n) + n) % n : 0);

/** Un rectángulo del escritorio (`area`) en % de la miniatura, recortado a lo que se ve. */
export function thumbRect(r: Rect, area: { w: number; h: number }): { left: number; top: number; width: number; height: number } {
	const pct = (v: number, of: number) => Math.round((v / (of || 1)) * 1000) / 10;
	const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
	const x0 = clamp(r.x, area.w), x1 = clamp(r.x + r.w, area.w);
	const y0 = clamp(r.y, area.h), y1 = clamp(r.y + r.h, area.h);
	return { left: pct(x0, area.w), top: pct(y0, area.h), width: pct(x1 - x0, area.w), height: pct(y1 - y0, area.h) };
}
