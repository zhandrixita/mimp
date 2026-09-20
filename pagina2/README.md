# Observatorio de casos CEM - pagina2

Abrir `index.html` directamente en Chrome o Edge. También funciona como sitio
estático: no requiere servidor de datos ni conexión a internet durante el uso.
La versión anterior sigue en `../pagina/index_v2.html`.

## Actualizar el corte

Desde la raíz del proyecto:

```powershell
python build_pagina2_data.py
```

Dependencias del generador: Python, pandas, numpy y pyreadstat. El generador crea
`data/data.js`, `data/diccionario_variables.csv` y `data/validacion.json`.
No editar los archivos generados a mano. La fuente `.sav` permanece local.

## Filtros y cobertura

- Población (una por vez), mes de ingreso (un mes o todo el periodo) y departamentos de atención (multiselección).
- Al abrir o restablecer el dashboard se selecciona el último mes disponible del corte.
- Los filtros se aplican al pulsar **Aplicar filtros**; las tarjetas, tablas,
  interpretaciones y PDF usan el mismo cálculo (`js/engine.js`).
- El mapa permite seleccionar un departamento. Restablecer recupera todo el corte.
- La búsqueda encuentra indicadores en todos los rubros. Cada tarjeta abre la
  tabla completa, un comentario descriptivo, sus denominadores y descarga CSV.
- El catálogo publica todas las categorías de 390 indicadores; el diccionario
  documenta la decisión para las 577 variables de origen.
- Los campos libres, identificadores, fechas exactas y campos sin categorías
  verificadas no se publican. Esto incluye los motivos narrativos para no denunciar.
- Los conteos son casos registrados, no personas únicas. Las poblaciones se
  solapan: nunca se suman entre sí.
- Los vacíos se conservan como «Sin registro / no aplicable». Las marcas afirmativas
  sin respuesta negativa registrada no permiten interpretar un vacío como «No».

## Reportes

**Descargar reporte** genera un PDF real en el navegador, sin servicios externos.
Permite elegir resumen ejecutivo, sección/búsqueda actual o todos los indicadores.
Incluye filtros, totales, siluetas, evolución mensual, tabla territorial,
interpretaciones, todas las categorías de cada indicador y notas metodológicas.
El informe completo puede ocupar muchas páginas. Los CSV se descargan en el
detalle de cada indicador.

## Verificación

El generador comprueba que cada distribución suma el total de su cubo, contrasta
los seis totales de población con la versión anterior del mismo corte y prueba
28 selecciones reproducibles contra los registros SPSS para todos los indicadores.
También comprueba cinco relaciones entre preguntas condicionadas y sus variables
de entrada. Resultados en `data/validacion.json`.

Pruebas reproducibles desde la raíz:

```powershell
node tests/test_pagina2_engine.cjs
python tests/check_pagina2_browser.py
python tests/check_pagina2_pdf.py
```

Las pruebas de navegador requieren `playwright` y Microsoft Edge; la revisión PDF
requiere `PyMuPDF` y `Pillow`. Son dependencias de desarrollo, no del dashboard.
Las capturas, PDF de prueba y resultados se guardan en `tmp/pagina2/`.

El histórico 2021-2025 conserva las cifras de la versión anterior, cuya fuente
documental está pendiente de verificar. Solo se muestra a nivel nacional para
total, hombres y mujeres sin filtros de meses o departamentos; 2026 es parcial.
No se calcula una variación contra años completos ni se incluye ese histórico
como resultado filtrado en el reporte.

## Dependencias de navegador

- Apache ECharts 5.6.0: copia local de la dependencia de `pagina`.
- jsPDF 4.2.1: [proyecto oficial](https://github.com/parallax/jsPDF/releases/tag/v4.2.1),
  copia local UMD; licencia en `lib/LICENSE.jspdf.txt`.
- Siluetas SVG y geodatos: recursos existentes del proyecto.

No hay solicitudes a CDNs, APIs ni servicios de IA durante el uso del dashboard.
