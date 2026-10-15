# Arc OS: lista de comprobación

Lo que ya hace el Modo OS (`/os`, `src/lib/os/`), por sesión. Cada sesión añade sus casillas en su sección.

## OS 6 · Centro de mando

Aspecto «Mando» y apps de análisis inspiradas en las plataformas de inteligencia, sin marcas ni logos de nadie y
sin imitar a ningún gobierno (solo la franja «ARC · USO PRIVADO»).

- [x] Aspecto «Mando» (`data-os-skin='mando'`, 5.º de `skins.ts`): pizarra con rejilla técnica tenue, letra mono, acento frío (`--cmd-*` en `tokens.css`) y ámbar, bordes de 1 px y esquinas casi rectas.
- [x] Barra de arriba (`MandoBar.svelte`): menú de apps, pestañas de ventanas, nivel de alerta global de 1 a 5 y relojes UTC y Madrid con segundos.
- [x] Nivel de alerta (`mando.ts → alertLevel`): avisos graves del muro (los P1) y el tema más cubierto de IMP; el porqué en el título.
- [x] Franja de abajo (`MandoStrip.svelte`): «ARC · USO PRIVADO», pilotos de fuentes en vivo por grupo (IMP, GEO, MERC, MACRO), fuentes que van y fecha.
- [x] Estilo único y fijo de Arc OS (decisión de Sergi): paleta, letra y formas propias en `[data-os-skin='mando']`; la estética, el acento y el tema de la web solo se aplican dentro de las apps.
- [ ] Mapa operacional · Grafo de entidades · Expediente · Línea de tiempo · Vigilancia.
