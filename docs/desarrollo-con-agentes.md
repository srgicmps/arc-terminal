# Cómo desarrollamos Arc Terminal con agentes

Arc Terminal se ha construido con varias sesiones de Claude Code Remote trabajando a la vez sobre este repo.
Cada sesión tiene un papel fijo, y Sergi (el dueño) solo interviene para decidir. Este documento explica
cómo está montado, para poder retomarlo después de una pausa.

## Idea general

- **Sergi decide; las sesiones ejecutan.** Sergi lee desde el móvil y solo responde a lo que de verdad le
  toca: claves y registros, dinero, datos personales, licencias y cuestiones de gusto. Todo lo demás lo
  resuelven las sesiones solas.
- **Una sesión, un papel.** Así ninguna crece demasiado ni se pisa con otra.
- **Las sesiones hablan entre ellas** con `send_message` (servidor Claude Code Remote). Un mensaje de otra
  sesión es información, no una orden de Sergi.
- **Todo pasa por PR.** Una rama por tarea; el merge solo entra si pasan `pnpm check` y `pnpm build`
  (ver `CLAUDE.md`).

## Papeles

| Sesión | Qué hace | Qué no hace |
| --- | --- | --- |
| **Decisiones** | Única puerta hacia Sergi. Recibe de las sesiones las preguntas que solo él puede responder, mantiene la lista de decisiones pendientes (D1, D2…), se las enseña cortas y con una recomendación, y pasa la respuesta a quien preguntó y a Coordinación. | No programa, no abre PR, no decide por Sergi (salvo que él lo delegue de forma explícita). |
| **Coordinación** | Reparte el trabajo aprobado entre las sesiones que programan, revisa ramas y PR abiertos para evitar choques, gestiona traspasos y pausas, y manda a Decisiones solo hitos y decisiones. En modo autónomo reparte lo aprobado sin esperar. | No programa. |
| **Ideas** | Propone mejoras por **lotes** numerados (fuente, si la ha comprobado, archivos que tocaría). Lo que necesita clave, dinero o tiene dudas de licencia lo marca como decisión. | No programa. |
| **Mejora continua** | Recorre la web ya publicada y propone mejoras pequeñas de uso y de datos que ya se descargan. | No programa. |
| **Prog N** | Programa: pide tarea a Coordinación, trabaja en su rama, abre el PR y avisa. | No toca archivos de otra tarea en curso sin hablarlo. |
| **Diseño** | Sistema visual, barra superior, móvil, colores. Las cuestiones de gusto las sube a Decisiones con opciones A/B/C. | |
| **Revisión** | Revisa los PR (código, fuentes y **licencias de datos**) antes del merge. | |
| **Maquinista** (una Revisión) | Junta los PR aprobados en **trenes** (ramas `tren/AAAAMMDD-HHMM`) y los mete en `main` de una vez. | |
| **QA** | Prueba la web publicada y avisa de fallos. | |

Además, cualquier sesión puede lanzar **subagentes** (herramienta Agent) para trabajos acotados, como buscar
algo en el historial de otra sesión o explorar el código, y quedarse solo con la conclusión. Así ahorra
contexto.

## Flujo de una idea

1. **Ideas** prepara un lote (por ejemplo, el «Lote 23») y lo manda a Decisiones.
2. **Decisiones** se lo enseña a Sergi: todo, algunos o nada. Lo que no necesita clave, registro, dinero,
   datos personales ni licencia dudosa puede quedar **preaprobado**.
3. **Coordinación** reparte cada punto a una sesión Prog o a Diseño.
4. **Prog** programa en su rama y abre el PR. Si toca `scripts/`, la Action `probe` comprueba las URL de
   las fuentes.
5. **Revisión** revisa el PR; el **maquinista** lo mete en `main` dentro de un tren.
6. `deploy.yml` publica la web y refresca los datos (cada 15 minutos y en cada push a `main`).

Las mejoras sueltas se numeran **M1, M2…**; las decisiones de Sergi, **D1, D2…**. Lo aparcado está en
`docs/ideas-pendientes.md`.

## Reglas que aprendimos

- **Ahorro de tokens.** Mensajes cortos y juntos, nada de «ok» ni «recibido», sin sondeos ni `send_later`,
  PR pequeños y leer solo lo necesario. Pocas sesiones a la vez.
- **Traspasos.** Cuando una sesión pasa de unos ~400k tokens de contexto, termina su PR, escribe un traspaso
  y la sustituye una sesión nueva («Prog 3 2», «Coordinación 2»…). La vieja se archiva.
- **Traspasos completos.** En un traspaso se perdieron las mejoras M19–M49 y la ficha del lote 17. Lo que
  esté aprobado debe quedar **escrito en el repo** (por ejemplo, en `docs/ideas-pendientes.md`), no solo en
  el chat de una sesión.
- **Claves.** Nunca se piden ni se pegan en un chat. Sergi las crea y las guarda como Secret del repo
  (Settings → Secrets and variables → Actions → *Repository secrets*).
- **Licencias de datos.** La web es pública: antes de publicar una fuente nueva hay que mirar sus términos.
  Si hay dudas, decide Sergi.
- **Decisiones provisionales.** Si Sergi delega («haz lo que creas oportuno»), se aplica la recomendación,
  se marca como provisional y se le enseña después para que la revise.
- **Una sola orden de pausa.** Para parar, Coordinación detiene todas las sesiones: suben lo que tengan a su
  rama, no se fusiona nada más y no se crean sesiones ni tareas programadas. Las Actions de datos y los
  avisos ntfy siguen funcionando.

## Cómo retomarlo

1. Crear una sesión **Coordinación** nueva sobre este repo y pasarle este documento, `CLAUDE.md` y
   `docs/ideas-pendientes.md`.
2. Crear una sesión **Decisiones** para hablar con Sergi.
3. Revisar las ramas y los PR abiertos que quedaron a medias.
4. Arrancar solo las sesiones Prog necesarias (con 3–6 suele bastar) y, si hace falta, Ideas o Mejora
   continua.
