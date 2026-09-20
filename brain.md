# BRAIN — Memoria del proyecto

> Documento de contexto para agentes de IA.
> Debe mantenerse actualizado conforme evoluciona el proyecto.
>
> Última verificación contra el repositorio: 2026-09-19.

## 1. Resumen del proyecto

**Nombre:** Dashboard MIMP — casos atendidos por los Centros Emergencia Mujer y Familia (CEM).

El proyecto transforma un archivo local de IBM SPSS Statistics (`.sav`) con registros de casos en indicadores agregados, dashboards web estáticos y reportes Excel descargables. Facilita la consulta visual de las atenciones del CEM sin publicar filas originales ni depender de una API o backend.

Presenta perfiles de hombres y mujeres, además de tableros sobre alcohol/drogas, personas LGBTI, personas extranjeras y mujeres gestantes. La versión anterior permanece en `pagina/index_v2.html`; la nueva versión independiente, solicitada por el responsable, está en `pagina2/index.html`.

**Usuarios principales:** pendiente de verificar; el repositorio no define formalmente audiencias o roles.

**Estado:** dos versiones locales: `pagina/index_v2.html` y `pagina2/index.html`. El corte generado es enero-agosto de 2026, preliminar, con 120 168 registros: 20 286 hombres y 99 882 mujeres. `pagina2` ofrece 390 indicadores a partir de la revisión de 577 variables, filtros combinados y reportes PDF. No se ha desplegado esta nueva versión.

## 2. Objetivos

### Objetivo general

Publicar indicadores agregados del Registro de casos del CEM mediante dashboards estáticos y libros Excel, evitando exponer registros individuales.

### Objetivos específicos

1. Leer el corte SPSS local y normalizar metadatos con problemas de codificación.
2. Calcular indicadores por sexo, edad, violencia, riesgo, ubicación y atención.
3. Construir vistas temáticas para poblaciones o condiciones específicas.
4. Mostrar mapas, gráficos e históricos sin servicios externos en tiempo de ejecución.
5. Generar un informe Excel independiente para cada pestaña.
6. Mantener la fuente SPSS fuera de Git y publicar solo agregados.

## 3. Arquitectura general

```text
data/BD_Registro_casos_agosto_2026_SDP.sav
             (local, ignorado por Git)
                         ↓
             build_dashboard_data.py
          pandas + pyreadstat + openpyxl
                         ↓
       ┌─────────────────┴─────────────────┐
       ↓                                   ↓
pagina/data/casos_data.js       pagina/data/informe_*.xlsx
  window.CASOS_DATA                 seis libros
       ↓
HTML + CSS + JavaScript + ECharts + geodata.js + icons.js
       ↓
Dashboard estático ejecutado en el navegador
```

No hay backend, API, base de datos de aplicación, Docker, caché, autenticación ni orquestador. Datos, geodatos e iconos se cargan como variables globales JavaScript para permitir también el uso bajo `file://`.

## 4. Stack tecnológico

```text
Procesamiento:
- Python
- pandas
- pyreadstat
- openpyxl

Frontend:
- HTML5
- CSS
- JavaScript sin framework
- Apache ECharts 5.6.0, vendorizado localmente

Datos:
- IBM SPSS Statistics (.sav), fuente local
- JavaScript generado con agregados
- GeoJSON embebido en JavaScript
- Microsoft Excel (.xlsx)

Iconografía:
- Pillow
- vtracer
- SVG y PNG

Control de versiones/publicación:
- Git y GitHub
- Hosting estático; GitHub Pages está sugerido por el historial, pero su configuración y URL están pendientes de verificar
```

No existen `requirements.txt`, `pyproject.toml`, `package.json`, `Dockerfile`, archivos de CI ni manifiestos equivalentes.

## 5. Estructura del proyecto

