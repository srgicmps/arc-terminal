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
movimiento (`--dur-ui`, `--dur-fast`, `--ease`), foco (`--focus-w`) y barras de desplazamiento (`--scroll-w`, `--scroll-thumb`, `--scroll-track`). Modo OS (`/os`): `--os-desk`, `--os-win-bg`,
`--os-win-edge`, `--os-win-edge-active`, `--os-win-radius`, `--os-win-shadow`, `--os-title-h`, `--os-title-bg`,
`--os-title-fg`, `--os-title-fg-active` y `--os-snap` (salen de los de arriba: no hace falta tocarlos; ganchos
`data-ui="os-win"` y `"os-title"`). Ejemplo completo: `static/estilos/grafito.css`.

## Estructura: mover cosas de sitio
Una estética puede cambiar la estructura, no solo los colores, **solo con CSS** de su archivo: rejillas con áreas,
`order`, `position`, mostrar u ocultar piezas, pseudo-elementos (`::before`/`::after`, p. ej. marcos de texto), animaciones.
Engánchate SIEMPRE a estos atributos `data-ui` (son la API estable; las clases internas pueden cambiar):

| `data-ui` | Qué es |
|---|---|
| `app` | Contenedor de toda la página (cabecera, navegación, cinta, main, pestañas, pie) |
| `top` | Cabecera: marca, barra de comandos, sitio, relojes, botones |
| `brand` | Logotipo y nombre |
| `place` | Chip «Tu sitio» |
| `clocks` | Relojes de las bolsas (dos a la vista; al pulsar, todos en un `menu`) |
| `more` | Botón «⋯» de la cabecera (portada modular, encajar, tema) |
| `menu` | Lista desplegable de `ui/Menu.svelte` («⋯», «Más ▾» de las secciones, relojes) |
| `cmd` | Barra de comandos (en el móvil, hoja con `.sheet`) |
| `keys` | Fila de secciones (teclas) |
| `key` | Cada tecla de sección (código y, en un `<span>`, el nombre; la actual lleva `aria-current`). «Más ▾» también es `key` (un `<button>`). Lleva `data-code` (TOP, ECO…), como los enlaces de `tabs`: sirve para poner iconos por sección |
| `tape` | Cinta de cotizaciones |
| `panel-index` | Índice de paneles del móvil |
| `main` | Contenido de la vista |
| `tabs` | Barra de pestañas de abajo (hoy solo en el móvil; una estética puede sacarla también en escritorio) |
| `foot` | Pie |
| `view-head` | Cabecera de vista (código, título, fuentes, resumen) |
| `view-title` / `view-code` | Su título (h1) y el código dentro (ECO, WS…) |
| `view-sub` | De dónde salen los datos |
| `view-sum` | Resumen en una línea (o, en Sencillo, la lista de frases) |
| `panel` | Panel (`.max`: ampliado, como hoja modal; `.folded`: plegado) |
| `panel-head` | Cabecera del panel (título, datos, botones) |
| `panel-meta` | El dato de la derecha de la cabecera del panel |
| `fold` | El ▾/▸ de plegar del título del panel |
| `panel-grow` / `panel-close` | El ⤢ de ampliar el panel y el ✕ del panel ampliado |
| `note` | Nota al pie de un panel (fuente, aclaraciones) |
| `table` | Tabla densa |
| `tiles` / `tile` | Fila de cifras grandes y cada cifra |
| `chart` | Gráfico de líneas |

Las rejillas de las vistas usan las clases globales de `app.css`, también estables: `.grid` (y `.grid-2`, `.grid-2e`,
`.grid-3`) y `.col` (una columna de paneles). Además, `<html data-scrolled>` cuando la página ha bajado (títulos que se encogen, barras con sombra).

Reglas:
- Estos retoques van **fuera** de `@layer` y con el prefijo `[data-style='id'][data-style]` (ver la plantilla), para
  ganar al CSS de los componentes. Ejemplo: `[data-style='id'][data-style] [data-ui='tabs'] { display: flex; }`.
- No ocultes información: se puede mover, agrupar o plegar, no quitar. Todo lo que se pueda pulsar sigue pulsable y
  con foco visible. Nada de `display: none` en la barra de comandos ni en la navegación sin dar otro camino.
- En el móvil (≤720 px) la barra de pestañas y el índice de paneles ya existen: aprovéchalos.
- `prefers-reduced-motion`: sin animaciones de estructura.
- Haz capturas también con «encajar en pantalla» (botón ⤢, ≥1280 px) y con un panel ampliado.

## Comprobar
`pnpm check`, `pnpm test` (sobre todo `src/lib/estilos.test.ts`), `pnpm build` y capturas a 390 y 1280 px en noche
y día de ECO, WS (gráficos), HELP y ESTILO.
