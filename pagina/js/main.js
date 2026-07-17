(function () {
  "use strict";

  var fmt = new Intl.NumberFormat("es-PE");

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setText(node, text) {
    node.textContent = text;
  }

  // ---------------------------------------------------------------------
  // Echarts instances are created once and re-configured (notMerge) on
  // every tab switch, instead of being destroyed/recreated.
  // ---------------------------------------------------------------------
  var charts = {};

  function chartFor(hostId) {
    if (!charts[hostId]) {
      charts[hostId] = echarts.init(el(hostId));
    }
    return charts[hostId];
  }

  // Hosts recreated via innerHTML (ring-riesgo-*, ring-tv-*) need their old
  // echarts instance disposed first -- otherwise chartFor() reuses an
  // instance bound to a DOM node that was just removed, and the freshly
  // created div stays blank on the next tab switch.
  function disposeChart(hostId) {
    if (charts[hostId]) {
      charts[hostId].dispose();
      delete charts[hostId];
    }
  }

  window.addEventListener("resize", function () {
    Object.keys(charts).forEach(function (id) {
      charts[id].resize();
    });
    if (charts["map-host"]) actualizarEtiquetasMapa();
  });

  // ---------------------------------------------------------------------
  // Ring / meter (echarts gauge, no needle)
  // ---------------------------------------------------------------------
  function renderRing(hostId, pct, color, fontSize) {
    var chart = chartFor(hostId);
    chart.setOption(
      {
        series: [
          {
            type: "gauge",
            startAngle: 90,
            endAngle: -270,
            radius: "88%",
            pointer: { show: false },
            progress: {
              show: true,
              width: 12,
              itemStyle: { color: color },
            },
            axisLine: {
              lineStyle: { width: 12, color: [[1, cssVar("--gridline")]] },
            },
            splitLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false },
            anchor: { show: false },
            detail: {
              valueAnimation: true,
              formatter: "{value}%",
              fontSize: fontSize || 18,
              fontWeight: 700,
              color: cssVar("--text-primary"),
              offsetCenter: [0, 0],
            },
            data: [{ value: pct }],
          },
        ],
      },
      true
    );
  }

  // ---------------------------------------------------------------------
  // Bar row (plain HTML meter, not echarts -- see marks-and-anatomy.md)
  // ---------------------------------------------------------------------
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

  function findEntry(dict, needle) {
    var keys = Object.keys(dict || {});
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase().indexOf(needle) !== -1) {
        return { label: keys[i], data: dict[keys[i]] };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Section renderers
  // ---------------------------------------------------------------------

  // Iconos vectorizados por (pesta\u00f1a, grupo de edad). Lo que no tenga
  // entrada aca sigue usando el emoji generico como respaldo. Las claves
  // (ej. "nina") vienen de window.ICONS_SVG, generado por
  // vectorize_icons.py a partir de pagina/assets/icons/raw/*.
  var ICONOS_EDAD = {
    mujeres: {
      "0 a 17 a\u00f1os": "nina",
      "18 a 59 a\u00f1os": "nina2",
      "60 a m\u00e1s a\u00f1os": "nina3",
    },
    hombres: {
      "0 a 17 a\u00f1os": "nino",
      "18 a 59 a\u00f1os": "nino2",
      "60 a m\u00e1s a\u00f1os": "nino3",
    },
  };

  // Color de relleno del pictograma por pesta\u00f1a -- azul para hombres,
  // rosado para mujeres (total usa rojo por defecto).
  var COLOR_PICTOGRAMA = {
    hombres: "var(--series-blue)",
    mujeres: "var(--series-pink)",
    total: "var(--series-red)",
  };

  // Pictograma "relleno por porcentaje": la silueta completa se pinta en
  // gris (pista) y una segunda copia, recortada (clip-path) a solo el
  // pct% inferior, se pinta en el color de acento -- efecto de "llenado"
  // desde los pies hacia la cabeza. El rect de recorte arranca en altura 0
  // y se anima hasta el pct real con animarRelleno().
  function buildPictogramSvg(rawSvg, colorVar, uid) {
    var vb = rawSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    var w = vb ? parseFloat(vb[1]) : 100;
    var h = vb ? parseFloat(vb[2]) : 100;
    var inner = rawSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
    var clipId = "pictoclip-" + uid;
    var svg =
      '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet">' +
      "<defs><clipPath id=\"" + clipId + '"><rect class="picto-fill-rect" x="0" y="' + h + '" width="' + w + '" height="0"/></clipPath></defs>' +
      '<g style="color:var(--gridline)">' + inner + "</g>" +
      '<g style="color:' + colorVar + '" clip-path="url(#' + clipId + ')">' + inner + "</g>" +
      "</svg>";
    return { svg: svg, totalHeight: h };
  }

  // Anima el rect de recorte desde vacio hasta el pct objetivo (ease-out).
  function animarRelleno(rectEl, pct, totalHeight, duracionMs) {
    var targetH = (totalHeight * Math.max(0, Math.min(100, pct))) / 100;
    var inicio = null;
    function paso(timestamp) {
      if (!rectEl.isConnected) return; // la tarjeta ya no esta en el DOM (cambio de pestana)
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

  function renderEdad(data, tab) {
    var host = el("edad-tiles");
    host.innerHTML = "";
    var orden = ["0 a 17 a\u00f1os", "18 a 59 a\u00f1os", "60 a m\u00e1s a\u00f1os"];
    orden.forEach(function (key, idx) {
      var d = data.edad[key];
      if (!d) return;
      var nombreIcono = (ICONOS_EDAD[tab] || {})[key];
      var rawSvg = nombreIcono && window.ICONS_SVG ? window.ICONS_SVG[nombreIcono] : null;

      if (rawSvg) {
        var tile = document.createElement("div");
        tile.className = "pictogram-tile";
        tile.innerHTML =
          '<div class="pictogram-icon"></div>' +
          '<div class="pictogram-pct">' + d.pct.toFixed(1) + "%</div>" +
          '<div class="pictogram-count">' + fmt.format(d.casos) + "</div>" +
          '<div class="pictogram-label">' + key + "</div>";
        host.appendChild(tile);

        var iconHost = tile.querySelector(".pictogram-icon");
        var uid = tab + "-" + idx;
        var colorRelleno = COLOR_PICTOGRAMA[tab] || "var(--series-red)";
        var built = buildPictogramSvg(rawSvg, colorRelleno, uid);
        iconHost.innerHTML = built.svg;
        var rectEl = iconHost.querySelector(".picto-fill-rect");
        animarRelleno(rectEl, d.pct, built.totalHeight, 900);
      } else {
        var tileFallback = document.createElement("div");
        tileFallback.className = "stat-tile";
        tileFallback.innerHTML =
          '<div class="stat-tile-icon">\u{1F464}</div>' +
          '<div class="stat-tile-value">' + fmt.format(d.casos) + "</div>" +
          '<div class="stat-tile-label">' + key + "</div>" +
          '<div class="stat-tile-pct">' + d.pct.toFixed(1) + "%</div>";
        host.appendChild(tileFallback);
      }
    });
  }

  function renderEstadoCivil(data) {
    var orden = [
      { key: "Soltero/a", color: cssVar("--series-blue") },
      { key: "Casado/a", color: cssVar("--series-aqua") },
      { key: "Divorciado/a", color: cssVar("--series-yellow") },
      { key: "Viudo/a", color: cssVar("--series-green") },
    ];
    var pieData = orden
      .filter(function (o) { return data.estado_civil[o.key]; })
      .map(function (o) {
        var d = data.estado_civil[o.key];
        return { name: o.key, value: d.casos, itemStyle: { color: o.color } };
      });

    chartFor("estado-civil-host").setOption(
      {
        tooltip: {
          trigger: "item",
          valueFormatter: function (v) { return fmt.format(v); },
        },
        legend: {
          bottom: 0,
          left: "center",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: cssVar("--text-secondary"), fontSize: 11.5 },
        },
        series: [
          {
            type: "pie",
            radius: ["42%", "68%"],
            center: ["50%", "46%"],
            avoidLabelOverlap: true,
            label: {
              formatter: "{d}%",
              color: cssVar("--text-secondary"),
              fontSize: 11,
            },
            labelLine: { length: 8, length2: 6 },
            data: pieData,
          },
        ],
      },
      true
    );
  }

  function renderRingTrio(data) {
    renderRing("ring-discapacidad", data.discapacidad.pct, cssVar("--series-blue"));
    setText(el("count-discapacidad"), fmt.format(data.discapacidad.casos) + " casos");

    renderRing("ring-extranjero", data.extranjero.pct, cssVar("--series-blue"));
    setText(el("count-extranjero"), fmt.format(data.extranjero.casos) + " casos");

    renderRing("ring-trabaja", data.trabaja.pct, cssVar("--series-blue"));
    setText(el("count-trabaja"), fmt.format(data.trabaja.casos) + " casos");
  }

  function renderRiesgo(data) {
    var host = el("riesgo-rings");
    var orden = [
      { needle: "leve", color: cssVar("--status-good"), hostId: "ring-riesgo-leve" },
      { needle: "moderado", color: cssVar("--status-warning"), hostId: "ring-riesgo-moderado" },
      { needle: "severo", color: cssVar("--status-serious"), hostId: "ring-riesgo-severo" },
    ];
    orden.forEach(function (o) { disposeChart(o.hostId); });
    host.innerHTML = "";
    orden.forEach(function (o) {
      var entry = findEntry(data.nivel_riesgo, o.needle);
      if (!entry) return;
      var card = document.createElement("div");
      card.className = "ring-card";
      card.innerHTML =
        '<div class="ring-host ring-host-sm" id="' + o.hostId + '"></div>' +
        '<div class="ring-label">' + entry.label + "</div>" +
        '<div class="ring-count">' + fmt.format(entry.data.casos) + " casos</div>";
      host.appendChild(card);
    });
    orden.forEach(function (o) {
      var entry = findEntry(data.nivel_riesgo, o.needle);
      if (!entry) return;
      renderRing(o.hostId, entry.data.pct, o.color, 14);
    });
  }

  function renderVinculo(data) {
    var host = el("vinculo-bars");
    host.innerHTML = "";
    var orden = [
      { needle: "pareja", color: cssVar("--series-blue") },
      { needle: "familiar", color: cssVar("--series-aqua") },
      { needle: "sin v\u00ednculo", color: cssVar("--series-yellow") },
    ];
    var max = Math.max.apply(
      null,
      Object.values(data.vinculo_agresor).map(function (d) { return d.pct; })
    );
    orden.forEach(function (o) {
      var entry = findEntry(data.vinculo_agresor, o.needle);
      if (!entry) return;
      var width = max > 0 ? (entry.data.pct / max) * 100 : 0;
      host.appendChild(barRow(entry.label, entry.data.casos, entry.data.pct, o.color, width));
    });
  }

  function renderModalidades(data) {
    var host = el("modalidades-bars");
    host.innerHTML = "";
    var labels = {
      acoso_sexual_espacios_publicos: "Acoso sexual en espacios p\u00fablicos",
      trata_fines_explotacion_sexual: "Trata con fines de explotaci\u00f3n sexual",
      hostigamiento_sexual: "Hostigamiento sexual",
      violacion: "Violaci\u00f3n",
    };
    var color = cssVar("--series-blue");
    var values = Object.keys(labels).map(function (k) { return data.modalidades_sexuales[k].pct; });
    var max = Math.max.apply(null, values);
    Object.keys(labels).forEach(function (k) {
      var d = data.modalidades_sexuales[k];
      var width = max > 0 ? (d.pct / max) * 100 : 0;
      host.appendChild(barRow(labels[k], d.casos, d.pct, color, width));
    });
  }

  function renderTipoViolencia(data) {
    var host = el("tipo-violencia-rings");
    var orden = [
      { needle: "econ\u00f3mica", color: cssVar("--series-blue"), hostId: "ring-tv-economica" },
      { needle: "psicol\u00f3gica", color: cssVar("--series-aqua"), hostId: "ring-tv-psicologica" },
      { needle: "f\u00edsica", color: cssVar("--series-yellow"), hostId: "ring-tv-fisica" },
      { needle: "sexual", color: cssVar("--series-violet"), hostId: "ring-tv-sexual" },
    ];
    orden.forEach(function (o) { disposeChart(o.hostId); });
    host.innerHTML = "";
    orden.forEach(function (o) {
      var entry = findEntry(data.tipo_violencia, o.needle);
      if (!entry) return;
      var card = document.createElement("div");
      card.className = "ring-card";
      card.innerHTML =
        '<div class="ring-host ring-host-sm" id="' + o.hostId + '"></div>' +
        '<div class="ring-label">' + entry.label + "</div>" +
        '<div class="ring-count">' + fmt.format(entry.data.casos) + " casos</div>";
      host.appendChild(card);
    });
    orden.forEach(function (o) {
      var entry = findEntry(data.tipo_violencia, o.needle);
      if (!entry) return;
      renderRing(o.hostId, entry.data.pct, o.color, 14);
    });
  }

  // ---------------------------------------------------------------------
  // Mapa (choropleth ECharts, 100% offline) + tabla por region
  // ---------------------------------------------------------------------
  var mapRegistered = false;

  function ensureMapRegistered() {
    if (mapRegistered) return;
    var geo = window.GEODATA_DEPT;
    geo.features.forEach(function (f) {
      f.properties.name = f.properties.nombdep;
    });
    echarts.registerMap("PERU_DPTO", geo);
    mapRegistered = true;
  }

  var COLORES_QUINTIL = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];

  // Quintiles (percentiles 20/40/60/80) de la distribucion real de casos por
  // departamento -- no un degradado lineal 0..max, que con Lima como maximo
  // dispararia todo lo demas al mismo tono claro. Redondeado a enteros.
  function _calcularQuintiles(valores) {
    var ordenados = valores.slice().sort(function (a, b) { return a - b; });
    function percentil(p) {
      var idx = (ordenados.length - 1) * p;
      var lo = Math.floor(idx), hi = Math.ceil(idx);
      if (lo === hi) return ordenados[lo];
      return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (idx - lo);
    }
    return [percentil(0.2), percentil(0.4), percentil(0.6), percentil(0.8)].map(Math.round);
  }

  function _colorPorQuintil(valor, quintiles) {
    for (var i = 0; i < quintiles.length; i++) {
      if (valor < quintiles[i]) return COLORES_QUINTIL[i];
    }
    return COLORES_QUINTIL[COLORES_QUINTIL.length - 1];
  }

  function _renderLeyendaQuintiles(quintiles, maxVal) {
    var cortes = [0, quintiles[0], quintiles[1], quintiles[2], quintiles[3], maxVal];
    var host = el("map-legend-rows");
    host.innerHTML = "";
    for (var i = 0; i < 5; i++) {
      var row = document.createElement("div");
      row.className = "map-legend-row";
      var texto = i < 4
        ? fmt.format(cortes[i]) + " a " + fmt.format(cortes[i + 1]) + " casos"
        : fmt.format(cortes[i]) + " a más casos";
      row.innerHTML = '<span class="map-legend-swatch" style="background:' + COLORES_QUINTIL[i] + '"></span>' + texto;
      host.appendChild(row);
    }
  }

  // ---------------------------------------------------------------------
  // Etiquetas de departamento como texto propio (no el label nativo del
  // mapa): asi se les puede poner halo blanco y, cuando dos quedarian
  // superpuestas, correr una a un hueco libre y unirla a su centroide real
  // con una linea guia -- las etiquetas nativas de ECharts no soportan esto.
  // ---------------------------------------------------------------------
  function _recorrerCoords(coords, cb) {
    if (typeof coords[0] === "number") {
      cb(coords[0], coords[1]);
      return;
    }
    for (var i = 0; i < coords.length; i++) _recorrerCoords(coords[i], cb);
  }

  function _centroideFeature(f) {
    var minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    _recorrerCoords(f.geometry.coordinates, function (lng, lat) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  }

  // Coloca cada etiqueta en el primer hueco libre entre varios candidatos
  // (centro, luego arriba/abajo/diagonales a radios crecientes), probando
  // en orden de mayor a menor cantidad de casos -- los departamentos con
  // mas casos "ganan" su lugar natural primero.
  var CANDIDATOS_OFFSET = [
    [0, 0], [0, -15], [0, 15], [-24, -9], [24, -9], [-24, 9], [24, 9],
    [0, -30], [0, 30], [-24, -24], [24, -24], [-24, 24], [24, 24],
    [-40, 0], [40, 0],
  ];

  function _cajasSuperpuestas(a, b) {
    return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
  }

  function _construirLayoutEtiquetas(chart, items) {
    var colocadas = [];
    var resultado = [];
    items.forEach(function (it) {
      var p = chart.convertToPixel({ seriesIndex: 0 }, [it.lng, it.lat]);
      if (!p) return;
      var w = it.name.length * 5.4 + 8;
      var h = 24;
      var elegido = null;
      for (var i = 0; i < CANDIDATOS_OFFSET.length; i++) {
        var cx = p[0] + CANDIDATOS_OFFSET[i][0];
        var cy = p[1] + CANDIDATOS_OFFSET[i][1];
        var caja = { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
        var choca = colocadas.some(function (o) { return _cajasSuperpuestas(caja, o); });
        if (!choca) {
          elegido = { x: cx, y: cy, caja: caja };
          break;
        }
      }
      if (!elegido) {
        elegido = {
          x: p[0], y: p[1],
          caja: { x1: p[0] - w / 2, x2: p[0] + w / 2, y1: p[1] - h / 2, y2: p[1] + h / 2 },
        };
      }
      colocadas.push(elegido.caja);
      resultado.push({ name: it.name, pct: it.pct, cx: p[0], cy: p[1], x: elegido.x, y: elegido.y });
    });
    return resultado;
  }

  function _graficosDeEtiquetas(layout) {
    var elementos = [];
    layout.forEach(function (it, i) {
      var movido = Math.abs(it.x - it.cx) > 1 || Math.abs(it.y - it.cy) > 1;
      if (movido) {
        elementos.push({
          id: "leader-line-" + i, type: "line", silent: true, z: 100,
          shape: { x1: it.cx, y1: it.cy, x2: it.x, y2: it.y },
          style: { stroke: "#726f68", lineWidth: 1 },
        });
        elementos.push({
          id: "leader-dot-" + i, type: "circle", silent: true, z: 101,
          shape: { cx: it.cx, cy: it.cy, r: 1.6 },
          style: { fill: "#4a4844" },
        });
      }
      elementos.push({
        id: "label-" + i, type: "text", silent: true, x: it.x, y: it.y - 5, z: 102,
        style: {
          text: it.name,
          fontSize: 8.5,
          fontWeight: 500,
          fill: "#232323",
          stroke: "#ffffff",
          lineWidth: 3,
          align: "center",
          verticalAlign: "middle",
        },
      });
      elementos.push({
        id: "label-pct-" + i, type: "text", silent: true, x: it.x, y: it.y + 6, z: 102,
        style: {
          text: it.pct.toFixed(1) + "%",
          fontSize: 7.5,
          fontWeight: 400,
          fill: "#4a4844",
          stroke: "#ffffff",
          lineWidth: 3,
          align: "center",
          verticalAlign: "middle",
        },
      });
    });
    return elementos;
  }

  var ultimaDataMapa = null;

  function actualizarEtiquetasMapa() {
    if (!ultimaDataMapa) return;
    var chart = chartFor("map-host");
    var geo = window.GEODATA_DEPT;
    var items = geo.features
      .map(function (f) {
        var c = _centroideFeature(f);
        var d = ultimaDataMapa.por_departamento[f.properties.nombdep] || {};
        return { name: f.properties.nombdep, casos: d.casos || 0, pct: d.pct || 0, lng: c[0], lat: c[1] };
      })
      .sort(function (a, b) { return b.casos - a.casos; });

    var layout = _construirLayoutEtiquetas(chart, items);
    // replaceMerge (no el merge por id por defecto): el numero de lineas
    // guia cambia segun la pestana (el orden por casos varia), asi que un
    // simple merge dejaba lineas/etiquetas viejas huerfanas sin borrar.
    chart.setOption({ graphic: _graficosDeEtiquetas(layout) }, { replaceMerge: ["graphic"] });
  }

  var eventosMapaListos = false;

  function pintarMapa(data) {
    ensureMapRegistered();
    ultimaDataMapa = data;

    var valores = Object.keys(data.por_departamento).map(function (name) {
      return data.por_departamento[name].casos;
    });
    var maxVal = Math.max.apply(null, valores);
    var quintiles = _calcularQuintiles(valores);

    var entries = Object.keys(data.por_departamento).map(function (name) {
      var casos = data.por_departamento[name].casos;
      return {
        name: name,
        value: casos,
        itemStyle: { areaColor: _colorPorQuintil(casos, quintiles) },
      };
    });

    var chart = chartFor("map-host");
    chart.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: function (p) {
            var v = p.value == null ? 0 : p.value;
            return p.name + ": <strong>" + fmt.format(v) + "</strong> casos";
          },
        },
        series: [
          {
            type: "map",
            map: "PERU_DPTO",
            roam: true,
            label: { show: false },
            emphasis: {
              label: { show: false },
              itemStyle: { areaColor: cssVar("--series-violet") },
            },
            itemStyle: {
              borderColor: cssVar("--surface-1"),
              borderWidth: 1,
            },
            data: entries,
          },
        ],
      },
      true
    );

    _renderLeyendaQuintiles(quintiles, maxVal);
    actualizarEtiquetasMapa();

    if (!eventosMapaListos) {
      chart.on("georoam", actualizarEtiquetasMapa);
      eventosMapaListos = true;
    }
  }

  function renderMapa(data) {
    pintarMapa(data);

    var regiones = Object.keys(data.por_region)
      .map(function (name) { return { name: name, data: data.por_region[name] }; })
      .sort(function (a, b) { return b.data.casos - a.data.casos; });

    var tbody = el("region-table-body");
    tbody.innerHTML = "";
    regiones.forEach(function (r) {
      var tr = document.createElement("tr");
      var tdName = document.createElement("td");
      tdName.textContent = r.name;
      var tdCasos = document.createElement("td");
      tdCasos.textContent = fmt.format(r.data.casos);
      var tdPct = document.createElement("td");
      tdPct.textContent = r.data.pct.toFixed(1) + "%";
      tr.appendChild(tdName);
      tr.appendChild(tdCasos);
      tr.appendChild(tdPct);
      tbody.appendChild(tr);
    });

    var barsHost = el("region-bars");
    barsHost.innerHTML = "";
    var maxRegion = regiones.length ? regiones[0].data.casos : 0;
    regiones.forEach(function (r) {
      var width = maxRegion > 0 ? (r.data.casos / maxRegion) * 100 : 0;
      barsHost.appendChild(
        barRow(r.name, r.data.casos, r.data.pct, cssVar("--series-blue"), width)
      );
    });
  }

  // ---------------------------------------------------------------------
  // Historico
  // ---------------------------------------------------------------------
  function renderHistorico(data, sexoLabel) {
    var years = Object.keys(data.historico_anual).sort();
    var values = years.map(function (y) { return data.historico_anual[y]; });
    var total = values.reduce(function (a, b) { return a + b; }, 0);

    setText(
      el("historico-callout"),
      ""
    );
    el("historico-callout").innerHTML =
      "Desde el a\u00f1o " + years[0] + " al " + years[years.length - 1] +
      " se han registrado <strong>" + fmt.format(total) + "</strong> casos de " + sexoLabel +
      " atendidos en los Centro Emergencia Mujer y Familia.";

    chartFor("historico-host").setOption(
      {
        grid: { left: 48, right: 16, top: 16, bottom: 28 },
        tooltip: {
          trigger: "axis",
          valueFormatter: function (v) { return fmt.format(v); },
        },
        xAxis: {
          type: "category",
          data: years,
          axisLine: { lineStyle: { color: cssVar("--baseline") } },
          axisTick: { show: false },
          axisLabel: { color: cssVar("--text-secondary") },
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: cssVar("--gridline") } },
          axisLabel: { color: cssVar("--text-muted"), formatter: function (v) { return fmt.format(v); } },
        },
        series: [
          {
            type: "bar",
            data: values,
            barMaxWidth: 24,
            itemStyle: { color: cssVar("--series-blue"), borderRadius: [4, 4, 0, 0] },
            label: {
              show: true,
              position: "top",
              color: cssVar("--text-secondary"),
              fontSize: 11,
              formatter: function (p) { return fmt.format(p.value); },
            },
          },
        ],
      },
      true
    );
  }

  // ---------------------------------------------------------------------
  // Orquestador
  // ---------------------------------------------------------------------
  var SEXO_LABEL = { hombres: "hombres", mujeres: "mujeres", total: "personas" };
  var SEXO_TITULO = { hombres: "Casos de hombres", mujeres: "Casos de mujeres", total: "Casos totales" };

  function render(tab) {
    var data = window.CASOS_DATA[tab];
    if (!data) return;

    document.querySelector(".page").classList.toggle("tema-mujeres", tab === "mujeres");

    setText(el("hero-title"), SEXO_TITULO[tab]);
    setText(el("hero-total"), fmt.format(data.total));

    renderEdad(data, tab);
    renderEstadoCivil(data);
    renderRingTrio(data);
    renderRiesgo(data);
    renderVinculo(data);
    renderMapa(data);
    renderModalidades(data);
    renderTipoViolencia(data);
    renderHistorico(data, SEXO_LABEL[tab]);
  }

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.setAttribute("aria-selected", "false");
      });
      btn.setAttribute("aria-selected", "true");
      render(btn.getAttribute("data-tab"));
    });
  });

  document.querySelectorAll(".view-toggle-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var vista = btn.getAttribute("data-view");
      document.querySelectorAll(".view-toggle-btn").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === btn));
      });
      el("region-bars").hidden = vista !== "barras";
      el("region-table-wrap").hidden = vista !== "grilla";
    });
  });

  render("hombres");
})();
