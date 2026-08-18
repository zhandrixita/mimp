(function () {
  "use strict";

  var fmt = new Intl.NumberFormat("es-PE");

  function cssVar(name) {
    // Se lee desde .page (no document.documentElement): .tema-mujeres,
    // que sobreescribe --header-green-1 con el rosa, esta en .page, asi
    // que leer desde <html> nunca veia ese cambio de tema.
    var host = document.querySelector(".page") || document.documentElement;
    return getComputedStyle(host).getPropertyValue(name).trim();
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
    if (charts["map-host"]) {
      ajustarZoomMapa();
      actualizarEtiquetasMapa();
    }
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

  function barListaHost(host, items, color) {
    host.innerHTML = "";
    var max = Math.max.apply(null, items.map(function (i) { return i.pct; }).concat([0.0001]));
    items.forEach(function (it) {
      var width = (it.pct / max) * 100;
      host.appendChild(barRow(it.label, it.casos, it.pct, color, width));
    });
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
    hombres: "var(--header-green-1)",
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
          textStyle: { color: cssVar("--text-secondary"), fontSize: 13 },
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
              fontSize: 13,
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
  // v2 -- Perfil de la presunta persona agresora
  // ---------------------------------------------------------------------
  function renderAgresorSexo(data) {
    var orden = [
      { key: "Hombre", color: cssVar("--series-blue") },
      { key: "Mujer", color: cssVar("--series-pink") },
    ];
    var pieData = orden
      .filter(function (o) { return data.agresor_sexo[o.key]; })
      .map(function (o) {
        var d = data.agresor_sexo[o.key];
        return { name: o.key, value: d.casos, itemStyle: { color: o.color } };
      });
    chartFor("agresor-sexo-host").setOption(
      {
        tooltip: { trigger: "item", valueFormatter: function (v) { return fmt.format(v); } },
        legend: {
          bottom: 0, left: "center", itemWidth: 10, itemHeight: 10,
          textStyle: { color: cssVar("--text-secondary"), fontSize: 13 },
        },
        series: [
          {
            type: "pie", radius: ["42%", "68%"], center: ["50%", "46%"], avoidLabelOverlap: true,
            label: { formatter: "{d}%", color: cssVar("--text-secondary"), fontSize: 13 },
            labelLine: { length: 8, length2: 6 },
            data: pieData,
          },
        ],
      },
      true
    );
  }

  function renderAgresorEdad(data) {
    var orden = ["0 a 17 a\u00f1os", "18 a 59 a\u00f1os", "60 a m\u00e1s a\u00f1os", "Sin informaci\u00f3n"];
    var items = orden.filter(function (k) { return data.agresor_edad[k]; }).map(function (k) {
      var d = data.agresor_edad[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("agresor-edad-bars"), items, cssVar("--header-green-1"));
  }

  var ORDEN_EDUCACION = ["Sin nivel / Inicial", "Primaria", "Secundaria", "Superior", "B\u00e1sica especial", "Posgrado"];

  function renderAgresorEducacion(data) {
    var items = ORDEN_EDUCACION.filter(function (k) { return data.agresor_educacion[k]; }).map(function (k) {
      var d = data.agresor_educacion[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("agresor-educacion-bars"), items, cssVar("--series-aqua"));
  }

  function renderAgresorStatsRings(data) {
    var host = el("agresor-stats-rings");
    var items = [
      { id: "ring-agresor-trabaja", label: "Trabajo remunerado", d: data.agresor_trabaja },
      { id: "ring-agresor-discapacidad", label: "Discapacidad", d: data.agresor_discapacidad },
    ];
    items.forEach(function (o) { disposeChart(o.id); });
    host.innerHTML = "";
    items.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "ring-card";
      card.innerHTML =
        '<div class="ring-host ring-host-sm" id="' + o.id + '"></div>' +
        '<div class="ring-label">' + o.label + "</div>" +
        '<div class="ring-count">' + fmt.format(o.d.casos) + " casos</div>";
      host.appendChild(card);
    });
    items.forEach(function (o) { renderRing(o.id, o.d.pct, cssVar("--series-blue"), 14); });
  }

  // ---------------------------------------------------------------------
  // v2 -- Otros indicadores de la persona usuaria
  // ---------------------------------------------------------------------
  function renderSeguroMedico(data) {
    var labels = {
      sis: "SIS", essalud: "ESSALUD", privado: "Seguro privado",
      pnp_ffaa: "PNP / FFAA", ninguno: "Ning\u00fan seguro",
    };
    var items = Object.keys(labels).map(function (k) {
      var d = data.seguro_medico[k];
      return { label: labels[k], casos: d.casos, pct: d.pct };
    });
    barListaHost(el("seguro-medico-bars"), items, cssVar("--series-blue"));
  }

  function renderEducacionVictima(data) {
    var items = ORDEN_EDUCACION.filter(function (k) { return data.educacion_victima[k]; }).map(function (k) {
      var d = data.educacion_victima[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("educacion-victima-bars"), items, cssVar("--series-aqua"));
  }

  function renderEtnia(data) {
    var items = Object.keys(data.etnia).map(function (k) {
      var d = data.etnia[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("etnia-bars"), items, cssVar("--series-violet"));
  }

  function renderLugarAmbito(data) {
    var itemsLugar = Object.keys(data.lugar_ocurrencia).slice(0, 6).map(function (k) {
      var d = data.lugar_ocurrencia[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("lugar-ocurrencia-bars"), itemsLugar, cssVar("--series-blue"));

    var itemsAmbito = Object.keys(data.ambito_violencia).map(function (k) {
      var d = data.ambito_violencia[k];
      return { label: k, casos: d.casos, pct: d.pct };
    });
    barListaHost(el("ambito-violencia-bars"), itemsAmbito, cssVar("--series-aqua"));
  }

  function renderAtencionSeguimiento(data) {
    var labels = {
      denuncia_interpuesta: "Denuncia interpuesta",
      medidas_proteccion: "Cuenta con medidas de protecci\u00f3n",
      medidas_cautelares: "Cuenta con medidas cautelares",
      atencion_integral: "Atenci\u00f3n integral (psicol\u00f3gica + social + legal)",
      atencion_interdisciplinaria: "Atenci\u00f3n interdisciplinaria",
      sentencia_favorable: "Sentencia favorable",
    };
    var items = Object.keys(labels).map(function (k) {
      var d = data.atencion_seguimiento[k];
      return { label: labels[k], casos: d.casos, pct: d.pct };
    });
    barListaHost(el("atencion-seguimiento-bars"), items, cssVar("--status-good"));
  }

  // ---------------------------------------------------------------------
  // v2 -- Modal "ver mas"
  // ---------------------------------------------------------------------
  function mostrarModal(titulo) {
    setText(el("modal-title"), titulo);
    el("modal-backdrop").hidden = false;
  }

  function cerrarModal() {
    el("modal-backdrop").hidden = true;
  }

  // Cada columna del modal es su propia "ventana" (barra de titulo + cuerpo),
  // igual que el resto del dashboard -- asi, con varios graficos e
  // interpretaciones uno al lado del otro, no se confunden entre si.
  // El contenido va en outer.bodyEl (no en el elemento devuelto): outer es
  // lo que hay que insertar en el contenedor padre (modal-cols/modal-body).
  function columnaModal(titulo) {
    var outer = document.createElement("div");
    outer.className = "card-window";
    var header = document.createElement("div");
    header.className = "card-window-header";
    header.textContent = titulo;
    var bodyEl = document.createElement("div");
    bodyEl.className = "card-window-body";
    outer.appendChild(header);
    outer.appendChild(bodyEl);
    outer.bodyEl = bodyEl;
    return outer;
  }

  function abrirModalDiscapacidad(data) {
    var d = data.discapacidad_detalle;
    var items = [
      { label: "F\u00edsica", casos: d.fisica.casos, pct: d.fisica.pct },
      { label: "Visual", casos: d.visual.casos, pct: d.visual.pct },
      { label: "Auditiva", casos: d.auditiva.casos, pct: d.auditiva.pct },
      { label: "Psicosocial", casos: d.psicosocial.casos, pct: d.psicosocial.pct },
      { label: "Intelectual", casos: d.intelectual.casos, pct: d.intelectual.pct },
    ];
    var body = el("modal-body");
    body.innerHTML = "";
    var col = columnaModal("Tipo de discapacidad que presenta la persona usuaria");
    body.appendChild(col);
    barListaHost(col.bodyEl, items, cssVar("--series-blue"));
    mostrarModal("Discapacidad \u2014 detalle por tipo");
  }

  function abrirModalRiesgo(data) {
    var body = el("modal-body");
    body.innerHTML = "";
    var cols = document.createElement("div");
    cols.className = "modal-cols";

    var col1 = columnaModal("Factores de riesgo \u2014 persona usuaria");
    barListaHost(col1.bodyEl, data.factores_riesgo_victima, cssVar("--series-blue"));
    var col2 = columnaModal("Factores de riesgo \u2014 presunta persona agresora");
    barListaHost(col2.bodyEl, data.factores_riesgo_agresor, cssVar("--series-red"));

    cols.appendChild(col1);
    cols.appendChild(col2);
    body.appendChild(cols);
    mostrarModal("Nivel de riesgo \u2014 factores m\u00e1s frecuentes");
  }

  function abrirModalTipoViolencia(data) {
    var body = el("modal-body");
    body.innerHTML = "";
    var cols = document.createElement("div");
    cols.className = "modal-cols";

    var tipos = [
      { key: "economica", label: "Econ\u00f3mica o patrimonial", color: cssVar("--series-blue") },
      { key: "psicologica", label: "Psicol\u00f3gica", color: cssVar("--series-aqua") },
      { key: "fisica", label: "F\u00edsica", color: cssVar("--series-yellow") },
      { key: "sexual", label: "Sexual", color: cssVar("--series-violet") },
    ];
    tipos.forEach(function (t) {
      var col = columnaModal(t.label);
      barListaHost(col.bodyEl, data.subactos_violencia[t.key] || [], t.color);
      cols.appendChild(col);
    });
    body.appendChild(cols);
    mostrarModal("Tipo de violencia \u2014 sub-actos registrados");
  }

  function kpiTile(label, d) {
    var tile = document.createElement("div");
    tile.className = "kpi-tile";
    tile.innerHTML =
      '<div class="kpi-tile-value">' + d.pct.toFixed(1) + "%</div>" +
      '<div class="kpi-tile-label">' + label + "</div>" +
      '<div class="kpi-tile-count">' + fmt.format(d.casos) + " casos</div>";
    return tile;
  }

  function dictABarItems(dict) {
    return Object.keys(dict).map(function (k) {
      return { label: k, casos: dict[k].casos, pct: dict[k].pct };
    });
  }

  // ---------------------------------------------------------------------
  // Graficos embebidos dentro del modal (donas + barras verticales, ademas
  // de las barras horizontales que ya usan otros modales). Como el modal
  // reconstruye su contenido cada vez que se abre, hay que: 1) liberar la
  // instancia anterior antes de volver a crear el div con el mismo id
  // (mismo problema que resolvimos para los anillos de riesgo/tipo de
  // violencia), y 2) inicializar el chart DESPUES de mostrar el modal --
  // si el contenedor todavia esta oculto (display:none) ECharts lo mide en
  // 0x0 y el grafico queda en blanco.
  // ---------------------------------------------------------------------
  var MODAL_CHART_IDS = ["modal-chart-edad", "modal-chart-estado-civil", "modal-chart-riesgo", "modal-chart-tipo-violencia"];

  function limpiarGraficosModal() {
    MODAL_CHART_IDS.forEach(function (id) { disposeChart(id); });
  }

  function columnaModalConChart(titulo, chartId, alto) {
    var col = columnaModal(titulo);
    var div = document.createElement("div");
    div.id = chartId;
    div.style.width = "100%";
    div.style.height = (alto || 190) + "px";
    col.bodyEl.appendChild(div);
    return col;
  }

  function colorPorEtiqueta(label, mapa, respaldo) {
    return mapa[label] || respaldo;
  }

  function renderDonutModal(chartId, items, mapaColor, colorRespaldo) {
    var pieData = items.map(function (it) {
      return { name: it.label, value: it.casos, itemStyle: { color: colorPorEtiqueta(it.label, mapaColor, colorRespaldo) } };
    });
    chartFor(chartId).setOption(
      {
        tooltip: { trigger: "item", valueFormatter: function (v) { return fmt.format(v); } },
        legend: {
          bottom: 0, left: "center", itemWidth: 9, itemHeight: 9,
          textStyle: { color: cssVar("--text-secondary"), fontSize: 12 },
        },
        series: [
          {
            type: "pie", radius: ["38%", "62%"], center: ["50%", "40%"], avoidLabelOverlap: true,
            label: { formatter: "{d}%", color: cssVar("--text-secondary"), fontSize: 12 },
            labelLine: { length: 6, length2: 4 },
            data: pieData,
          },
        ],
      },
      true
    );
  }

  function renderColumnaVerticalModal(chartId, items, mapaColor, colorRespaldo) {
    chartFor(chartId).setOption(
      {
        grid: { left: 40, right: 8, top: 10, bottom: items.length > 3 ? 58 : 34 },
        tooltip: { trigger: "axis", valueFormatter: function (v) { return fmt.format(v); } },
        xAxis: {
          type: "category",
          data: items.map(function (it) { return it.label; }),
          axisLabel: {
            color: cssVar("--text-secondary"), fontSize: 11.5, interval: 0,
            rotate: items.length > 3 ? 32 : 0,
            width: items.length > 3 ? 70 : undefined,
            overflow: items.length > 3 ? "truncate" : undefined,
          },
          axisLine: { lineStyle: { color: cssVar("--baseline") } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: cssVar("--gridline") } },
          axisLabel: { color: cssVar("--text-muted"), fontSize: 11.5, formatter: function (v) { return fmt.format(v); } },
        },
        series: [
          {
            type: "bar",
            data: items.map(function (it) {
              return { value: it.casos, itemStyle: { color: colorPorEtiqueta(it.label, mapaColor, colorRespaldo) } };
            }),
            barMaxWidth: 30,
            itemStyle: { borderRadius: [3, 3, 0, 0] },
            label: {
              show: true, position: "top", fontSize: 11,
              color: cssVar("--text-secondary"),
              formatter: function (p) { return fmt.format(p.value); },
            },
          },
        ],
      },
      true
    );
  }

  // ---------------------------------------------------------------------
  // Interpretacion automatica debajo de cada grafico: se recalcula a partir
  // de los datos reales en cada apertura del modal (no es texto fijo) --
  // toma siempre la categoria de mayor porcentaje y arma una oracion corta.
  // ---------------------------------------------------------------------
  function mayorEntrada(items) {
    return items.slice().sort(function (a, b) { return b.pct - a.pct; })[0];
  }

  function insightNode(prefijo, destacado, sufijo) {
    var p = document.createElement("p");
    p.className = "chart-insight";
    p.appendChild(document.createTextNode(prefijo));
    var strong = document.createElement("strong");
    strong.textContent = destacado;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(sufijo));
    return p;
  }

  function insightPredominante(items, prefijo) {
    var top = mayorEntrada(items);
    return insightNode(
      prefijo,
      top.label,
      " (" + fmt.format(top.casos) + " casos, " + top.pct.toFixed(1) + "%)."
    );
  }

  function abrirModalDepartamento(nombre, data) {
    limpiarGraficosModal();
    var det = (data.por_departamento_detalle || {})[nombre];
    var body = el("modal-body");
    body.innerHTML = "";

    if (!det || !det.total) {
      var vacio = document.createElement("p");
      vacio.textContent = "No hay casos registrados en " + nombre + " para esta selecci\u00f3n.";
      body.appendChild(vacio);
      mostrarModal(nombre);
      return;
    }

    var stats = document.createElement("div");
    stats.className = "kpi-tiles";
    stats.appendChild(kpiTile("Con alg\u00fan tipo de discapacidad", det.discapacidad));
    stats.appendChild(kpiTile("Personas extranjeras", det.extranjero));
    stats.appendChild(kpiTile("Trabajo remunerado", det.trabaja));
    stats.appendChild(kpiTile("Denuncia interpuesta", det.atencion_seguimiento.denuncia_interpuesta));
    stats.appendChild(kpiTile("Cuenta con medidas de protecci\u00f3n", det.atencion_seguimiento.medidas_proteccion));
    stats.appendChild(kpiTile("Atenci\u00f3n integral del CEM", det.atencion_seguimiento.atencion_integral));
    body.appendChild(stats);

    var itemsEdad = dictABarItems(det.edad);
    var itemsEstado = dictABarItems(det.estado_civil);
    var itemsRiesgo = dictABarItems(det.nivel_riesgo);
    var itemsTipoViol = dictABarItems(det.tipo_violencia);
    var itemsVinculo = dictABarItems(det.vinculo_agresor);

    var cols = document.createElement("div");
    cols.className = "modal-cols";

    // Barras verticales: edad y tipo de violencia
    var colEdad = columnaModalConChart("Grupos de edad", "modal-chart-edad");
    colEdad.bodyEl.appendChild(insightPredominante(itemsEdad, "El grupo etario m\u00e1s afectado es "));
    var colTipoViol = columnaModalConChart("Tipo de violencia", "modal-chart-tipo-violencia");
    colTipoViol.bodyEl.appendChild(insightPredominante(itemsTipoViol, "El tipo de violencia m\u00e1s frecuente es "));
    // Donas: estado civil y nivel de riesgo
    var colEstado = columnaModalConChart("Estado civil", "modal-chart-estado-civil");
    colEstado.bodyEl.appendChild(insightPredominante(itemsEstado, "La mayor\u00eda de personas usuarias son "));
    var colRiesgo = columnaModalConChart("Nivel de riesgo", "modal-chart-riesgo");
    colRiesgo.bodyEl.appendChild(insightPredominante(itemsRiesgo, "El nivel de riesgo predominante es "));
    // Barras horizontales: vinculo con la presunta persona agresora
    var colVinculo = columnaModal("V\u00ednculo con la presunta persona agresora");
    barListaHost(colVinculo.bodyEl, itemsVinculo, cssVar("--series-violet"));
    colVinculo.bodyEl.appendChild(insightPredominante(itemsVinculo, "El v\u00ednculo m\u00e1s frecuente con la presunta persona agresora es "));

    cols.appendChild(colEdad);
    cols.appendChild(colEstado);
    cols.appendChild(colRiesgo);
    cols.appendChild(colTipoViol);
    cols.appendChild(colVinculo);
    body.appendChild(cols);

    mostrarModal(nombre + " \u2014 " + fmt.format(det.total) + " casos");

    // Recien ahora el modal esta visible (mostrarModal saco el "hidden") --
    // se inicializan los graficos con el contenedor ya midiendo su tamano real.
    renderColumnaVerticalModal("modal-chart-edad", itemsEdad, {}, cssVar("--series-blue"));
    renderColumnaVerticalModal(
      "modal-chart-tipo-violencia",
      itemsTipoViol,
      {
        "Econ\u00f3mica o patrimonial": cssVar("--series-blue"),
        "Psicol\u00f3gica": cssVar("--series-aqua"),
        "F\u00edsica": cssVar("--series-yellow"),
        "Sexual": cssVar("--series-violet"),
      },
      cssVar("--series-red")
    );
    renderDonutModal(
      "modal-chart-estado-civil",
      itemsEstado,
      {
        "Soltero/a": cssVar("--series-blue"),
        "Casado/a": cssVar("--series-aqua"),
        "Divorciado/a": cssVar("--series-yellow"),
        "Viudo/a": cssVar("--series-green"),
      },
      cssVar("--series-violet")
    );
    renderDonutModal(
      "modal-chart-riesgo",
      itemsRiesgo,
      {
        "Leve": cssVar("--status-good"),
        "Moderado": cssVar("--status-warning"),
        "Severo": cssVar("--status-serious"),
      },
      cssVar("--series-blue")
    );
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

  // Mapa de calor: 5 tonos del mismo color de tema (verde/rosa, segun
  // .tema-mujeres), de claro a oscuro -- antes era una escala de azules
  // fija, ajena al tema del resto del dashboard.
  function _hexARgb(hex) {
    hex = hex.replace("#", "");
    return [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16),
    ];
  }

  function _rgbAHex(r, g, b) {
    function h(v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      var s = v.toString(16);
      return s.length < 2 ? "0" + s : s;
    }
    return "#" + h(r) + h(g) + h(b);
  }

  function _mezclarColor(hexA, hexB, t) {
    var a = _hexARgb(hexA), b = _hexARgb(hexB);
    return _rgbAHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }

  function _paletaQuintiles(colorBase) {
    return [
      _mezclarColor(colorBase, "#ffffff", 0.82),
      _mezclarColor(colorBase, "#ffffff", 0.55),
      colorBase,
      _mezclarColor(colorBase, "#000000", 0.22),
      _mezclarColor(colorBase, "#000000", 0.45),
    ];
  }

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

  function _colorPorQuintil(valor, quintiles, paleta) {
    for (var i = 0; i < quintiles.length; i++) {
      if (valor < quintiles[i]) return paleta[i];
    }
    return paleta[paleta.length - 1];
  }

  function _renderLeyendaQuintiles(quintiles, maxVal, paleta) {
    var cortes = [0, quintiles[0], quintiles[1], quintiles[2], quintiles[3], maxVal];
    var host = el("map-legend-rows");
    host.innerHTML = "";
    for (var i = 0; i < 5; i++) {
      var row = document.createElement("div");
      row.className = "map-legend-row";
      var texto = i < 4
        ? fmt.format(cortes[i]) + " a " + fmt.format(cortes[i + 1]) + " casos"
        : fmt.format(cortes[i]) + " a m\u00e1s casos";
      row.innerHTML = '<span class="map-legend-swatch" style="background:' + paleta[i] + '"></span>' + texto;
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

  // El ajuste "contain" por defecto de echarts deja franjas vacias arriba
  // y abajo del mapa (el alto de la ventana varia segun la pestana de
  // tematica activa). Se mide el encaje natural (zoom 1) y se calcula el
  // zoom minimo para que el mapa llegue de canto a canto en el alto.
  function ajustarZoomMapa() {
    var chart = chartFor("map-host");
    chart.setOption({ series: [{ zoom: 1 }] });
    var cs = chart.getModel().getSeriesByIndex(0).coordinateSystem;
    var altoNatural = cs && cs._viewRect && cs._viewRect.height;
    if (!altoNatural) return;
    var zoomNecesario = chart.getHeight() / altoNatural;
    if (zoomNecesario > 1) {
      chart.setOption({ series: [{ zoom: zoomNecesario }] });
    }
  }

  function pintarMapa(data) {
    ensureMapRegistered();
    ultimaDataMapa = data;

    var valores = Object.keys(data.por_departamento).map(function (name) {
      return data.por_departamento[name].casos;
    });
    var maxVal = Math.max.apply(null, valores);
    var quintiles = _calcularQuintiles(valores);
    var paleta = _paletaQuintiles(cssVar("--header-green-1"));

    var entries = Object.keys(data.por_departamento).map(function (name) {
      var casos = data.por_departamento[name].casos;
      return {
        name: name,
        value: casos,
        itemStyle: { areaColor: _colorPorQuintil(casos, quintiles, paleta) },
      };
    });

    var chart = chartFor("map-host");
    chart.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: function (p) {
            var v = p.value == null ? 0 : p.value;
            return p.name + ": <strong>" + fmt.format(v) + "</strong> casos" +
              '<br/><span style="opacity:.7;font-size:11px;">Clic para ver el detalle</span>';
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
            // Sin esto, el departamento clickeado se queda resaltado con el
            // amarillo por defecto de echarts (no combina con el tema) --
            // se usa el mismo verde/rosa que ya responde a .tema-mujeres.
            select: {
              label: { show: false },
              itemStyle: { areaColor: cssVar("--header-green-1") },
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

    _renderLeyendaQuintiles(quintiles, maxVal, paleta);
    ajustarZoomMapa();
    actualizarEtiquetasMapa();

    if (!eventosMapaListos) {
      chart.on("georoam", actualizarEtiquetasMapa);
      chart.on("click", function (params) {
        if (params.componentType === "series" && params.name) {
          abrirModalDepartamento(params.name, window.CASOS_DATA[tabActual]);
        }
      });
      eventosMapaListos = true;
    }
  }

  function renderMapa(data) {
    pintarMapa(data);

    var regiones = Object.keys(data.por_region)
      .map(function (name) { return { name: name, data: data.por_region[name] }; })
      .sort(function (a, b) { return b.data.casos - a.data.casos; });

    var barsHost = el("region-bars");
    barsHost.innerHTML = "";
    var maxRegion = regiones.length ? regiones[0].data.casos : 0;
    var colorTema = cssVar("--header-green-1");
    regiones.forEach(function (r) {
      var width = maxRegion > 0 ? (r.data.casos / maxRegion) * 100 : 0;
      barsHost.appendChild(
        barRow(r.name, r.data.casos, r.data.pct, colorTema, width)
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
              fontSize: 13,
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
  var SEXO_LABEL = { hombres: "hombres", mujeres: "mujeres" };
  var SEXO_TITULO = { hombres: "Casos de hombres", mujeres: "Casos de mujeres" };
  var tabActual = "hombres";

  // Pestanas "tematicas" (no hombres/mujeres): cada una tiene su propio
  // dashboard dedicado (#<id>-dashboard) + tema de color (.tema-<clase>) +
  // renderer propio, en vez de compartir el layout usuaria/agresor/etc.
  var TABS_TEMATICOS = {
    alcohol_drogas: { dashboardId: "alcohol-dashboard", temaClass: "tema-alcohol", titulo: "Agresor bajo los efectos del alcohol y drogas", render: function (d) { window.renderAlcohol(d); } },
    lgtbi: { dashboardId: "lgtbi-dashboard", temaClass: "tema-lgtbi", titulo: "Casos de personas LGBTI", render: function (d) { window.renderLgtbi(d); } },
    extranjeras: { dashboardId: "extranjeras-dashboard", temaClass: "tema-extranjeras", titulo: "Casos de personas extranjeras", render: function (d) { window.renderExtranjeras(d); } },
    gestantes: { dashboardId: "gestantes-dashboard", temaClass: "tema-gestantes", titulo: "Casos de mujeres en estado de gestación", render: function (d) { window.renderGestantes(d); } }
  };

  function render(tab) {
    var data = window.CASOS_DATA[tab];
    if (!data) return;
    tabActual = tab;

    var tematico = TABS_TEMATICOS[tab];
    document.querySelector(".theme-tabs").hidden = !!tematico;
    document.querySelector(".theme-bar").hidden = !!tematico;
    document.querySelector(".theme-content-frame").hidden = !!tematico;
    Object.keys(TABS_TEMATICOS).forEach(function (key) {
      var t = TABS_TEMATICOS[key];
      el(t.dashboardId).hidden = key !== tab;
      document.querySelector(".page").classList.toggle(t.temaClass, key === tab);
    });
    if (tematico) {
      document.querySelector(".page").classList.remove("tema-mujeres");
      setText(el("hero-title"), tematico.titulo);
      setText(el("hero-total"), fmt.format(data.total));
      tematico.render(data);
      return;
    }

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

    // v2
    renderAgresorSexo(data);
    renderAgresorEdad(data);
    renderAgresorEducacion(data);
    renderAgresorStatsRings(data);
    renderSeguroMedico(data);
    renderEducacionVictima(data);
    renderEtnia(data);
    renderLugarAmbito(data);
    renderAtencionSeguimiento(data);
  }

  document.querySelectorAll("#sex-tabs .tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#sex-tabs .tab-btn").forEach(function (b) {
        b.setAttribute("aria-selected", "false");
      });
      btn.setAttribute("aria-selected", "true");
      render(btn.getAttribute("data-tab"));
    });
  });

  // Pestanas de tematica: solo cambian que panel se ve, no los datos.
  // Los graficos de un panel oculto (display:none) se inicializan a tamano
  // 0x0 -- hay que forzar resize() (y recalcular etiquetas del mapa) cuando
  // el panel se hace visible por primera vez.
  document.querySelectorAll(".theme-tabs .tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".theme-tabs .tab-btn").forEach(function (b) {
        b.setAttribute("aria-selected", "false");
      });
      btn.setAttribute("aria-selected", "true");

      var tema = btn.getAttribute("data-theme");
      document.querySelectorAll("[data-theme-panel-top]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-theme-panel-top") !== tema;
      });
      document.querySelectorAll("[data-theme-panel-rest]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-theme-panel-rest") !== tema;
      });

      Object.keys(charts).forEach(function (id) { charts[id].resize(); });
      if (charts["map-host"]) {
        ajustarZoomMapa();
        actualizarEtiquetasMapa();
      }
    });
  });

  document.querySelectorAll(".view-toggle-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var vista = btn.getAttribute("data-view");
      document.querySelectorAll(".view-toggle-btn").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === btn));
      });
      el("map-view").hidden = vista !== "mapa";
      el("region-bars").hidden = vista !== "barras";

      // El mapa se inicializa a tamano 0x0 si estaba oculto (display:none)
      // mientras se mostraba "barras" -- hay que forzar resize() al volver.
      if (vista === "mapa" && charts["map-host"]) {
        charts["map-host"].resize();
        ajustarZoomMapa();
        actualizarEtiquetasMapa();
      }
    });
  });

  document.querySelectorAll("[data-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var data = window.CASOS_DATA[tabActual];
      var tipo = btn.getAttribute("data-modal");
      if (tipo === "discapacidad") abrirModalDiscapacidad(data);
      else if (tipo === "riesgo") abrirModalRiesgo(data);
      else if (tipo === "tipo-violencia") abrirModalTipoViolencia(data);
    });
  });
  el("modal-close").addEventListener("click", cerrarModal);
  el("modal-backdrop").addEventListener("click", function (e) {
    if (e.target === el("modal-backdrop")) cerrarModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") cerrarModal();
  });

  render("hombres");
})();
