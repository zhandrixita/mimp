// Etiquetas de departamento (nombre + %) superpuestas al mapa, con linea
// guia cuando 2 quedarian superpuestas -- mismo sistema que usan las
// pestanas Hombres/Mujeres (ver _construirLayoutEtiquetas en main.js),
// factorizado aca para que las pestanas tematicas (alcohol, lgtbi,
// extranjeras, gestantes) lo compartan en vez de duplicarlo 4 veces.
(function () {
  "use strict";

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
    [-40, 0], [40, 0]
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
          caja: { x1: p[0] - w / 2, x2: p[0] + w / 2, y1: p[1] - h / 2, y2: p[1] + h / 2 }
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
          style: { stroke: "#726f68", lineWidth: 1 }
        });
        elementos.push({
          id: "leader-dot-" + i, type: "circle", silent: true, z: 101,
          shape: { cx: it.cx, cy: it.cy, r: 1.6 },
          style: { fill: "#4a4844" }
        });
      }
      elementos.push({
        id: "label-" + i, type: "text", silent: true, x: it.x, y: it.y - 5, z: 102,
        style: {
          text: it.name, fontSize: 8.5, fontWeight: 500, fill: "#232323",
          stroke: "#ffffff", lineWidth: 3, align: "center", verticalAlign: "middle"
        }
      });
      elementos.push({
        id: "label-pct-" + i, type: "text", silent: true, x: it.x, y: it.y + 6, z: 102,
        style: {
          text: it.pct.toFixed(1) + "%", fontSize: 7.5, fontWeight: 400, fill: "#4a4844",
          stroke: "#ffffff", lineWidth: 3, align: "center", verticalAlign: "middle"
        }
      });
    });
    return elementos;
  }

  // Un registro por "key" (una por pestana/mapa) para poder recalcular
  // (resize, georoam, volver de la vista "Barras") sin tener que pasar
  // de nuevo el chart/datos cada vez.
  var registro = {};

  function _actualizar(key) {
    var r = registro[key];
    if (!r || !window.GEODATA_DEPT) return;
    var items = window.GEODATA_DEPT.features
      .map(function (f) {
        var c = _centroideFeature(f);
        var d = r.porDepartamento[f.properties.nombdep] || {};
        return { name: f.properties.nombdep, casos: d.casos || 0, pct: d.pct || 0, lng: c[0], lat: c[1] };
      })
      .sort(function (a, b) { return b.casos - a.casos; });
    var layout = _construirLayoutEtiquetas(r.chart, items);
    // replaceMerge (no el merge por id por defecto): el numero de lineas
    // guia cambia segun la pestana/filtro, asi que un simple merge dejaba
    // lineas/etiquetas viejas huerfanas sin borrar.
    r.chart.setOption({ graphic: _graficosDeEtiquetas(layout) }, { replaceMerge: ["graphic"] });
  }

  // chart: instancia de echarts ya con la serie "map" ya seteada.
  // porDepartamento: { "LIMA": {casos,pct}, ... } (mismo shape que en casos_data.js).
  // key: identificador unico de este mapa (ej. "alcohol") para poder
  // refrescarlo despues via refreshMapLabels sin repasar datos.
  window.renderMapLabels = function (chart, porDepartamento, key) {
    if (!chart || !porDepartamento || !key) return;
    registro[key] = { chart: chart, porDepartamento: porDepartamento };
    _actualizar(key);
  };

  window.refreshMapLabels = function (key) {
    _actualizar(key);
  };
})();