```text
pictochart/
├── index.html                         redirección inmediata al dashboard
├── build_dashboard_data.py            ETL y generador de agregados/Excel
├── spss_to_df.py                      utilidad exploratoria para SPSS
├── vectorize_icons.py                 genera SVG e icons.js
├── .gitignore                         excluye SPSS, secretos y archivos locales
├── brain.md                           esta memoria central
├── docs/
│   └── Informe_tecnico_dashboard_CEM.docx
│                                        informe de ventajas y publicación
├── data/                              fuentes SPSS locales, ignoradas por Git
│   ├── BD_Registro_casos_junio_2026_SDP.sav
│   ├── BD_Registro_casos_julio_2026_SDP.sav
│   └── BD_Registro_casos_agosto_2026_SDP.sav
├── image/                             copias raster de pictogramas
└── pagina/
    ├── index_v2.html                  único dashboard vigente
    ├── css/
    │   ├── style_v2.css               tema/layout del dashboard
    │   └── {alcohol,lgtbi,extranjeras,gestantes}.css
    ├── js/
    │   ├── main_v2.js                 navegación, modales y render principal
    │   ├── {alcohol,lgtbi,extranjeras,gestantes}.js
    │   ├── historico_mensual.js       gráfico temporal reutilizable
    │   └── map_labels.js              etiquetas de mapa reutilizables
    ├── data/
    │   ├── casos_data.js              agregados generados
    │   ├── geodata.js                 geometría de 25 departamentos
    │   └── informe_<pestaña>.xlsx     seis informes generados
    ├── assets/icons/
    │   ├── raw/                       PNG fuente
    │   ├── *.svg                      versiones vectorizadas
    │   └── icons.js                   window.ICONS_SVG
    └── lib/echarts.min.js             Apache ECharts local
```

`.claude/` está ignorado y contiene estado local. `.vscode/` existe localmente, pero no está versionado. Ninguno integra la aplicación.

## 6. Flujo de datos

1. Se coloca el nuevo `.sav` en `data/` y se actualiza `RUTA_SAV` si cambia el nombre.
2. El ETL inspecciona metadatos para localizar la columna de orientación sexual que puede estar mal codificada.
3. `pyreadstat` carga solo `COLUMNAS`, con `encoding="latin1"`.
4. `_des_mojibake()` corrige etiquetas de variables y valores.
5. Se derivan `EXTRANJERO_REPORTE`, `ANIO` y `MES`.
6. Se filtran y agregan hombres, mujeres, alcohol/drogas, LGBTI, extranjeras y gestantes.
7. Se calculan conteos, porcentajes, matrices, rankings, históricos y detalles departamentales.
8. Se escribe `casos_data.js` como ASCII con escapes Unicode y sin filas crudas.
9. Se generan seis libros `informe_<pestaña>.xlsx`.
10. Los HTML cargan ECharts, geodatos, agregados, iconos y renderers locales.
11. `main_v2.js` renderiza la pestaña y enlaza su Excel.
12. Un corte nuevo requiere regenerar y volver a desplegar los artefactos.

**Frecuencia:** manual. Los comentarios indican repetirlo en cada corte, por ejemplo mensual, pero no hay programador.

**Fuente adicional:** `HISTORICO_ESTATICO` contiene cifras fijas de 2021-2025 ajenas al `.sav` actual. Su procedencia documental está pendiente de verificar.

## 7. Componentes principales

### ETL de dashboards

**Responsabilidad:** cargar SPSS, aplicar reglas, producir agregados y Excel.

**Archivos:** `build_dashboard_data.py`, `data/*.sav`, `pagina/data/casos_data.js`, `pagina/data/informe_*.xlsx`.

**Entradas:** `.sav` indicado por `RUTA_SAV`.

**Salidas:** `window.CASOS_DATA` y seis libros.

**Dependencias:** pandas, pyreadstat, openpyxl.

**Consideraciones:** las salidas son generadas; cambiar primero el ETL.

### Frontend

