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
	restore: 'M9 9h10v10H9zM5 15V5h10',
	refresh: 'M20 12a8 8 0 1 1-2.35-5.65M20 4.5v4h-4',
	rotate: 'M5 11h9v9H5zM9 7a6.5 6.5 0 0 1 9.5 2M18.5 5v4h-4',
	contrast: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16M12 4v16M12 8h7M12 12h8M12 16h7',
	toggle: 'M3 12a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5M16 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5',
	globe: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3',
	power: 'M12 3v8M7.5 6.2a7.5 7.5 0 1 0 9 0',
	sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
	taskbar: 'M3 5h18v14H3zM3 15.5h18M6 17.25h2M10 17.25h2',
	widgets: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
	sync: 'M4 10a8 8 0 0 1 14.3-3.6M20 4v4h-4M20 14a8 8 0 0 1-14.3 3.6M4 20v-4h4',
	export: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5',
	storage: 'M5 6c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 7.4 5 6M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5',
	info: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18M12 11v5.5M12 7.75v.01',
	signal: 'M12 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6',
	keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10'
} as const;

export type UiIconId = keyof typeof UI;
