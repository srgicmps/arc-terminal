# Estéticas: cómo se hace una

Arc Terminal tiene varias estéticas (comando `ESTILO`, HELP «A tu gusto»). Cada una es **un archivo**:
`static/estilos/<id>.css`. El registro (nombre y descripción) está en `src/lib/estilos.ts`; una estética
sale en el selector en cuanto existe su archivo. Solo se descarga la hoja de la estética elegida.

## Reglas
- Solo tocas tu archivo. Si necesitas un token o una letra nueva en el registro, pídelo a la sesión «Producto F
  Estética» (así no chocan varias a la vez).
- Plantilla obligatoria (el test `src/lib/estilos.test.ts` la comprueba). Las letras, con `@import` de Google Fonts
  al principio del archivo (solo así se cargan):

```css
/* ── Estética «Nombre» (src/lib/estilos.ts) ── qué es, en una o dos líneas */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
@layer tokens, estilos, ajustes;
@layer estilos {
	:root[data-style='id'],
	[data-style='id'] {
		/* noche: colores en #hex, forma, letras… */
	}
	:root[data-theme='light'][data-style='id'],
	:root[data-theme='light'] [data-style='id'] {
		/* día: colores */
	}
}
/* Si un token no basta: retoques de componente FUERA de la capa (el CSS de los componentes no tiene capa y
   ganaría a cualquier regla de dentro), con el prefijo [data-style='id'][data-style] para ganarle también
   en especificidad. Vale para la página y para la vista previa. */
[data-style='id'][data-style] .t th {
	text-transform: none;
}
```

- **Capas**: `tokens` (tokens.css) < `estilos` (tu archivo) < `ajustes` (densidad «Cómoda» y modo «Sencillo»). Por eso
  tu bloque manda sobre el tema de día de la base: en tu bloque de día define **todos** los colores que cambies de noche.
- **Vista previa**: el selector pinta una tarjeta con `data-style="id"` dentro de la página. Los tokens que dependen de
  otros (`--border: var(--hair) solid var(--line)`, `--font-ui`, `--title-font`…) hay que **declararlos en tu bloque**
  si cambias aquello de lo que dependen.
- **Colores en #hex** para `--bg`, `--panel`, `--fg`, `--muted`, `--faint`, `--amber`, `--up`, `--down`: el test mide
  el contraste (AA 4,5:1; «Alto contraste», AAA 7:1) en noche y día. `--amber` es «el acento», sea del color que sea.
  Verde (`--up`) y rojo (`--down`) solo para subidas y bajadas.
- **Letras**: solo libres (Google Fonts/OFL) o del sistema, con el `@import` de arriba (el test solo deja
  fonts.googleapis.com). Úsalas en `--sans`, `--mono`, `--font-ui`, `--title-font`. Cifras tabulares: `body` ya lleva `tabular-nums`.
- **Sin** `!important`, sin marcas ni nombres ajenos, sin imágenes externas (dibujos con gradientes CSS en `--bg-image`).
- **Rendimiento y accesibilidad**: efectos caros (`backdrop-filter`, brillos, animaciones) solo dentro de
  `@media (prefers-reduced-motion: no-preference)` o `@supports`, y fuera en `prefers-reduced-transparency: reduce`.
  En móvil (≤720 px), mejor sin `backdrop-filter`. El foco (`:focus-visible`) siempre visible.

## Tokens que puedes cambiar (tokens.css)
Colores (`--bg`, `--panel`, `--raise`, `--line`, `--fg`, `--muted`, `--faint`, `--amber*`, `--on-amber`, `--up`,
`--down`, `--neutral`, `--series-2/3`, `--scrim`, casillas de ajedrez), letras (`--sans`, `--mono`, `--font-ui`,
`--title-font`, `--fs-*`, `--fw-*`, `--lh*`, `--track-*`), forma (`--radius`, `--radius-s`, `--shadow`, `--shadow-pop`,
`--hair`, `--border`, `--panel-edge`, `--panel-blur`), rejillas (`--grid-gap`, `--grid-fill`, `--grid-edge`,
`--grid-join`, `--col-fill`, `--stack-gap`, `--stack-edge`), títulos (`--fs-title`, `--title-case`, `--title-track`,
`--title-color`), espaciado (`--sp-*`, `--pad-x`, `--row-y`, `--head-y`, `--gutter`), fondo (`--bg-image`) y
movimiento (`--dur-ui`, `--dur-fast`, `--ease`), foco (`--focus-w`). Ejemplo completo: `static/estilos/grafito.css`.

## Comprobar
`pnpm check`, `pnpm test` (sobre todo `src/lib/estilos.test.ts`), `pnpm build` y capturas a 390 y 1280 px en noche
y día de ECO, WS (gráficos), HELP y ESTILO.