**Responsabilidad:** presentar perfiles, tableros temáticos, mapas, navegación, descargas, perfil de agresor, seguros, educación, etnia, lugar/ámbito, atención/seguimiento y modales departamentales.

**Archivos:** `pagina/index_v2.html`, `pagina/css/style_v2.css`, `pagina/js/main_v2.js` y módulos temáticos.

**Entradas:** `window.CASOS_DATA`, `window.GEODATA_DEPT`, `window.ICONS_SVG`.

**Salidas:** visualizaciones en navegador.

**Dependencias:** ECharts y scripts cargados antes del renderer principal.

**Consideraciones:** esta es la única versión vigente; `pagina/index.html`, `pagina/js/main.js` y `pagina/css/style.css` fueron retirados.

### Dashboards temáticos

**Responsabilidad:** renderizar alcohol/drogas, LGBTI, extranjeras y gestantes.

**Archivos:** pares CSS/JS temáticos, `historico_mensual.js`, `map_labels.js`.

**Entradas:** bloque temático de `window.CASOS_DATA`.

**Salidas:** indicadores, distribuciones, mapa, regiones e histórico mensual.

**Dependencias:** ECharts, geodatos y helpers globales.

### Cartografía

**Responsabilidad:** mostrar conteos y etiquetas por departamento.

**Archivos:** `geodata.js`, `map_labels.js` y renderers.

**Entradas:** 25 geometrías con `nombdep` y `por_departamento`.

**Salidas:** mapas por quintiles, leyenda, etiquetas, zoom/pan.

**Consideraciones:** `DPTO_UBI_CEM` alimenta 25 departamentos; `REGION_UBI_CEM` produce 26 categorías al separar Lima Metropolitana y Lima Provincia.

### Iconografía

**Responsabilidad:** convertir raster a SVG y empaquetar iconos.

**Archivos:** `vectorize_icons.py`, `pagina/assets/icons/**`.

**Entradas:** PNG/JPG/BMP.

**Salidas:** SVG y `window.ICONS_SVG`.

**Dependencias:** Pillow y vtracer.

## 8. Reglas de negocio

- Publicar solo agregados; nunca filas, identificadores personales ni `.sav`.
- Hombres: `SEXO_VICTIMA == 1`; mujeres: `SEXO_VICTIMA == 0`.
- `EXTRANJERO_REPORTE`: `VICTIMA_EXTRANJERA == 1 AND VICTIMA_PERUANA == 0`.
- Alcohol/drogas: `ESTADO_AGRESOR_U_A` en 2, 3 o 4.
- LGBTI: `CASOS_PERSONAS_LGBTI == 1`.
- Extranjeras: `CASOS_PERSONAS_EXTRANJERAS == 1`.
- Gestantes: `VICTIMA_GESTANDO == 1`; el código asume que implica mujer.
- Una bandera cuenta como “Sí” únicamente con valor 1.
- Porcentajes: un decimal sobre el subconjunto activo; `pct_base` usa el total general.
- Históricos mensuales: filas del `.sav` activo.
- Histórico anual 2021-2025: `HISTORICO_ESTATICO`; 2026: archivo activo.
- LGBTI y gestantes limitan cruces mensuales por muestra pequeña o sexo constante, según comentarios.
- `por_departamento` debe coincidir con `nombdep` de `geodata.js`.
- Cada pestaña descarga `data/informe_<clave>.xlsx` y no mezcla otras pestañas.

## 9. Convenciones del proyecto

```text
Idioma: español
Python: snake_case
Constantes Python: MAYUSCULAS_CON_GUION_BAJO
JavaScript: camelCase; claves del payload en snake_case
HTML/CSS IDs y clases: kebab-case
Fechas derivadas: ANIO y MES YYYY-MM
Porcentajes: un decimal
Rama principal: main
```

