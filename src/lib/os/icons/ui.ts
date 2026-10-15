// Iconos de interfaz de Arc OS (barra, ventanas, menús): trazo fino en el color del texto, sin azulejo. Mismo
// lienzo de 24 y mismas puntas redondeadas que los de las apps (glyphs.ts), para que todo se lea como un solo set.
// Sustituyen a los glifos de texto (▦ ⌕ ⚙ – □ ×), que cada sistema dibuja con su fuente y a otra altura.

export const UI = {
	apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
	desktop: 'M3 5h18v11H3zM8.5 20h7M12 16v4',
	search: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M15.3 15.3 20 20',
	bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4',
	gear: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5a2 2 0 1 1 0 4a2 2 0 1 1 0-4M9 15a2 2 0 1 1 0 4a2 2 0 1 1 0-4',
	user: 'M12 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7M5 20a7 7 0 0 1 14 0',
	close: 'M6 6l12 12M18 6 6 18',
	min: 'M6 12h12',
	max: 'M6 6h12v12H6z',
	restore: 'M9 9h10v10H9zM5 15V5h10'
} as const;

export type UiIconId = keyof typeof UI;
