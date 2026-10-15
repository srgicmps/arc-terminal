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
  agenda de la Comisión y Xinhua. ReliefWeb, aparcado (falta el appname).

## 4. Cómo se trabaja

Cada idea dice si se ha comprobado en vivo y si limita por IP; lo que necesite clave, registro, dinero o datos
personales va aparte, como decisión. Ideas propone → Decisiones (ahora «Arc · Decisiones 2») se lo enseña a Sergi → lo aprobado va **solo a Coordinación**, que lo reparte. Las
sesiones de Mejora continua 1–4 mandan sus lotes a Ideas, que quita lo repetido y los pasa a Decisiones.