- JavaScript propio encapsulado en IIFE; APIs compartidas mediante `window.*`.
- `casos_data.js` es ASCII con caracteres escapados como `\uXXXX`.
- Temas mediante variables CSS, variantes por población y modo oscuro.
- Orden de scripts: librería/datos/helpers antes del renderer.
- Regenerar `casos_data.js`, Excel, `icons.js` y SVG desde sus scripts; no editarlos manualmente.
- No hay convención formal de branches o commits.

## 10. Decisiones técnicas importantes

### DEC-001 — Sitio estático sin API

**Decisión:** ejecutar el dashboard en el navegador y consumir archivos locales.
**Motivo:** no requerir backend para visualizar agregados.
**Archivos afectados:** `pagina/**`.
**Estado:** vigente.

### DEC-002 — Publicar solo agregados

**Decisión:** el navegador no recibe filas originales.
**Motivo:** reducir exposición y tamaño del artefacto.
**Archivos afectados:** `build_dashboard_data.py`, `casos_data.js`.
**Estado:** vigente.

### DEC-003 — Variables globales en vez de fetch

**Decisión:** usar `window.CASOS_DATA`, `window.GEODATA_DEPT` y `window.ICONS_SVG`.
**Motivo:** funcionar en hosting estático y `file://`.
**Archivos afectados:** generadores, HTML y JS.
**Estado:** vigente.

### DEC-004 — Mantener v1 y v2 en paralelo

**Decisión:** conservar una versión principal y una ampliada de prueba.
**Motivo:** introducir indicadores sin sustituir la vista principal.
**Archivos afectados:** HTML, `main*.js`, estilos.
**Estado:** reemplazada por DEC-007.

### DEC-005 — Un Excel por pestaña

**Decisión:** cada tablero descarga su propio libro.
**Motivo:** correspondencia entre vista e informe.
**Archivos afectados:** ETL, HTML, renderers y Excel.
**Estado:** vigente.

### DEC-006 — Unicode escapado

**Decisión:** escribir `casos_data.js` como ASCII con escapes Unicode.
**Motivo:** no depender del charset del servidor.
**Archivos afectados:** ETL y payload.
**Estado:** vigente.

### DEC-007 — Conservar únicamente index_v2.html

**Decisión:** retirar la versión v1 y mantener `pagina/index_v2.html` como único dashboard.
**Motivo:** decisión explícita del responsable del proyecto para evitar mantener dos versiones.
**Archivos afectados:** `index.html`, `pagina/index_v2.html`, `pagina/index.html`, `pagina/js/main.js`, `pagina/css/style.css` y documentación.
**Estado:** reemplazada por DEC-009, por solicitud explícita del responsable el 2026-09-19.

### DEC-008 — Abrir el dashboard desde la raíz

**Decisión:** `index.html` redirige inmediatamente a `pagina/index_v2.html` mediante JavaScript y `meta refresh`.
**Motivo:** la URL raíz debe abrir el dashboard sin una pantalla intermedia.
**Archivos afectados:** `index.html`.
**Estado:** vigente.

## 11. Funcionalidades implementadas

### Nueva versión pagina2 (DEC-009)

- 390 indicadores agregados en nueve rubros, más panorama, evolución temporal y catálogo con búsqueda.
- Revisión documentada de las 577 variables; 187 campos tratados como filtros derivados o no publicados (texto libre, identificadores, fechas exactas o campos sin categorías verificadas).
- Filtros combinables de mes de ingreso y departamento de atención; una población por vez para evitar sumar grupos solapados.
- Siluetas originales, mapa, gráficos, tablas completas y descarga CSV por indicador.
- PDF con filtros, cifras, siluetas, gráfico mensual e interpretaciones descriptivas: resumen, sección/búsqueda o todos los indicadores.
- Generador independiente `build_pagina2_data.py`; motor compartido `pagina2/js/engine.js`; PDF local con jsPDF 4.2.1.
- Comprobaciones de 28 selecciones contra SPSS, cinco relaciones entre preguntas condicionadas y seis totales de poblaciones contra la versión anterior.
- Pruebas de navegador en cinco tamaños, sin solicitudes externas ni errores JavaScript; PDF filtrado, sin casos y completo, más CSV.
- Diccionario y resultados del ETL en `pagina2/data/`; evidencias temporales de navegador/PDF en `tmp/pagina2/`, excluidas de Git.

