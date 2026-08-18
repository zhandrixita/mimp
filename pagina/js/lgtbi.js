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
  // Se lee desde .page (no document.documentElement): .tema-lgtbi
  // sobreescribe --header-green-1/--header-green-2 con el morado propio de
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
  function bars(dict) {
    var items = entries(dict).sort(function (a, b) { return b.data.casos - a.data.casos; });
    var max = items.length ? items[0].data.casos : 1;
    return '<div class="lgtbi-bars">' + items.map(function (item) {
      return '<div class="lgtbi-bar"><span>' + esc(item.label) + '</span><div class="lgtbi-bar-track"><div class="lgtbi-bar-fill" style="width:' +
        (item.data.casos / max * 100) + '%"></div></div><strong>' + fmt.format(item.data.casos) + ' (' + item.data.pct + '%)</strong></div>';
    }).join("") + "</div>";
  }
  function yesValue(dict) {
    var match = entries(dict).filter(function (item) { return item.label.toLowerCase() === "si" || item.label.toLowerCase() === "sí"; })[0];
    return match ? match.data : { casos: 0, pct: 0 };
  }

  // Pictograma "relleno por porcentaje" (misma tecnica que main.js/alcohol.js):
  // silueta en gris de fondo + copia recortada (clip-path) en color de acento
  // que sube desde los pies segun el pct.
  function buildPictogramSvg(rawSvg, colorVar, uid) {
    var vb = rawSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    var w = vb ? parseFloat(vb[1]) : 100;
    var h = vb ? parseFloat(vb[2]) : 100;
    var inner = rawSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
    var clipId = "pictoclip-lgtbi-" + uid;
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

  // Pictograma de un solo sexo (a diferencia del combinado de alcohol.js) --
  // cada seccion Hombres/Mujeres ya esta separada, asi que aqui solo hace
  // falta una fila de siluetas por grupo de edad.
  function renderEdadPictogramasSexo(hostId, edad, sexo) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = "";
    ORDEN_EDAD.forEach(function (key, idx) {
      var d = edad[key];
      if (!d) return;
      var nombreIcono = ICONOS_EDAD_SEXO[sexo][key];
      var rawSvg = nombreIcono && window.ICONS_SVG ? window.ICONS_SVG[nombreIcono] : null;
      if (!rawSvg) return;

      var tile = document.createElement("div");
      tile.className = "pictogram-tile";
      tile.innerHTML =
        '<div class="pictogram-icon"></div>' +
        '<div class="pictogram-pct">' + d.pct.toFixed(1) + "%</div>" +
        '<div class="pictogram-count">' + fmt.format(d.casos) + "</div>" +
        '<div class="pictogram-label">' + esc(key) + "</div>";
      host.appendChild(tile);

      var iconHost = tile.querySelector(".pictogram-icon");
      var built = buildPictogramSvg(rawSvg, COLOR_SEXO[sexo], hostId + "-" + idx);
      iconHost.innerHTML = built.svg;
      var rectEl = iconHost.querySelector(".picto-fill-rect");
      animarRelleno(rectEl, d.pct, built.totalHeight, 900);
    });
  }

  // Bloque completo (titulo + tarjetas) para una de las 2 secciones
  // Hombres/Mujeres -- misma informacion que antes se mostraba mezclada,
  // ahora separada por sexo.
  function bloqueSexo(etiqueta, sexo, d, idPrefix) {
    var pictoHostId = "lgtbi-edad-pictos-" + idPrefix;
    var indicadores = [
      ["Discapacidad", d.indicadores.discapacidad],
      ["Persona extranjera", d.indicadores.extranjero],
      ["Trabajo remunerado", d.indicadores.trabaja]
    ];
    return {
      pictoHostId: pictoHostId,
      edad: d.edad,
      sexo: sexo,
      html:
        '<div class="section-title">' + esc(etiqueta) + ' <small>(' + fmt.format(d.total) + ' casos &middot; ' + d.pct_del_total + '% del total)</small></div>' +
        '<div class="lgtbi-grid">' +
        card("Grupo de edad", '<div id="' + pictoHostId + '" class="grid grid-3"></div>') +
        indicadores.map(function (item) { var yes = yesValue(item[1]); return card(item[0], '<div class="lgtbi-stat"><strong>' + yes.pct + '%</strong><span>' + fmt.format(yes.casos) + ' casos con respuesta S&iacute;</span></div>' + bars(item[1])); }).join("") +
        card("Nivel de riesgo", bars(d.nivel_riesgo)) +
        card("Orientaci&oacute;n sexual", bars(d.orientacion_sexual)) +
        card("Identidad de g&eacute;nero", bars(d.identidad_genero)) +
        card("Intersexualidad", bars(d.intersexual)) +
        card("Tipo de violencia", bars(d.tipo_violencia)) +
        "</div>",
    };
  }

  // Mapa de calor por quintiles derivado del color de tema (mismo mecanismo
  // que alcohol.js/main_v2.js): 5 tonos del acento de la pestana activa, de
  // claro a oscuro -- asi el mapa de "LGTBI" queda en su propio morado sin
  // tocar el verde/rosa/azul de las otras pestanas.
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
    var host = document.getElementById("lgtbi-map-legend-rows");
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
    echarts.registerMap("PERU_LGTBI", window.GEODATA_DEPT);
    var valores = Object.keys(data.por_departamento).map(function (name) { return data.por_departamento[name].casos; });
    var maxVal = Math.max.apply(null, valores);
    var quintiles = _calcularQuintiles(valores);
    var paleta = _paletaQuintiles(cssVar("--header-green-1"));
    var entriesData = Object.keys(data.por_departamento).map(function (name) {
      var casos = data.por_departamento[name].casos;
      return { name: name, value: casos, itemStyle: { areaColor: _colorPorQuintil(casos, quintiles, paleta) } };
    });
    chart("lgtbi-map-chart").setOption({
      tooltip: {
        trigger: "item",
        formatter: function (p) { return p.name + ": <strong>" + fmt.format(p.value || 0) + "</strong> casos"; }
      },
      series: [{
        type: "map", map: "PERU_LGTBI", roam: true, nameProperty: "nombdep", label: { show: false },
        emphasis: { label: { show: false }, itemStyle: { areaColor: cssVar("--series-violet") } },
        itemStyle: { borderColor: cssVar("--surface-1"), borderWidth: 1 },
        data: entriesData
      }]
    }, true);
    _renderLeyendaQuintiles(quintiles, maxVal, paleta);
    var mapChart = chart("lgtbi-map-chart");
    window.renderMapLabels(mapChart, data.por_departamento, "lgtbi");
    mapChart.on("georoam", function () { window.refreshMapLabels("lgtbi"); });
  }

  function renderRegionBars(data) {
    var host = document.getElementById("lgtbi-region-bars");
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
    host.querySelectorAll(".lgtbi-map-toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        host.querySelectorAll(".lgtbi-map-toggle-btn").forEach(function (b) { b.setAttribute("aria-selected", "false"); });
        btn.setAttribute("aria-selected", "true");
        var vista = btn.getAttribute("data-view");
        var mapView = document.getElementById("lgtbi-map-view");
        var barsView = document.getElementById("lgtbi-region-bars");
        mapView.hidden = vista !== "mapa";
        barsView.hidden = vista !== "barras";
        if (vista === "mapa" && charts["lgtbi-map-chart"]) {
          charts["lgtbi-map-chart"].resize();
          window.refreshMapLabels("lgtbi");
        }
      });
    });
  }

  window.renderLgtbi = function (data) {
    var host = document.getElementById("lgtbi-dashboard");
    if (!host || !data) return;
    Object.keys(charts).forEach(function (id) { charts[id].dispose(); });
    charts = {};

    var bHombres = bloqueSexo("Hombres", "Hombre", data.hombres, "hombres");
    var bMujeres = bloqueSexo("Mujeres", "Mujer", data.mujeres, "mujeres");

    host.innerHTML = '<p class="lgtbi-intro"><strong>' + fmt.format(data.total) +
      '</strong> casos equivalentes al <strong>' + data.pct_base + '%</strong> de la base, de personas LGBTI atendidas.</p>' +
      // El mapa fijo arriba-izquierda + la primera tarjeta a su costado
      // (mismo mecanismo de grid que usan las pestanas Hombres/Mujeres) --
      // asi el mapa queda en la misma ubicaci&oacute;n en todas las pestanas.
      '<div class="theme-body-layout">' +
      '<div class="card-window map-window">' +
      '<div class="card-window-header"><span>Mapa por departamento</span>' +
      '<div class="view-toggle" role="tablist" aria-label="Vista del mapa">' +
      '<button type="button" class="view-toggle-btn lgtbi-map-toggle-btn" data-view="mapa" aria-selected="true">Mapa</button>' +
      '<button type="button" class="view-toggle-btn lgtbi-map-toggle-btn" data-view="barras" aria-selected="false">Barras</button>' +
      '</div></div>' +
      '<div class="card-window-body">' +
      '<div class="map-host-wrap" id="lgtbi-map-view">' +
      '<div class="map-host" id="lgtbi-map-chart"></div>' +
      '<div class="map-legend" id="lgtbi-map-legend"><div class="map-legend-title">Casos</div><div class="map-legend-rows" id="lgtbi-map-legend-rows"></div></div>' +
      '</div>' +
      '<div class="region-bars" id="lgtbi-region-bars" hidden></div>' +
      '</div></div>' +
      '<div class="theme-panel-top">' +
      card("Hombres y mujeres", '<div class="lgtbi-sexo-resumen">' +
        '<div class="lgtbi-stat"><strong>' + fmt.format(data.hombres.total) + '</strong><span>Hombres &middot; ' + data.hombres.pct_del_total + '%</span></div>' +
        '<div class="lgtbi-stat"><strong>' + fmt.format(data.mujeres.total) + '</strong><span>Mujeres &middot; ' + data.mujeres.pct_del_total + '%</span></div>' +
        '</div>') +
      '</div>' +
      '<div class="theme-panel-rest">' +
      bHombres.html + bMujeres.html +
      '<div class="section-title">Evoluci&oacute;n mensual (2026)</div>' +
      '<div class="card-window">' +
      '<div class="card-window-header"><span>Casos por mes</span><div class="view-toggle" id="lgtbi-historico-toggle"></div></div>' +
      '<div class="card-window-body"><div id="lgtbi-historico-chart" class="lgtbi-chart"></div>' +
      '<p class="lgtbi-note">Con ' + fmt.format(data.total) + ' casos en el periodo, la muestra es demasiado peque&ntilde;a para desagregar por sexo y edad sin ruido; se muestra el total mensual.</p></div>' +
      '</div>' +
      '<p class="lgtbi-note">Los porcentajes utilizan como denominador los casos filtrados de personas LGBTI (por sexo, sobre el total de esa secci&oacute;n).</p>' +
      '</div></div>';
    renderEdadPictogramasSexo(bHombres.pictoHostId, bHombres.edad, bHombres.sexo);
    renderEdadPictogramasSexo(bMujeres.pictoHostId, bMujeres.edad, bMujeres.sexo);
    renderMap(data);
    renderRegionBars(data);
    wireMapToggle(host);
    window.renderHistoricoMensual({
      chartId: "lgtbi-historico-chart", toggleHostId: "lgtbi-historico-toggle",
      historico: data.historico_mensual, colorBase: cssVar("--header-green-2"),
    });
    setTimeout(function () { Object.keys(charts).forEach(function (id) { charts[id].resize(); }); }, 0);
  };
  window.resizeLgtbiCharts = function () {
    Object.keys(charts).forEach(function (id) { charts[id].resize(); });
    if (charts["lgtbi-map-chart"]) window.refreshMapLabels("lgtbi");
  };
  window.addEventListener("resize", window.resizeLgtbiCharts);
})();
