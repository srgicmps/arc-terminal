# Ideas pendientes de Arc Terminal

Estado a 14/10/2026, 17:00 hora de Madrid; lotes 19–22 y Mejora continua añadidos a las 22:30. Lo prepara la sesión
«Ideas» (ahora «Ideas 2») para retomarlo en la próxima sesión.
Regla: lo aprobado no se reparte hasta que Sergi descongele el trabajo nuevo (se congeló hasta fusionar todos
los PR abiertos). Antes de programar cualquier cosa, mirar si ya hay rama o PR (`claude/*`).

## 1. Aprobado por Sergi y aún sin repartir (en orden de prioridad)

1. **MANUAL** (prioridad alta). Comando `MANUAL` con absolutamente todo: vistas, paneles, comandos con argumentos y
   ejemplos que se pueden tocar, atajos, personalización, avisos al móvil (ntfy), sin conexión, Tu sitio, ajedrez,
   novedades y preguntas frecuentes. Buscador y acordeón en el móvil. **Se genera desde los registros** y un test
   falla si algo queda sin documentar:
   - campo `manual` en cada comando (`src/lib/commands/<código>.ts`, tras el refactor de Prog 5: section, what,
     args con examples/options, tips, panels);
   - `src/lib/shortcuts.ts` como única lista de atajos (la usan CommandBar y +layout);
   - `src/lib/prefs.ts` como registro de claves de localStorage;
   - sección de avisos generada desde `scripts/alerts/config.ts`;
   - tests: todo comando documentado, toda ruta con comando, todo ejemplo se resuelve con `resolveInput`, todo
     atajo y toda preferencia documentados, y smoke de /manual a 390 y 1280 px.
   HELP se queda como chuleta rápida con un enlace al manual. Dos PR: (1) registros, vista y tests; (2) miniaturas
   (capturas de la prueba de humo) y novedades.
2. **LIDER fase 1**: `LIDER <nombre>`, ficha individual, agenda del BCE con todo el Comité Ejecutivo, ventana de 7
   días y líderes en la búsqueda. Más elegir y ordenar líderes en el navegador.
3. **Funciones por valor**: `NVDA GP` (gráfico), `CN` (noticias), `DES` (perfil), `FA` (fundamentales),
   `TA` (técnico) y `SEC`.
4. **Chips y controles de exportación**: el BIS de Comercio (Federal Register) en `sanctions.ts`, en GEO y en un
   panel de TECH.
5. **GEO, panel de diplomacia**: Departamento de Estado, FCDO, SEAE y OIEA, en lugar de «Gobiernos» (solo en GEO).
6. **Fuentes de AI y TECH**: Google DeepMind, NVIDIA, Meta AI, Import AI, The Register y Rest of World, y arreglar
   el filtro de HN (quitar «model» y «agents?»).
7. **Plegar paneles**, recordado por vista y panel.
8. **Exportar e importar ajustes** con un enlace (crea `prefs.ts`, que también usa MANUAL).
9. **Autocompletar argumentos** (provincias, líderes, países, funciones…).
10. **Atajos**: Ctrl/Cmd+K, `?`, `[` y `]`. **Decisión de Sergi: Esc dentro de una ficha vuelve a la vista anterior.**
11. **Palabras vigiladas en todos los titulares**, no solo en el BOE.
12. **País de referencia** en TOP y ECO.
13. **Silenciar medios e idioma** de los titulares (campo `lang` en los feeds).
14. **Medios del mundo** en GEO: Kyiv Independent, SCMP, Nikkei Asia y Africanews.
15. **Análisis de conflictos**: Crisis Group (CrisisWatch), Foreign Affairs, Elcano, ECFR e ISW.
16. **Modelos de IA con su precio** (OpenRouter, sin clave).
17. **Regulación y antimonopolio** en TECH: FTC, DOJ y la Comisión filtrada (competencia, DMA, AI Act).
18. **LIDER fase 2**: unos 25 líderes con el cargo al día desde Wikidata y la vista «Hoy en el mundo».
19. **Fichas de entidad** (`/org`: BCE, Fed, FMI, OTAN, ONU, OPEP).
20. **Búsqueda completa**: líderes, países y actos de agenda en la barra; filtros en NEWS (`NEWS inflación /eco /7d`).
21. **Nombres enlazados** en los titulares y una fila «Relacionado» en cada ficha.
22. **LIDER fase 3**: agendas oficiales (Elysée, Bundesregierung, Fed, Consilium, ONU; hay que probarlas) y
    cumbres. Descartadas: Xi (Xinhua parado desde 2017) y la agenda de la Comisión (404 desde Actions).
