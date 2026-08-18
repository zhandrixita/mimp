(function () {
  "use strict";
  var fmt = new Intl.NumberFormat("es-PE");
  var charts = {};

  var NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  function etiquetaMes(mesISO) {
    var partes = mesISO.split("-");
    return NOMBRES_MES[parseInt(partes[1], 10) - 1] + " " + partes[0];
  }

  // El payload es "largo" (una fila por combinacion sexo/edad presente en
  // los datos) para que un solo historico_mensual sirva a las 4 vistas del
  // toggle -- agrupar() suma las filas segun el nivel elegido.
  function agrupar(historico, nivel) {
    var mapa = {};
    var orden = [];
    historico.filas.forEach(function (fila) {
      var key;
      if (nivel === "total") key = "Total";
      else if (nivel === "sexo") key = fila.sexo || "Total";
      else if (nivel === "edad") key = fila.edad || "Total";
      else key = fila.sexo && fila.edad ? fila.sexo + " · " + fila.edad : (fila.sexo || fila.edad || "Total");
      if (!mapa[key]) {
        mapa[key] = historico.meses.map(function () { return 0; });
        orden.push(key);
      }
      fila.valores.forEach(function (v, i) { mapa[key][i] += v; });
    });
    return orden.map(function (key) { return { name: key, valores: mapa[key] }; });
  }

  // Que botones de toggle mostrar depende de cuanta variedad real hay en
  // los datos -- si una pestana solo trae "Total" (ej. LGTBI, muestra chica)
  // o solo edad (ej. Gestantes, sexo constante), el toggle no ofrece
  // niveles que no aportarian una segunda serie.
  function nivelesDisponibles(historico) {
    var sexos = {}, edades = {};
    historico.filas.forEach(function (f) {
      if (f.sexo) sexos[f.sexo] = true;
      if (f.edad) edades[f.edad] = true;
    });
    var nSexo = Object.keys(sexos).length;
    var nEdad = Object.keys(edades).length;
    var niveles = [{ key: "total", label: "Total" }];
    if (nSexo > 1) niveles.push({ key: "sexo", label: "Por sexo" });
    if (nEdad > 1) niveles.push({ key: "edad", label: "Por grupo de edad" });
    if (nSexo > 1 && nEdad > 1) niveles.push({ key: "sexo_edad", label: "Por sexo y edad" });
    return niveles;
  }

  var PALETA = [
    "var(--series-blue)", "var(--series-pink)", "var(--series-aqua)",
    "var(--series-yellow)", "var(--series-violet)", "var(--series-green)",
    "var(--series-red)", "var(--header-green-2)"
  ];

  function dibujar(instancia, historico, nivel, colorBase) {
    var series = agrupar(historico, nivel);
    var colores = series.length === 1 ? [colorBase || "var(--series-blue)"] : PALETA;
    var mesesLegibles = historico.meses.map(etiquetaMes);
    instancia.setOption(
      {
        animationDuration: 700,
        animationDurationUpdate: 600,
        animationEasing: "cubicOut",
        animationEasingUpdate: "cubicOut",
        tooltip: { trigger: "axis", valueFormatter: function (v) { return fmt.format(v); } },
        legend: series.length > 1
          ? { bottom: 0, type: "scroll", textStyle: { color: "var(--text-secondary)", fontSize: 11.5 } }
          : { show: false },
        grid: { left: 48, right: 16, top: 20, bottom: series.length > 1 ? 46 : 26 },
        xAxis: {
          type: "category", data: mesesLegibles, boundaryGap: false,
          axisLine: { lineStyle: { color: "var(--baseline)" } }, axisTick: { show: false },
          axisLabel: { color: "var(--text-secondary)" },
        },
        yAxis: {
          type: "value", splitLine: { lineStyle: { color: "var(--gridline)" } },
          axisLabel: { color: "var(--text-muted)", formatter: function (v) { return fmt.format(v); } },
        },
        color: colores,
        series: series.map(function (s) {
          return {
            name: s.name, type: "line", data: s.valores, smooth: true,
            symbol: "circle", symbolSize: 6, showSymbol: true,
            areaStyle: series.length === 1 ? { opacity: 0.12 } : { opacity: 0 },
            emphasis: { focus: "series" },
            lineStyle: { width: 2.5 },
          };
        }),
      },
      true
    );
  }

  // config: { chartId, toggleHostId, historico, colorBase }
  // El host (chartId) se recrea via innerHTML en cada cambio de pestana --
  // si ya existia una instancia de echarts para ese id (de la pestana
  // anterior), su nodo quedo huerfano y hay que liberarla antes de crear
  // una nueva (mismo patron que ring-riesgo/ring-tv en main.js).
  window.renderHistoricoMensual = function (config) {
    var historico = config.historico;
    if (!historico || !historico.meses || !historico.meses.length) return;

    if (charts[config.chartId]) {
      charts[config.chartId].dispose();
      delete charts[config.chartId];
    }
    var host = document.getElementById(config.chartId);
    if (!host) return;
    var instancia = echarts.init(host);
    charts[config.chartId] = instancia;

    var niveles = nivelesDisponibles(historico);
    var toggleHost = document.getElementById(config.toggleHostId);
    if (toggleHost) {
      if (niveles.length > 1) {
        toggleHost.innerHTML = niveles
          .map(function (n, i) {
            return (
              '<button type="button" class="view-toggle-btn historico-toggle-btn" data-nivel="' +
              n.key + '" aria-selected="' + (i === 0) + '">' + n.label + "</button>"
            );
          })
          .join("");
        toggleHost.querySelectorAll(".historico-toggle-btn").forEach(function (btn) {
          btn.addEventListener("click", function () {
            toggleHost.querySelectorAll(".historico-toggle-btn").forEach(function (b) {
              b.setAttribute("aria-selected", "false");
            });
            btn.setAttribute("aria-selected", "true");
            dibujar(instancia, historico, btn.getAttribute("data-nivel"), config.colorBase);
          });
        });
      } else {
        toggleHost.innerHTML = "";
      }
    }
    dibujar(instancia, historico, niveles[0].key, config.colorBase);
  };

  window.resizeHistoricoMensualCharts = function () {
    Object.keys(charts).forEach(function (id) { charts[id].resize(); });
  };
  window.addEventListener("resize", window.resizeHistoricoMensualCharts);
})();