### DEC-009 — Versión independiente pagina2

**Decisión:** crear `pagina2/index.html` con `data/data.js`, CSS, JS y dependencias locales, conservando las siluetas. La raíz continúa abriendo la versión anterior.
**Motivo:** solicitud expresa de otro dashboard inspirado en `K:\_OMAR\PY\dashboard_ftp_def`, con más rubros y descarga de reportes según filtros.
**Datos:** cubos de frecuencias por población, mes de ingreso y departamento del CEM. No se incluyen filas individuales ni textos narrativos. El mismo motor calcula tarjetas, tablas, interpretaciones y PDF.
**Porcentajes:** se diferencian los calculados sobre la selección y sobre respuestas registradas. Los vacíos no se convierten en No.
**Estado:** implementada y validada localmente. Guía de uso en `pagina2/README.md`. Reemplaza DEC-007.

### Versión anterior

- [x] Lectura selectiva y etiquetado del SPSS.
- [x] Reparación de mojibake.
- [x] Agregados de hombres y mujeres.
- [x] Tableros de alcohol/drogas, LGBTI, extranjeras y gestantes.
- [x] Mapas con quintiles, etiquetas, zoom y vista alternativa.
- [x] Históricos anuales y mensuales.
- [x] Modales de detalle departamental en v2 para hombres/mujeres.
- [x] Seis libros Excel independientes.
- [x] Redirección directa desde `index.html` hacia `pagina/index_v2.html`.
- [x] Retiro de la versión v1 y sus recursos exclusivos.
- [x] Diseño adaptable y modo oscuro.
- [x] Iconos SVG empaquetados.
- [x] Informe técnico para sustentar la automatización y publicación institucional.
- [ ] Manifiesto reproducible de dependencias.
- [ ] Pruebas automatizadas.
- [ ] Automatización de actualización/publicación.
- [ ] API o autoload; confirmar si son requisitos.

## 12. Estado actual

```text
Último trabajo realizado:
Creación del informe técnico sobre ventajas, automatización y requisitos de publicación mediante SFTP o FTP y WordPress (2026-09-18).

Actualmente funcionando:
La raíz abre directamente el dashboard único en `pagina/index_v2.html`; funcionan seis pestañas, mapas, históricos, modales y seis Excel.

Documentación disponible:
`docs/Informe_tecnico_dashboard_CEM.docx` contiene el diagnóstico del proceso manual, ventajas, requerimientos, flujo operativo, controles, riesgos y plan de implementación.

Actualmente en desarrollo:
No hay una tarea de código activa identificada.

Último archivo modificado:
brain.md

Problema actual:
Las dependencias siguen sin manifiesto reproducible; `vtracer` no está instalado en el entorno auditado, aunque no es necesario para ejecutar el ETL del dashboard.

Siguiente acción recomendada:
Crear un manifiesto de dependencias con las versiones verificadas y añadir pruebas automáticas de totales y estructura del payload.
```

| Elemento publicado | Valor |
| --- | ---: |
| Filas fuente | 120 168 |
| Hombres | 20 286 |
| Mujeres | 99 882 |
| Alcohol/drogas | 33 381 |
| LGBTI | 108 |
| Extranjeras | 2 040 |
| Gestantes | 2 878 |
| Geometrías | 25 |
| Informes Excel | 6 |

El 2026-09-18 se ejecutó correctamente el ETL sobre `BD_Registro_casos_agosto_2026_SDP.sav`. Se verificaron la suma hombres + mujeres, cobertura mensual enero-agosto, fuente registrada, compilación de tres scripts Python, sintaxis de siete módulos JS y hojas/subtítulos de los seis Excel.