23. **Polymarket**: cambio en 24 h (`oneDayPriceChange`) y filtro por tema.
24. **Sanciones de la UE** leyendo eurlex (#138, tema «Sanciones»); la OFSI del Reino Unido es opcional.
25. **Titulares de GEO por región** (Europa, Oriente Medio, Asia, América, África).
26. **Terremotos de España**: de GEO a ES.
27. **LIDER**: Powell, con agenda y discursos de la Fed; von der Leyen solo con «lo último».

Avisos al móvil aprobados (para Prog 2, con la ficha detallada ya enviada): euríbor mensual con hipoteca tipo,
conflictos y escaladas (grupos de IMP), elecciones (día y resultado), novedades grandes de IA, lanzamientos espaciales
1 h antes, problema de ajedrez en el resumen de la mañana, SEMANA los domingos a las 19:00, valores seguidos
(defensa + NVDA + AAPL, con Finnhub; los no estadounidenses quizá no salgan en el plan gratis), diésel (±3 cts en 7
días, mínimos o máximos de 90 días, zona a ±5 cts de la media de España), avisos meteorológicos naranja y rojo de su
zona, y temas generales (apagón, GDACS, IODA, caídas de servicios, huelgas, ciberataques, OMS, luz de mañana,
festivos y cambio de hora). Tope: 50 al día, a cualquier hora. La zona va en Secrets.

## 2. Lote 18: APROBADO por Sergi (14/10, 20:12 hora de Madrid), con orden de empezar ya

1. **NOVEDADES**: lo fusionado en la última semana (API de GitHub con GITHUB_TOKEN en la Action).
2. **Incertidumbre y riesgo geopolítico**: EPU (policyuncertainty.com) y GPR (Caldara–Iacoviello). Sin clave;
   hay que probarlos con probe.
3. **Presión en las cadenas de suministro**: GSCPI de la Fed de Nueva York (XLSX mensual).
4. **Deuda y déficit por país** con el FMI (GGXWDG_NGDP y GGXCNL_NGDP) en ECO y PAIS.
5. **Calendario de todos los bancos centrales grandes** (BoE, BoJ, SNB, BoC, RBA, Banxico, BCB, RBI, PBoC). Va en
   CAL, junto a «Próximo dato» (M10): que lo haga la misma sesión.
6. **Stablecoins**: capitalización de USDT, USDC… con DefiLlama (sin clave).
7. **Exportar a CSV** cualquier tabla.

## 2b. Mejora continua 3, lote 2 (comandos): APROBADO por Sergi, para la próxima sesión (va detrás de la lista 1)

Todo pequeño y sin fuentes nuevas (commands.ts, cmdline.ts, CommandBar y tests). Orden de prioridad:
- **C8** Mnemónicos de Bloomberg como alias: WEI → WS, FXC → WS (divisas), GC/YCRV → WS (curva), WIRP → ECO,
  ECOW/EVTS → CAL, N/CN → NEWS, BI → AI. Y una columna «Equivalente Bloomberg» en HELP.
- **C10** Calculadora y conversor en la barra: «=1250*1.21» y «100 USD EUR» (cambios del BCE de src/lib/fx.ts),
  con un parser propio, sin eval.
- **C9** Ir a un panel: «ECO TIPOS», «WS CURVA» → abre la vista con #ancla y resalta el panel.
- **C11** Ayuda de un comando («ECO ?», «HELP FUEL»). Se junta con MANUAL: que sea la ficha de ese comando en el manual.
- **C12** Fechas en los argumentos: «LUZ mañana», «CAL viernes», «WX sábado» (en hora de Madrid). «BOE ayer»,
  cuando esté M17 (BOE de la semana).

## 2c. Lotes 19 y 20: PREAPROBADOS por Sergi (14/10, 22:03 hora de Madrid), ya en Coordinación

Solo usan claves que ya están en Secrets (FINNHUB_API_KEY y FRED_API_KEY). Fuentes nuevas sin comprobar en vivo:
confirmarlas con probe o con Run workflow «fuentes». Orden sugerido: 20.5 → 19.3 → 19.4 → 19.5 → 20.1 → 19.2 →
20.4 → 20.2 → 20.3 → 19.1 → 20.6.

**Lote 19 · Mercados y macro**
- **19.1 Ficha de valor ampliada** (Finnhub, en /s): recomendaciones de analistas por mes, sorpresas de resultados de
  4 trimestres, compras y ventas de directivos (90 días) y precio objetivo si el plan gratis lo da. Caché de 24 h,
  solo TICKERS y MIS de EE. UU., repartiendo llamadas entre pasadas (límite 60/min).
- **19.2 CAL: salidas a bolsa** de los próximos 30 días (Finnhub /calendar/ipo).
- **19.3 ECO: inflación esperada y tipos reales de EE. UU.** (FRED: T5YIE, T10YIE, DFII10, T5YIFR).
- **19.4 WS: diferenciales de crédito** (FRED: BAMLH0A0HYM2, BAMLC0A0CM y BAMLHE00EHYIOAS si está). ICE limita el
  histórico en FRED.
- **19.5 ECO: liquidez neta de la Fed** (WALCL − WTREGEN − RRPONTSYD, semanal). Se junta con el balance de los bancos
  centrales del lote 15.
- **19.6 Avisos** (opcional, Prog 2): liquidez neta −100.000 M$ en 4 semanas, o HY +50 pb en una semana → P2.

**Lote 20 · Mundo, tecnología y uso**
- **20.1 TECH: estado de internet** (Cloudflare, AWS, Google Cloud, Microsoft 365, GitHub, OpenAI, Anthropic) con las
  páginas de estado que ya usa la fuente de avisos.
- **20.2 «Leer luego»**: ☆ en cada titular, comando `LEER`; entra en prefs.ts.
- **20.3 MIS: notas por valor**, en el navegador y exportables con los ajustes.
- **20.4 Gráficos: periodos comunes** 1M/6M/1A/5A/Máx en LineChart, recordando el último (para Diseño).
- **20.5 WS: mapa de calor de divisas** (widget forex-heat-map de TradingView).
- **20.6 PAIS y GEO: gasto militar** (SIPRI, Excel anual sin clave, leído con exceljs; hay que citar al SIPRI).

## 2d. Lotes 21 y 22: PREAPROBADOS por Sergi, salvo la EIA (D30, ya aprobada: Sergi está creando EIA_API_KEY)

Ninguna fuente está comprobada en vivo: confirmarlas con probe. Ninguna limita por IP que se sepa.

**Lote 21 · Mercados y macro, al estilo Bloomberg**
1. **ECST**: tabla del G20 (PIB, IPC, paro, tipos, bono a 10 años, deuda y déficit), ordenable, sin fuentes nuevas.
2. **VIX y su curva**: VIX9D, VIX, VIX3M, VIX6M, VVIX y SKEW (CSV de cdn.cboe.com), con aviso de «curva invertida».
3. **COT de la CFTC** (Socrata, publicreporting.cftc.gov): oro, petróleo, euro, yen, bonos, S&P 500 y bitcoin.
4. **GDPNow** (FRED GDPNOW).
5. **SPF del BCE**: inflación esperada por los expertos (en ecb.ts).
6. **Monitor del mercado monetario**: €STR, euríbor, SOFR, EFFR, IORB y DTB3.
7. **Compras y ventas de directivos** (Finnhub insider-transactions), solo si no va ya en la ficha ampliada (19.1);
   si va, que lo haga la misma sesión.
8. **Inventarios semanales de crudo y gasolina de la EIA** (API v2, Secret EIA_API_KEY): D30 aprobada; empezar
   cuando el Secret exista.

**Lote 22 · Mundo y uso**
1. **ACNUR** (api.unhcr.org/population/v1/, sin clave, dato anual): panel en GEO y fila en PAIS.
2. **Teclado de terminal**: j/k o flechas, Enter abre, «o» abre la fuente; en shortcuts.ts, Table y NewsList.
3. **Informe imprimible** con @media print para TOP e IMP (tema claro, sin barra ni TradingView, URL de la fuente).
4. **Deslizar entre vistas** en el móvil sobre la cabecera, respetando prefers-reduced-motion.
5. **axe-core en la prueba de humo** (contraste y etiquetas).
6. **Presupuesto de peso por vista** en el job `checks`.

## 2e. Mejora continua 1–5, consolidado: 18 ideas PREAPROBADAS, sin clave (por prioridad)

**Datos que ya se descargan y no se ven**
1. GEO, «Señales de riesgo»: advisories, gdacs, ioda y who-don.
2. PAIS, fila «Riesgo».
3. LUZ Europa con energycharts (adaptándose a la rama `luz-europa-holgura`).
4. LUZ, demanda real frente a prevista (ree-demand).

**Personalización** (prefs.ts)
5. Elegir la barra inferior.
6. `persisted()` en los Seg, junto con los filtros de NEWS en la URL.
7. Cinta con mis valores.
8. Varias listas en MIS.
9. Países favoritos.
10. Vista de inicio.
11. CAL: filtrar por países e importancia.

**Comandos**
12. Países en la barra (search.ts).
13. Fila «Ir a» en PAIS.

**Otros**
14. AI: cesta de la cadena de la IA.
15. «Próximo dato» más completo (BEA, paro semanal, H.4.1, avance del INE): misma sesión que M10 y el lote 18.
16. WX: avisos por provincia y país (adaptándose a la rama `wx-aire-avisos`).

**Lote 5 de Mejora continua** (preaprobado)
17. TOP: el tiempo y la gasolina con «Tu sitio» en vez de Maó fijo. El tiempo, con Open-Meteo desde el navegador,
    como WX; la gasolina, con la media provincial de fuel-es y las 3 más baratas. Archivos: src/routes/+page.svelte,
    +page.server.ts y src/lib/place.svelte.ts.
18. «Mi mañana»: los datos macro de hoy (dataset releases) en hora de Madrid. Archivos: Morning.svelte y
    +page.server.ts.

Fusionadas o quitadas: hicp-ea (ya en #165); alias de LIDER (Prog 5, F1); HELP generada (va con MANUAL);
statuspage (dentro del #175); diplomacia (entra en FEEDS.intl en lugar de la tarea 5 de la lista 1); orden de ECO y
vista modular (misma sesión). El fallo del ejemplo de WX en HELP ya lo tiene QA.

## 2f. Lote 26-B (Ideas 3, 15/10): PROPUESTO, pendiente de Sergi

Ninguna fuente está comprobada en vivo (el entorno de Ideas no tiene red): confirmarlas con probe. Ninguna pide
clave ni registro. Comparar con el lote 26-A antes de repartir, por si algo se repite.

**Bloque A · Macro y mercados**
1. **ECO: sentimiento económico de la zona euro**: ESI y confianza del consumidor (Eurostat, mensual).
2. **WS/ECO: cuentas del Tesoro de EE. UU.**: déficit del año fiscal y recaudación por aranceles (Monthly Treasury
   Statement, dominio público).
3. **ECO: nowcast de inflación de EE. UU.**: IPC y PCE del mes en curso (Fed de Cleveland, diario). Duda de licencia:
   confirmar los términos de clevelandfed.org.

**Bloque B · Fuentes nuevas de IA, España y mundo**
4. ★ **AI: modelos frontera y cómputo**: últimos modelos notables, quién los hace y su cómputo de entrenamiento
   (Epoch AI, CC BY).
5. **ES: paro registrado** del SEPE, mensual y por comunidad, junto a la afiliación.
6. **ES: Congreso de los Diputados**: votaciones e iniciativas de la semana (datos abiertos del Congreso; comprobar
   el aviso legal y que no bloquee robots).
7. **GEO: migración irregular a Europa por ruta** (Frontex, mensual; reutilización citando la fuente).

**Bloque C · Uso y datos que ya se descargan**
8. ★ **TOP: termómetro de riesgo**: una fila con semáforo (estrés financiero, VIX y su curva, diferenciales de
   crédito, curva de tipos, señales de recesión, incertidumbre). Sin fuentes nuevas.
9. ★ **Suscribirse a la agenda** (.ics): bancos centrales, datos macro y resultados, para el calendario del móvil.
10. **Récords y extremos**: marcar cuando un dato toca su máximo o mínimo de varios años («paro mínimo desde 2008»).
11. **Resumen en una línea** arriba de cada vista, hecho con los datos (sin IA), pensado para el móvil.

## 2g. Lote 28 (Ideas 4, 15/10): viabilidad de 21 ideas de otros terminales, aprobadas en principio

Sin red en el entorno de Ideas: ninguna fuente nueva está comprobada en vivo; las marcadas «probe» se confirman con
`scripts/probe.txt`. Esfuerzo: S (horas), M (un PR normal), L (varios PR). ✅ viable · ⚠ con pega · ❌ no viable.

1. ✅ M **EQS**: widget «screener» de TradingView (sin clave; filtros de sector, PER, dividendo, subida). Probe del widget.
2. ✅ S **MOST**: ya existe `HotLists` (TradingView hotlists, EE. UU./Alemania/España) en WS; falta solo el comando.
3. ⚠ M **RV**: Finnhub `/stock/peers` + `/stock/metric` (gratis, ya se usa en `perf.ts`); pega: cupo de 60/min, solo
   EE. UU. y para unos 50 valores, cada 12 h.
4. ✅ M **HDS**: invertir los 13F que ya baja `funds.ts`: «qué fondos de FONDOS tienen NVDA». Solo esos fondos, con 45 días de retraso.
5. ⚠ M **CACS**: dividendos y splits salen gratis de SEC (8-K) a medias; `/stock/dividend` de Finnhub es de pago
   (probar `dividend2`/`split` con probe). Recompras: solo texto de 8-K/10-Q. Empezar por resultados + dividendos.
6. ⚠ M **WB**: EE. UU. (Tesoro, 2/10/30), zona euro (curva del BCE, `YC`), Japón (`jgb.ts`) sí; Reino Unido y China
   siguen aparcados. FRED da 10 años mensual de la OCDE para ~30 países. Probe de `YC` 30Y.
7. ✅ S **BTMM**: SOFR ya en FRED; €STR (BCE), letras del Tesoro y Euríbor (BCE/FRED); NY Fed API sin clave (probe).
8. ✅ S **NI**: filtrar los titulares ya descargados con `queryWords`/`hasWords` y temas predefinidos (CHIPS, OIL…).
   Solapa con NEWS: mejor como argumento de NEWS («NEWS CHIPS») que como comando nuevo.
9. ⚠ L **DASH**: ya hay paneles fijados en TOP (`pins`); ampliarlo a varios tableros con nombre. Toca el layout y el
   modo encajar.
10. ✅ M **G**: un registro de series (id → dataset + ruta) y `LineChart`; varias a la vez en base 100 o dos ejes.
11. ✅ S **Estacionalidad**: cálculo propio sobre series mensuales ya guardadas (FRED, INE, luz). Sin fuente nueva.
12. ⚠ M **Correlaciones**: hace falta historial diario de precios; FRED (S&P, petróleo, oro, euro, 10 años) sí. Acciones
    sueltas no (Finnhub `candle` es de pago). Empezar por macroactivos de FRED.
13. ⚠ S **Mapa de calor mundial**: ya hay S&P, Nasdaq, DAX e IBEX; el widget admite más índices (Euro Stoxx, Nikkei…).
    Por país en una sola vista: TradingView no lo da; quedaría «índice por índice».
14. ⚠ M **Señales técnicas**: Finnhub `/stock/metric` da máx./mín. de 52 semanas gratis; cruces de medias y RSI piden
    velas diarias (de pago en Finnhub). Alternativa: widget «technical-analysis» de TradingView en la ficha.
15. ❌ **Conflictos en directo**: ACLED pide registro y no deja redistribuir; UCDP pide token desde 2025 y va con
    retraso; GDELT descartado. Lo más cercano ya está (GEO con titulares y terremotos).
16. ⚠ M **Aviones de Estado**: adsb.lol (ODbL, `/v2/mil`, sin clave) o OpenSky (no comercial, 400 créditos/día).
    Pegas: privacidad (solo militares/Estado, sin seguir rutas) y que bloqueen IP de Actions. Probe.
17. ⚠ S **Ctrl/Cmd+K**: ya aprobado (lista 1, n.º 10); comprobar con Prog Barra 3/4 antes de repartir.
18. ⚠ S **Atajos vim**: «/» ya existe; «g t», «g w» caben en `shortcuts.ts`. Mismo choque con Prog Barra 3/4.
19. ⚠ M **Solo texto**: un `data-density` en tokens (`--row-y`, `--pad-x`) sin gráficos ni widgets. Toca el layout.
20. ✅ S **Notas**: localStorage registrado en `prefs.ts`, en ficha de valor y PAIS. Sin datos externos.
21. ⚠ M **Informe semanal**: PDF con la impresión del navegador (CSS de impresión en SEMANA, S); email desde Actions
    pide un servicio de correo (cuenta/clave): decisión de Sergi. ntfy con enlace a SEMANA, gratis.

22. ✅ L **VENTANAS** (aprobada por Sergi; va con la 9): modo Launchpad solo en escritorio (≥1280 px). Paneles que se
    arrastran, redimensionan, minimizan y pasan al frente; mezcla de vistas; varios escritorios con nombre guardados
    en el navegador. En el móvil no cambia nada. Sin datos externos.
    Encaje: es una **ruta propia** (`/ventanas`), no un modo de las vistas actuales. Así no toca la rejilla ni
    «encajar en pantalla» de `+layout.svelte`: el lienzo ocupa el alto libre y cada ventana tiene su propio scroll.
    Para mezclar vistas se reutiliza el registro de `pins.ts` (import dinámico del contenido + `dataset()`), que ya
    monta paneles fuera de su vista en TOP. Los paneles que no están en `PINS` se añaden ahí, y así también sirven
    para fijarlos.
    Enfoque sin librerías: Pointer Events (`pointerdown`/`move`/`up` con `setPointerCapture`) en la cabecera para
    mover, un asa en la esquina para redimensionar, z-index por orden de uso, ajuste a una cuadrícula de 8 px
    (`--sp-8`) y límites dentro del lienzo. Estado en localStorage (`{escritorios: {nombre: [{pin, x, y, w, h,
    min}]}}`) registrado en `prefs.ts`. Teclado: Tab entre ventanas y flechas para mover (accesibilidad).
    Pegas: los widgets de TradingView se recargan si se vuelven a montar (se mueven con CSS, sin desmontarlos).
    Con muchas ventanas pesa: tope de ~12 por escritorio.
    Esfuerzo: 2 PR. (1) lienzo, ventanas y un escritorio; (2) varios escritorios, minimizar a una barra inferior y
    DASH (9) como «escritorio en rejilla».

**Revisión con la regla nueva de Sergi (15/10)**: claves y registros gratuitos, sí; lo que manda es la licencia.
Hecho de memoria, sin red: confirmar límites y términos con probe y en la web de cada servicio antes de programar.
- **15 Conflictos → ⚠ M (antes ❌).** UCDP GED Candidate (CC BY 4.0, eventos con muertos, versión mensual con
  ~1 mes de retraso). Token gratis que se pide en https://ucdp.uu.se/apidocs/ · Secret `UCDP_TOKEN`. Es «casi en
  directo», no tiempo real. ACLED: registro gratis (https://acleddata.com), pero sus términos prohíben redistribuir
  los datos de eventos y la cuenta gratuita da poco detalle. Solo cabrían agregados con cita: descartarlo y usar UCDP.
- **21 Email → ✅ M.** Brevo: 300 correos/día gratis, sin dominio propio (basta un remitente verificado).
  Registro en https://www.brevo.com · Secrets `BREVO_API_KEY` y `MAIL_TO` (el correo de Sergi, nunca en el repo).
  Resend (3.000/mes) obliga a tener un dominio propio verificado, así que no conviene.
- **5 CACS → ✅ M (antes ⚠).** Mejor sin clave nueva: SEC XBRL `companyfacts` (dominio público, ya hay
  `SEC_USER_AGENT`). Dividendo por acción (`CommonStockDividendsPerShareDeclared`), recompras
  (`PaymentsForRepurchaseOfCommonStock`) y splits por los 8-K. Es trimestral, no al día.
- **12 Correlaciones y 14 Señales técnicas → siguen ⚠.** Los planes gratuitos con clave (Alpha Vantage: 25
  consultas/día; Twelve Data: 800/día; Polygon/Massive: 5/min y cierre del día; FMP: 250/día; Tiingo: 1.000/día) son
  **para uso personal y prohíben mostrar o redistribuir los datos** en una web pública. Ninguno sirve.
  Se queda como estaba: 12 con series de FRED de dominio público (tipos, euro-dólar, petróleo de la EIA; ojo, el
  S&P 500 de FRED tiene copyright de S&P), y 14 con el máx./mín. de 52 semanas de Finnhub y el widget
  «technical-analysis» de TradingView para medias y RSI.
- **16 Aviones → ⚠ M.** OpenSky con cuenta gratis (cliente OAuth2, unos 4.000 créditos/día, frente a 400 sin cuenta).
  Licencia no comercial con cita; vale para una web personal. Registro en https://opensky-network.org · Secrets
  `OPENSKY_CLIENT_ID` y `OPENSKY_CLIENT_SECRET`. La pega que queda: puede bloquear las IP de nube (probe) y la
  privacidad (solo aviones de Estado o militares conocidos, sin seguir rutas). Alternativa sin clave: adsb.lol (ODbL).
- **22 VENTANAS**: sin cambios (✅ L, bloque D).

**Bloques para programar, sin choques**
- **A · Mercados (WS/ficha/FONDOS)**: 1, 2, 3, 4, 5, 13, 14. Datos: TradingView, Finnhub, SEC.
- **B · Datos y gráficos (ECO/WS)**: 6, 7, 10, 11, 12. Fuentes: Tesoro, BCE, FRED, NY Fed.
- **C · Interfaz (barra, layout, navegador)**: 8, 17, 18, 19, 20, 21. Va tras Prog Barra 3/4.
- **D · VENTANAS + DASH** (22 + 9), para una sola sesión: toca `pins.ts`, `prefs.ts` y una ruta nueva; no toca el
  layout de las vistas. Coordinar con C solo en `prefs.ts`.
- **E · Fuentes con clave nueva** (otra sesión): 15 (UCDP), 16 (OpenSky) y el email de la 21, cuando Sergi cree los
  Secrets. 16 solo si acepta la pega de privacidad.

## 2h. Lote F (Ideas 5, 15/10): funcionalidades nuevas para el uso diario y la familia. PROPUESTO

Fuentes de las ideas: Koyfin, OpenBB, Finviz, Revolut, Trade Republic, Yahoo Finance, Apple Stocks, Feedly, Ground News y
paneles OSINT, pensando en lo que usaría una familia. Comprobado por búsqueda web (15/10), sin probe: Open-Meteo con
polen (CAMS), DGT NAP DATEX II v3.7 (licencia libre, se actualiza cada minuto), Jolpica F1 (sin clave, unas 500
consultas por hora) y football-data.org (gratis con registro, 10 consultas por minuto, resultados con retraso). Todo lo
demás queda «a probar». Esfuerzo: S (horas), M (un PR) y L (varios PR). ★ = las 5 mejores.

**Bloque A · Casa y día a día (LUZ, WX, FUEL y una vista VIAJE): solo datos y vistas, sin tocar avisos**
- F1 ★ **LUZ: horas baratas**: las 3 mejores franjas de hoy y de mañana para la lavadora o el coche. Para todos. Usa
  el PVPC de REE, que ya se descarga. S.
- F2 ★ **WX: polen y UV**: abedul, gramíneas, olivo, aliso, ambrosía y artemisa en Tu sitio. Para alérgicos. Open-Meteo
  Air Quality (CAMS, sin clave, CC BY). S.
- F3 **FUEL: mi gasolinera**: una favorita por usuario con su historial y lo que ahorras frente a la media de la
  provincia. El historial ya existe. S.
- F4 **ES: tráfico**: cortes, obras y retenciones en las provincias que elijas. DGT NAP DATEX II v3.7 (no cubre
  Cataluña ni el País Vasco). M.
- F5 **VIAJE \<ciudad>**: tiempo a 7 días, cambio de moneda (BCE), aviso de viaje (`advisories`), festivos y hora
  local. Junta datos que ya hay. M.
- F6 **Puentes**: próximos festivos y puentes de España y del país de cada usuario (`holidays`, que ya se
  descarga). S.

**Bloque B · Dinero personal (vistas nuevas; los datos de cada usuario van en D1, privados)**
- F7 ★ **HIPOTECA**: cuota, cuadro de amortización y «tu próxima revisión» con el euríbor a 12 meses (BCE, ya está).
  Para la familia. S/M.
- F8 ★ **CARTERA**: posiciones con cantidad y precio de compra, ganancia o pérdida, y reparto por sector y divisa,
  guardadas en D1. Precios de Finnhub quote (ya se usa). M. *Duda*: fuera de EE. UU. no hay precio gratis.
- F9 **AHORRO**: dónde rinde hoy el dinero: última subasta de letras del Tesoro (tesoro.es, a probar), €STR,
  depósitos (BdE) y bonos. S/M.
- F10 **MI IPC**: tu inflación con los pesos de tu cesta (INE, IPC por grupos ECOICOP) frente a la general. M.
- F11 **Calculadoras**: interés compuesto y «cuánto valen hoy 1.000 € de 2005» (IPC del INE y HICP). S.
- F12 **Resultados de mis valores**: CAL filtrado por MIS o CARTERA, con recordatorio la víspera. S.

**Bloque C · Avisos y uso personal (`scripts/alerts/`, `cloud/`, AVISOS)**
- F13 ★ **Resumen matinal por ntfy** a la hora que elija cada uno: 5 titulares de IMP, mercados, el tiempo de su sitio
  y las horas baratas de la luz. M.
- F14 **Alertas de precio privadas**: «alerta NVDA > 150» guardada en D1 del usuario, en vez de en un issue público
  (como en D41). M.
- F15 **Mandar a la familia**: botón en un titular o un panel que lo envía por ntfy a otro usuario de Arc. M.
- F16 **Avisos de casa**: horas baratas mañana (F1), polen alto (F2) y la gasolinera favorita baja (F3). Llegan
  cuando A esté fusionado. S.
- F17 **Mis RSS** (como Feedly): cada usuario añade sus feeds; una Pages Function los lee con caché y con tope.
  Solo se guardan titulares y enlaces. M.

**Bloque D · Noticias, OSINT y deporte (fuentes y vistas nuevas)**
- F18 **Quién lo cuenta** (como Ground News): agrupa un mismo hecho contado por varios medios y muestra su cobertura
  por región, con los «ángulos muertos». Usa los titulares que ya hay. M.
- F19 **Por qué se mueve**: en la ficha de un valor, su variación junto a los titulares de 24 h (Finnhub
  company-news). S.
- F20 **DEP**: LaLiga, Champions y Mundial (football-data.org) y F1 (Jolpica, sin clave), con resultados,
  clasificación y calendario. M.
- F21 **GEO: rutas marítimas**: avisos de UKMTO y MARAD (Mar Rojo, Ormuz) junto a PORT. A probar. S/M.
- F22 **GEO: espacio aéreo en conflicto**: boletines CZIB de la EASA. A probar. S.
- F23 **GEO: crisis activas**: ReliefWeb de la OCHA (desastres e informes). M.
- F24 **Test de la semana**: 5 preguntas hechas con los datos y titulares de SEMANA, sin IA. Para la familia. S.

**Necesitan clave, registro o tienen duda de licencia**
- F20: token gratis de football-data.org (Secret `FOOTBALL_DATA_TOKEN`; uso no comercial). Jolpica no publica
  términos: confirmar.
- F23: ReliefWeb pide desde 2025 un `appname` aprobado (registro gratis).
- F8: no hay precios gratis fuera de EE. UU. (los widgets de TradingView no entregan datos). Opción: solo EE. UU., o
  precio puesto a mano.
- F9 y F21: confirmar los términos de tesoro.es, UKMTO y MARAD.
- F17: hace de proxy de RSS, así que hay que limitarla a usuarios de Access y poner tope de tamaño y de feeds.

**Choques**: A y B solo añaden vistas y fuentes. C toca `scripts/alerts/` y `cloud/` (F14 y F16 dependen de A y de
AVISOS). D añade fuentes y vistas nuevas; F18 lee `news` sin cambiarlo. Compruébalo con las sesiones Producto A–G
(bienvenida y modo sencillo) antes de repartir C.

## 2i. Modo Sencillo v2: APARCADO por Sergi (15/10)

Feedback de Sergi: el Sencillo actual queda «muy tonto». Lo quiere más bonito y más «web-like» (menos terminal),
**sin perder información**: no hay que simplificarlo en exceso. Hubo un primer intento como app aparte en `/app`
(pestañas, tarjetas con cifra grande y explicación, noticias como historias): rama `sencillo/app`, PR #431 cerrado
sin fusionar. Sirve de punto de partida si se retoma, pero con más densidad de datos.

## 3. Decisiones de Sergi que hay que respetar

- Arc Terminal es **mundial**: nada nuevo centrado en Menorca, salvo los puertos AIS de Maó y Ciutadella.
- **Sin licencia** en el repo (todos los derechos reservados). Stockfish va aparte, en `static/engine/`, con su GPL.
- Horas siempre en **hora de Madrid** al hablar con Sergi.
- **Traducción de titulares**: MyMemory (email de contacto en el Secret `MYMEMORY_EMAIL`) + traductor integrado de
  Chrome en el ordenador. DeepL no.
- **Tu sitio**: Madrid por defecto, localStorage + `?lugar=`, 1 principal y 5 favoritos.
- Claves ya en Secrets: FRED_API_KEY, FINNHUB_API_KEY, SEC_USER_AGENT (y HF_TOKEN opcional). EIA_API_KEY, en camino (D30).
- NTFY_TOPIC y la zona de las alertas, solo en Secrets.
- Descartadas: GDELT, el RSS de la CNMV, el RSS del Parlamento Europeo, el RSS de OFAC (retirado en 2025) y la
  agenda de la Comisión y Xinhua.

## 4. Cómo se trabaja

Cada idea dice si se ha comprobado en vivo y si limita por IP; lo que necesite clave, registro, dinero o datos
personales va aparte, como decisión. Ideas propone → Decisiones (ahora «Arc · Decisiones 2») se lo enseña a Sergi → lo aprobado va **solo a Coordinación**, que lo reparte. Las
sesiones de Mejora continua 1–4 mandan sus lotes a Ideas, que quita lo repetido y los pasa a Decisiones.
