(function () {
  "use strict";
  var fmt = new Intl.NumberFormat("es-PE");
  var charts = {};

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function entries(dict) {
    return Object.keys(dict || {}).map(function (key) { return { label: key, data: dict[key] }; });
  }
  function chart(id) {
    var host = document.getElementById(id);
    if (!charts[id]) charts[id] = echarts.init(host);
    return charts[id];
  }
  // Se lee desde .page (no document.documentElement): .tema-alcohol
  // sobreescribe --header-green-1/--header-green-2 con el azul propio de
  // esta pestana, y ese cambio solo es visible leyendo desde .page.
  function cssVar(name) {
    var host = document.querySelector(".page") || document.documentElement;
    return getComputedStyle(host).getPropertyValue(name).trim();
  }
  function barRow(label, casos, pct, color, widthPct) {
    var row = document.createElement("div");
    row.className = "bar-row";
    var labelEl = document.createElement("div");
    labelEl.className = "bar-row-label";
    labelEl.textContent = label;
    var track = document.createElement("div");
    track.className = "bar-track";
    var fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = Math.max(widthPct, 1.5) + "%";
    fill.style.background = color;
    track.appendChild(fill);
    var value = document.createElement("div");
    value.className = "bar-row-value";
    value.textContent = fmt.format(casos) + " (" + pct.toFixed(1) + "%)";
    row.appendChild(labelEl);
    row.appendChild(track);
    row.appendChild(value);
    return row;
  }
  function card(title, body, extra) {
    return '<article class="card-window ' + (extra || "") + '"><div class="card-window-header">' +
      title + '</div><div class="card-window-body">' + body + '</div></article>';
  }
  function matrixTable(matrix) {
    var html = '<div class="alcohol-table-wrap"><table class="alcohol-table"><thead><tr><th>Categor&iacute;a</th>';
    matrix.columnas.forEach(function (col) { html += "<th>" + esc(col) + "</th>"; });
    html += "</tr></thead><tbody>";
    matrix.filas.forEach(function (fila, i) {
      html += "<tr><td>" + esc(fila) + "</td>";
      matrix.valores[i].forEach(function (valor) { html += "<td>" + fmt.format(valor) + "</td>"; });
      html += "</tr>";
    });
    return html + "</tbody></table></div>";
  }
  function bars(dict) {
    var items = entries(dict).sort(function (a, b) { return b.data.casos - a.data.casos; });
    var max = items.length ? items[0].data.casos : 1;
    return '<div class="alcohol-bars">' + items.map(function (item) {
      return '<div class="alcohol-bar"><span>' + esc(item.label) + '</span><div class="alcohol-bar-track"><div class="alcohol-bar-fill" style="width:' +
        (item.data.casos / max * 100) + '%"></div></div><strong>' + fmt.format(item.data.casos) + ' (' + item.data.pct + '%)</strong></div>';
    }).join("") + "</div>";
  }
  function yesValue(dict) {
    var match = entries(dict).filter(function (item) { return item.label.toLowerCase() === "si" || item.label.toLowerCase() === "sí"; })[0];
    return match ? match.data : { casos: 0, pct: 0 };
  }
  // Pictograma "relleno por porcentaje" (misma tecnica que main.js para las
  // pestanas hombres/mujeres): silueta en gris de fondo + copia recortada
  // (clip-path) en color de acento que sube desde los pies segun el pct.
  function buildPictogramSvg(rawSvg, colorVar, uid) {
    var vb = rawSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    var w = vb ? parseFloat(vb[1]) : 100;
    var h = vb ? parseFloat(vb[2]) : 100;
    var inner = rawSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
    var clipId = "pictoclip-alcohol-" + uid;
    var svg =
      '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet">' +
      "<defs><clipPath id=\"" + clipId + '"><rect class="picto-fill-rect" x="0" y="' + h + '" width="' + w + '" height="0"/></clipPath></defs>' +
      '<g style="color:var(--gridline)">' + inner + "</g>" +
      '<g style="color:' + colorVar + '" clip-path="url(#' + clipId + ')">' + inner + "</g>" +
      "</svg>";
    return { svg: svg, totalHeight: h };
  }

  function animarRelleno(rectEl, pct, totalHeight, duracionMs) {
    var targetH = (totalHeight * Math.max(0, Math.min(100, pct))) / 100;
    var inicio = null;
    function paso(timestamp) {
      if (!rectEl.isConnected) return;
      if (inicio === null) inicio = timestamp;
      var t = Math.min(1, (timestamp - inicio) / duracionMs);
      var ease = 1 - Math.pow(1 - t, 3);
      var h = targetH * ease;
      rectEl.setAttribute("y", totalHeight - h);
      rectEl.setAttribute("height", h);
      if (t < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  // Iconos por grupo de edad, uno por sexo -- mismas siluetas vectorizadas
  // que usan las pestanas hombres/mujeres (window.ICONS_SVG).
  var ICONOS_EDAD_SEXO = {
    Mujer: { "0 a 17 años": "nina", "18 a 59 años": "nina2", "60 a más años": "nina3" },
    Hombre: { "0 a 17 años": "nino", "18 a 59 años": "nino2", "60 a más años": "nino3" }
  };
  var COLOR_SEXO = { Mujer: "var(--series-pink)", Hombre: "var(--series-blue)" };
  var ORDEN_EDAD = ["0 a 17 años", "18 a 59 años", "60 a más años"];

  function renderSexAgePictogramas(matrix) {
    var host = document.getElementById("alcohol-sex-age-pictos");
    if (!host) return;
    host.innerHTML = "";
    ["Mujer", "Hombre"].forEach(function (sexo) {
      var filaIdx = matrix.filas.indexOf(sexo);
      if (filaIdx === -1) return;
      var valores = matrix.valores[filaIdx];
      // Denominador = suma de los 3 grupos etarios conocidos (excluye "Sin
      // informacion"), igual que data.edad en main.js -- asi el pct de cada
      // pictograma refleja la distribucion por edad dentro del sexo.
      var totalSexo = ORDEN_EDAD.reduce(function (acc, key) {
        return acc + valores[matrix.columnas.indexOf(key)];
      }, 0);

      var grupo = document.createElement("div");
      grupo.className = "alcohol-picto-group";
      var titulo = document.createElement("div");
      titulo.className = "alcohol-picto-group-label";
      titulo.textContent = sexo;
      grupo.appendChild(titulo);

      var fila = document.createElement("div");
      fila.className = "grid grid-3";
      ORDEN_EDAD.forEach(function (key, idx) {
        var colIdx = matrix.columnas.indexOf(key);
        var casos = valores[colIdx];
        var pct = totalSexo ? (casos / totalSexo) * 100 : 0;
        var nombreIcono = ICONOS_EDAD_SEXO[sexo][key];
        var rawSvg = nombreIcono && window.ICONS_SVG ? window.ICONS_SVG[nombreIcono] : null;
        if (!rawSvg) return;

        var tile = document.createElement("div");
        tile.className = "pictogram-tile";
        tile.innerHTML =
          '<div class="pictogram-icon"></div>' +
          '<div class="pictogram-pct">' + pct.toFixed(1) + "%</div>" +
          '<div class="pictogram-count">' + fmt.format(casos) + "</div>" +
          '<div class="pictogram-label">' + esc(key) + "</div>";
        fila.appendChild(tile);

        var iconHost = tile.querySelector(".pictogram-icon");
        var built = buildPictogramSvg(rawSvg, COLOR_SEXO[sexo], sexo + "-" + idx);
        iconHost.innerHTML = built.svg;
        var rectEl = iconHost.querySelector(".picto-fill-rect");
        animarRelleno(rectEl, pct, built.totalHeight, 900);
      });
      grupo.appendChild(fila);
      host.appendChild(grupo);
    });
  }
  function renderStateType(matrix) {
    var tipos = matrix.columnas.slice(0, -1);
    var estados = matrix.filas.slice(0, -1);
    chart("alcohol-state-type-chart").setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } }, legend: { bottom: 0 },
      grid: { left: 130, right: 20, top: 15, bottom: 65 },
      xAxis: { type: "value" }, yAxis: { type: "category", data: tipos },
      color: ["#174f91", "#2a78d6", "#8bbbef"],
      series: estados.map(function (estado, fila) {
        return { name: estado, type: "bar", stack: "total", data: tipos.map(function (_, col) { return matrix.valores[fila][col]; }) };
      })
    }, true);
  }
  // Mapa de calor por quintiles derivado del color de tema (mismo mecanismo
  // que el mapa de hombres/mujeres en main_v2.js): 5 tonos del acento de la
  // pestana activa, de claro a oscuro, en vez de una escala fija -- asi el
  // mapa de "Alcohol y drogas" queda en su propio azul (--header-green-1
  // aqui es azul, ver alcohol.css) sin tocar el verde/rosa de las otras
  // pestanas.
  function _hexARgb(hex) {
    hex = hex.replace("#", "");
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  }
  function _rgbAHex(r, g, b) {
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); var s = v.toString(16); return s.length < 2 ? "0" + s : s; }
    return "#" + h(r) + h(g) + h(b);
  }
  function _mezclarColor(hexA, hexB, t) {
    var a = _hexARgb(hexA), b = _hexARgb(hexB);
    return _rgbAHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function _paletaQuintiles(colorBase) {
    return [
      _mezclarColor(colorBase, "#ffffff", 0.82), _mezclarColor(colorBase, "#ffffff", 0.55),
      colorBase, _mezclarColor(colorBase, "#000000", 0.22), _mezclarColor(colorBase, "#000000", 0.45)
    ];
  }
  function _calcularQuintiles(valores) {
    var ordenados = valores.slice().sort(function (a, b) { return a - b; });
    function percentil(p) {
      var idx = (ordenados.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
      if (lo === hi) return ordenados[lo];
      return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (idx - lo);
    }
    return [percentil(0.2), percentil(0.4), percentil(0.6), percentil(0.8)].map(Math.round);
  }
  function _colorPorQuintil(valor, quintiles, paleta) {
    for (var i = 0; i < quintiles.length; i++) if (valor < quintiles[i]) return paleta[i];
    return paleta[paleta.length - 1];
  }
  function _renderLeyendaQuintiles(quintiles, maxVal, paleta) {
    var cortes = [0, quintiles[0], quintiles[1], quintiles[2], quintiles[3], maxVal];
    var host = document.getElementById("alcohol-map-legend-rows");
    if (!host) return;
    host.innerHTML = "";
    for (var i = 0; i < 5; i++) {
      var row = document.createElement("div");
      row.className = "map-legend-row";
      var texto = i < 4
        ? fmt.format(cortes[i]) + " a " + fmt.format(cortes[i + 1]) + " casos"
        : fmt.format(cortes[i]) + " a más casos";
      row.innerHTML = '<span class="map-legend-swatch" style="background:' + paleta[i] + '"></span>' + texto;
      host.appendChild(row);
    }
  }

  function renderMap(data) {
    if (!window.GEODATA_DEPT) return;
    window.GEODATA_DEPT.features.forEach(function (feature) { feature.properties.name = feature.properties.nombdep; });
    echarts.registerMap("PERU_ALCOHOL", window.GEODATA_DEPT);
    var valores = Object.keys(data.por_departamento).map(function (name) { return data.por_departamento[name].casos; });
    var maxVal = Math.max.apply(null, valores);
    var quintiles = _calcularQuintiles(valores);
    var paleta = _paletaQuintiles(cssVar("--header-green-1"));
    var entriesData = Object.keys(data.por_departamento).map(function (name) {
      var casos = data.por_departamento[name].casos;
      return { name: name, value: casos, itemStyle: { areaColor: _colorPorQuintil(casos, quintiles, paleta) } };
    });
    chart("alcohol-map-chart").setOption({
      tooltip: {
        trigger: "item",
        formatter: function (p) { return p.name + ": <strong>" + fmt.format(p.value || 0) + "</strong> casos"; }
      },
      series: [{
        type: "map", map: "PERU_ALCOHOL", roam: true, nameProperty: "nombdep", label: { show: false },
        emphasis: { label: { show: false }, itemStyle: { areaColor: cssVar("--series-violet") } },
        itemStyle: { borderColor: cssVar("--surface-1"), borderWidth: 1 },
        data: entriesData
      }]
    }, true);
    _renderLeyendaQuintiles(quintiles, maxVal, paleta);
    var mapChart = chart("alcohol-map-chart");
    window.renderMapLabels(mapChart, data.por_departamento, "alcohol");
    mapChart.on("georoam", function () { window.refreshMapLabels("alcohol"); });
  }

  function renderRegionBars(data) {
    var host = document.getElementById("alcohol-region-bars");
    if (!host) return;
    host.innerHTML = "";
    var regiones = entries(data.por_region).sort(function (a, b) { return b.data.casos - a.data.casos; });
    var max = regiones.length ? regiones[0].data.casos : 0;
    var color = cssVar("--header-green-2");
    regiones.forEach(function (r) {
      var width = max > 0 ? (r.data.casos / max) * 100 : 0;
      host.appendChild(barRow(r.label, r.data.casos, r.data.pct, color, width));
    });
  }

  function wireMapToggle(host) {
    host.querySelectorAll(".alcohol-map-toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        host.querySelectorAll(".alcohol-map-toggle-btn").forEach(function (b) { b.setAttribute("aria-selected", "false"); });
        btn.setAttribute("aria-selected", "true");
        var vista = btn.getAttribute("data-view");
        var mapView = document.getElementById("alcohol-map-view");
        var barsView = document.getElementById("alcohol-region-bars");
        mapView.hidden = vista !== "mapa";
        barsView.hidden = vista !== "barras";
        if (vista === "mapa" && charts["alcohol-map-chart"]) {
          charts["alcohol-map-chart"].resize();
          window.refreshMapLabels("alcohol");
        }
      });
    });
  }

  window.renderAlcohol = function (data) {
    var host = document.getElementById("alcohol-dashboard");
    if (!host || !data) return;
    Object.keys(charts).forEach(function (id) { charts[id].dispose(); });
    charts = {};
    var estado = entries(data.estado);
    var indicadores = [
      ["Discapacidad", data.indicadores.discapacidad], ["Persona extranjera", data.indicadores.extranjero],
      ["Trabajo remunerado", data.indicadores.trabaja], ["Primera vez que agrede", data.indicadores.primera_vez_agrede]
    ];
    host.innerHTML = '<p class="alcohol-intro"><strong>' + fmt.format(data.total) +
      '</strong> casos equivalentes al <strong>' + data.pct_base + '%</strong> de la base, con la presunta persona agresora bajo efectos de alcohol y/o drogas.</p>' +
      '<a class="alcohol-download" href="data/casos_tablas.xlsx" download>Descargar tablas en Excel</a>' +
      // El mapa fijo arriba-izquierda + la primera tarjeta a su costado
      // (mismo mecanismo de grid que usan las pestanas Hombres/Mujeres --
      // .theme-body-layout/.map-window/.theme-panel-top ya existen en
      // style_v2.css, aqui solo se reutilizan) -- asi el mapa queda en la
      // misma ubicaci&oacute;n en todas las pestanas.
      '<div class="theme-body-layout">' +
      '<div class="card-window map-window">' +
      '<div class="card-window-header"><span>Mapa por departamento</span>' +
      '<div class="view-toggle" role="tablist" aria-label="Vista del mapa">' +
      '<button type="button" class="view-toggle-btn alcohol-map-toggle-btn" data-view="mapa" aria-selected="true">Mapa</button>' +
      '<button type="button" class="view-toggle-btn alcohol-map-toggle-btn" data-view="barras" aria-selected="false">Barras</button>' +
      '</div></div>' +
      '<div class="card-window-body">' +
      '<div class="map-host-wrap" id="alcohol-map-view">' +
      '<div class="map-host" id="alcohol-map-chart"></div>' +
      '<div class="map-legend" id="alcohol-map-legend"><div class="map-legend-title">Casos</div><div class="map-legend-rows" id="alcohol-map-legend-rows"></div></div>' +
      '</div>' +
      '<div class="region-bars" id="alcohol-region-bars" hidden></div>' +
      '</div></div>' +
      '<div class="theme-panel-top">' +
      card("Sexo y grupo de edad de la presunta persona agresora", '<div id="alcohol-sex-age-pictos" class="alcohol-picto-row"></div>' + matrixTable(data.sexo_edad)) +
      '</div>' +
      '<div class="theme-panel-rest">' +
      '<div class="section-title">Resumen del estado de la persona agresora</div>' +
      '<div class="alcohol-summary">' + estado.map(function (item) {
        return card(esc(item.label), '<div class="alcohol-stat"><strong>' + fmt.format(item.data.casos) + '</strong><span>' + item.data.pct + '% de los casos</span></div>');
      }).join("") + '</div>' +
      '<div class="section-title">Caracter&iacute;sticas de la persona usuaria y del caso</div><div class="alcohol-grid">' +
      indicadores.map(function (item) { var yes = yesValue(item[1]); return card(item[0], '<div class="alcohol-stat"><strong>' + yes.pct + '%</strong><span>' + fmt.format(yes.casos) + ' casos con respuesta S&iacute;</span></div>' + bars(item[1])); }).join("") +
      card("Nivel de riesgo", bars(data.nivel_riesgo)) + card("V&iacute;nculo con la persona agresora", bars(data.vinculo_agresor)) +
      '</div><div class="section-title">Tipos de violencia</div><div class="alcohol-grid">' +
      card("Estado de la persona agresora por tipo de violencia", '<div id="alcohol-state-type-chart" class="alcohol-chart"></div>' + matrixTable(data.estado_tipo_violencia), "alcohol-wide") +
      '</div><div class="section-title">Evoluci&oacute;n mensual (2026)</div>' +
      '<div class="card-window">' +
      '<div class="card-window-header"><span>Casos por mes</span><div class="view-toggle" id="alcohol-historico-toggle"></div></div>' +
      '<div class="card-window-body"><div id="alcohol-historico-chart" class="alcohol-chart"></div></div>' +
      '</div>' +
      '<p class="alcohol-note">Los porcentajes utilizan como denominador los casos filtrados por alcohol y/o drogas.</p>' +
      '</div></div>';
    renderSexAgePictogramas(data.sexo_edad);
    renderStateType(data.estado_tipo_violencia);
    renderMap(data);
    renderRegionBars(data);
    wireMapToggle(host);
    window.renderHistoricoMensual({
      chartId: "alcohol-historico-chart", toggleHostId: "alcohol-historico-toggle",
      historico: data.historico_mensual, colorBase: cssVar("--header-green-2"),
    });
    setTimeout(function () { Object.keys(charts).forEach(function (id) { charts[id].resize(); }); }, 0);
  };
  window.resizeAlcoholCharts = function () {
    Object.keys(charts).forEach(function (id) { charts[id].resize(); });
    if (charts["alcohol-map-chart"]) window.refreshMapLabels("alcohol");
  };
  window.addEventListener("resize", window.resizeAlcoholCharts);
})();