## 13. Problemas conocidos

### ISSUE-001 — Dependencias no declaradas

**Descripción:** no hay manifiesto reproducible.
**Causa:** dependencias expresadas solo mediante imports.
**Archivos:** scripts Python y raíz.
**Solución temporal:** instalación manual en entorno aislado.
**Solución pendiente:** fijar versiones verificadas y documentar instalación.
**Estado:** abierto; están pandas, openpyxl, Pillow y pyreadstat 1.3.6. Falta vtracer y siguen sin fijarse versiones en el repositorio.

### ISSUE-002 — Columnas SPSS dañadas

**Descripción:** algunos nombres/etiquetas están mal codificados; ciertos subactos se excluyen para evitar `KeyError`.
**Causa:** codificación de la fuente; comentarios citan `PU\x91ETAZOS`.
**Archivos:** ETL, explorador y `.sav`.
**Solución temporal:** mantener reparación, detección dinámica y exclusiones.
**Solución pendiente:** inventariar nombres crudos por corte y probar normalización.
**Estado:** abierto / limitación conocida.

### ISSUE-003 — Sin pruebas automatizadas

**Descripción:** no hay tests ni CI.
**Causa:** no existen archivos de pruebas/automatización.
**Archivos:** proyecto completo.
**Solución temporal:** validar sintaxis, totales, estructura, Excel, rutas y vistas manualmente.
**Solución pendiente:** pruebas unitarias y smoke test frontend.
**Estado:** abierto.

### ISSUE-004 — Despliegue no comprobado

**Descripción:** GitHub Pages está sugerido, pero no hay workflow, configuración ni URL versionados.
**Causa:** posible configuración externa en GitHub.
**Archivos:** repositorio remoto/configuración externa.
**Solución temporal:** tratarlo como sitio estático.
**Solución pendiente:** documentar URL, origen publicado y procedimiento.
**Estado:** en análisis.

## 14. Soluciones importantes

### SOL-001 — Reparación de mojibake

**Problema:** etiquetas SPSS mal codificadas.
**Solución:** lectura `latin1` y `_des_mojibake()`.
**Comandos:** no aplica.
**Archivos:** ETL y explorador.
**Consideración:** no retirar sin probar el `.sav` real.

### SOL-002 — Orientación sexual dinámica

**Problema:** nombre crudo corrupto.
**Solución:** inspección de metadatos y renombre interno a `ORIENTACION_SEXUAL_VICTIMA`.
**Archivos:** ETL.
**Consideración:** validar en cada corte.

### SOL-003 — Bundle SVG compatible con file://

**Problema:** carga individual de SVG.
**Solución:** empaquetar en `window.ICONS_SVG`.
**Comando:** `python vectorize_icons.py`.
**Archivos:** generador, SVG e `icons.js`.
**Consideración:** revisión visual tras regenerar.

### SOL-004 — Informes por tablero

**Problema:** descarga combinada no específica.
**Solución:** seis `.xlsx` y enlace dinámico.
**Comando:** `python build_dashboard_data.py`.
**Archivos:** ETL, HTML, renderers y Excel.
**Consideración:** preservar `informe_<clave>.xlsx`.

## 15. Dependencias importantes

```text
pandas      transformación/agregación
pyreadstat 1.3.6 lectura SPSS; versión del entorno auditado, aún no fijada en un manifiesto
openpyxl    generación/formato Excel
Pillow      tratamiento de imágenes
vtracer     vectorización SVG
ECharts 5.6.0 visualizaciones, vendorizado localmente
```

Versiones Python: pendiente de verificar y fijar. No hay dependencias frontend remotas en ejecución.

## 16. Variables de entorno y configuración

No se usan variables de entorno.

```text
RUTA_SAV           fuente SPSS activa
SALIDA_JS          destino de window.CASOS_DATA
CARPETA_INFORMES   destino de los Excel
TEMA_INFORME       colores/títulos de libros
HISTORICO_ESTATICO cifras fijas 2021-2025
COLUMNAS           selección del ETL
```

`.env` está ignorado, pero no hay `.env.example` ni código que lo consuma. Nunca guardar aquí contraseñas, tokens, API keys, claves privadas, secretos o credenciales reales.

## 17. Infraestructura y ejecución

```text
Desarrollo observado: Windows / PowerShell
Backend, servicios, puertos, Docker, API, caché: no existen
Orquestador, cron, Kestra, autoload: no implementados
Frontend: archivos estáticos
Remoto: https://github.com/zhandrixita/mimp.git
Rama: main
Hosting: GitHub Pages sugerido, pendiente de verificar
```

El frontend puede abrirse desde `index.html`; un servidor HTTP local es opcional, pero no existe comando/puerto oficial.

## 18. Comandos frecuentes

```powershell
git status --short --branch
python -m py_compile build_dashboard_data.py spss_to_df.py vectorize_icons.py
Get-ChildItem .\pagina\js\*.js | ForEach-Object { node --check $_.FullName }

# Sobrescribe artefactos; requiere fuente y dependencias completas
python build_dashboard_data.py

python spss_to_df.py
python vectorize_icons.py
```

Para ver: abrir `index.html` o `pagina/index_v2.html`. Despliegue oficial: pendiente de verificar.

## 19. Archivos que NO deben modificarse

No modificar manualmente salvo necesidad comprobada:

- `data/*.sav`: fuente sensible/grande; no versionar ni publicar sin autorización.
- `casos_data.js` e `informe_*.xlsx`: generados por el ETL; cambiar el generador primero.
- `icons.js` y SVG: generados por `vectorize_icons.py`.
- `geodata.js`: contrato geográfico de todos los mapas.
- `echarts.min.js`: dependencia; actualizar solo con pruebas.
- `HISTORICO_ESTATICO`: requiere fuente oficial confirmada.
- `.gitignore`: protege fuentes, secretos y archivos locales.

No cambiar claves de datos, pestañas, Excel u orden de scripts sin actualizar consumidores. La segunda versión autorizada se rige por DEC-009, que reemplaza DEC-007.

## 20. Pendientes

### Alta prioridad

- [ ] Crear manifiesto de dependencias con versiones comprobadas.
- [ ] Inventariar nombres SPSS dañados y subactos excluidos.

### Media prioridad

- [ ] Probar filtros, porcentajes, históricos, geografía y payload.
- [ ] Añadir smoke test del dashboard y sus seis pestañas.
- [ ] Confirmar/documentar GitHub Pages.
- [ ] Confirmar si autoload, API o automatización son requisitos.

### Baja prioridad

- [ ] Crear README que apunte a `brain.md`.
- [ ] Documentar procedencia del histórico 2021-2025.
- [ ] Evaluar PNG duplicados en `image/` y `assets/icons/raw/`.

## 21. Próximos pasos

1. Crear entorno Python aislado y manifiesto con versiones.
2. Fijar `pyreadstat 1.3.6` y las demás versiones verificadas en el manifiesto.
3. Añadir pruebas automáticas de reglas, totales y estructura del payload.
4. Probar el dashboard actualizado en escritorio y móvil.
5. Confirmar el mecanismo de despliegue.
6. Instalar `vtracer` solo cuando sea necesario regenerar iconos.

## 22. Historial de cambios relevantes

### 2026-09-19

- Se implementó `pagina2` como dashboard estático independiente con 390 indicadores, siluetas, filtros combinados, catálogo y PDF según la selección.
- Se creó el generador `build_pagina2_data.py`, el diccionario de las 577 variables y el informe de validación de agregados.
- Se recuperaron nombres de variables con codificación dañada, incluidos subactos y factores antes omitidos, mediante normalización comprobada sin colisiones.
- Se verificaron las preguntas condicionadas de frecuencia, denuncias anteriores, estudios, ocupación y gestación, sin registros fuera de condición ni respuestas faltantes dentro de sus universos comprobados.
- Se añadieron pruebas de motor y navegador; los reportes se revisaron mediante extracción de texto y renderizado PDF. La versión anterior y la redirección raíz se conservaron.

### 2026-09-18

- Se creó `docs/Informe_tecnico_dashboard_CEM.docx` para sustentar la automatización y publicación del dashboard mediante SFTP o FTP y WordPress.
- Se actualizó la fuente activa a `BD_Registro_casos_agosto_2026_SDP.sav` y el período visible a enero-agosto de 2026.
- Se regeneraron `casos_data.js` y los seis informes Excel; el nuevo total es 120 168 casos.
- Se validaron 20 286 hombres, 99 882 mujeres, 33 381 casos de alcohol/drogas, 108 LGBTI, 2 040 extranjeras y 2 878 gestantes.
- Se instaló `pyreadstat 1.3.6` en el entorno de trabajo para ejecutar el ETL.
- Se retiró la versión v1 (`pagina/index.html`, `main.js` y `style.css`) y `index_v2.html` quedó como único dashboard.
- Se configuró la raíz para abrir directamente `pagina/index_v2.html` y se eliminó la etiqueta visible de versión de prueba.
- Se auditó el repositorio y normalizó `brain.md` como memoria central.
- Se confirmaron la estructura de seis tableros, 25 geometrías y seis Excel.
- Se validaron compilación Python, sintaxis JS y hojas Excel.
- Se confirmó ECharts 5.6.0.
- Se documentó inicialmente la ausencia de dependencias; después se instaló `pyreadstat` para procesar agosto.

### 2026-08-18

- Se sustituyó el libro combinado por seis informes independientes.
- Se agregó descarga dinámica por pestaña.
- Se incorporaron cuatro dashboards temáticos, histórico mensual y etiquetas de mapa.

### 2026-08-17

- Se actualizó la fuente al corte de julio de 2026.
- Se incorporó inicialmente una salida Excel.

### 2026-07-17

- Se creó v2 con indicadores adicionales.
- Se agregó la portada raíz con enlaces a ambas versiones.
- Se preparó la estructura para publicación estática.

## 23. Instrucciones para agentes de IA

1. Leer completamente `brain.md` antes de cambios importantes.
2. Examinar código/configuración reales antes de asumir.
3. Prioridad: código/configuración, evidencia del repositorio, `brain.md`, historial del chat.
4. No inventar archivos, funciones, tablas, columnas, rutas, endpoints o requisitos.
5. Buscar referencias existentes antes de crear implementaciones.
6. Respetar arquitectura y `DEC-*` salvo razón técnica explícita.
7. Mantener compatibilidad con el dashboard vigente y sus módulos temáticos.
8. No tocar componentes no relacionados ni eliminar código sin revisar dependencias.
9. Tratar `.sav` como fuente sensible, local y no publicable.
10. Modificar generadores antes que artefactos derivados.
11. No introducir secretos ni datos personales.
12. Validar sintaxis, reglas, datos, Excel y UI según el riesgo.
13. Actualizar solo las secciones afectadas de `brain.md` tras cambios relevantes.
14. Conservar decisiones/soluciones; si una decisión cambia, crear otra y marcar la anterior `reemplazada por DEC-XXX`.
15. Escribir **Pendiente de verificar** cuando no haya evidencia suficiente.

### Protocolo de actualización

Después de cada tarea, comprobar cambios en:

```text
arquitectura | archivos | rutas | dependencias | reglas de negocio
funcionalidades | problemas | soluciones | decisiones
infraestructura | flujo de datos | estado | siguiente paso
```

Si algo cambió, actualizar solo las secciones correspondientes. Registrar en el historial únicamente evolución útil; no copiar logs, código extenso, conversaciones ni razonamientos internos.
