(function () {
  "use strict";
  const D = window.DASH_DATA, E = window.DashEngine;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const colors = ["#247f79", "#cf8c62", "#af5f80", "#88aaa9", "#8b91ba", "#b2bd83"];
  let charts = [], pageLimit = 12, sectionId = "panorama", search = "", detailField = null, result;
  let filters = { population: "total", months: D?.months?.length ? [D.months[D.months.length - 1].id] : [], departments: D ? D.departments.map((_, i) => i) : [] };
  const byId = new Map((D?.fields || []).map(f => [f.id, f]));
  const summaryIds = ["EDAD_GRANDE", "SEXO_VICTIMA", "TIPO_VIOLENCIA", "NIVEL_DE_RIESGO_VICTIMA", "CONDICION", "AREA_RESIDENCIA_DOMICILIO", "REDES_FAM_SOC", "CEM_ATENC_PSICOLOG", "CEM_ATENC_SOCIAL", "CEM_ATENC_LEGAL"];
  const priorities = {
    ingreso: ["CONDICION", "FORMA_INGRESO", "TURNO_INGRESO", "CATEGORIA", "CEM", "MEDIO"],
    perfil: ["EDAD_GRANDE", "SEXO_VICTIMA", "ESTADO_CIVIL_VICTIMA", "NIVEL_EDUCATIVO_VICTIMA", "TRABAJA_VICTIMA", "ESTUDIA", "OCUPACION_VICTIMA"],
    territorio: ["DPTO_UBI_CEM", "REGION_UBI_CEM", "NOM_DPTO", "AREA_RESIDENCIA_DOMICILIO", "LENGUA_MATERNA_VICTIMA", "ETNIA_VICTIMA", "VRAEM"],
    poblaciones: ["VICTIMA_GESTANDO", "VICTIMA_TIEMPO_GESTACION", "CASOS_PERSONAS_LGBTI", "IDENTIDAD_GENERO", "CASOS_PERSONAS_EXTRANJERAS", "VICTIMA_PAIS_EXTRANJERO", "DISCAPACIDAD_VICTIMA"],
    violencia: ["TIPO_VIOLENCIA", "PRIMERA_VEZ_AGREDE", "FRECUENCIA_AGREDE", "DENUNCIA_ANTERIORES_HECHOS", "LUGAR_OCURRENCIA", "AMBITO_VIOLENCIA", "CASO_TENTATIVA_DE_FEMINICIDIO", "ANTECEDENTE_DESAPARICION"],
    agresor: ["VINCULO_AGRESOR_VICTIMA", "VINCULO_PAREJA", "VINCULO_FAMILIAR", "SEXO_AGRESOR", "EDAD_GRANDE_AGRESOR", "AGRESOR_VIVE_CASA_VICTIMA", "ESTADO_AGRESOR_U_A"],
    riesgo: ["NIVEL_DE_RIESGO_VICTIMA", "PROBABILIDAD_VIOLENCIA", "IMPACTO_VIOLENCIA", "REDES_FAM_SOC", "COMP_DESTR_PROT", "RECURSOS_INST", "INSERCION_RED_HRT"],
    atencion: ["CEM_ATENC_PSICOLOG", "CEM_ATENC_SOCIAL", "CEM_DERIVA_SALUD", "CEM_DERIVA_SALUD_KIT_EMERG", "CASOS_KIT_EMERG_ENTREG", "ATENCION_INTEGRAL", "ATENCION_INTERDISCIPLINARIA"],
    justicia: ["INTERPUSO_DENUNCIA", "DESEA_DENUNCIAR", "DESEA_PATROCINIO_LEGAL", "CEM_ATENC_LEGAL", "PATROCINIO_LEGAL", "CEM_SOL_MED_PROTECCION", "CASOS_MEDIDAS_PROTEC_CONCEDIDAS", "CASOS_MEDIDAS_PROTEC_EJECUTADAS", "SENTENCIA_FAVORABLE"]
  };
  function count(id, labelOrIndex) {
    const f = byId.get(id); if (!f) return 0;
    const i = typeof labelOrIndex === "number" ? labelOrIndex : f.labels.findIndex(s => norm(s).includes(norm(labelOrIndex)));
    return i < 0 ? 0 : result.vector[f.offset + i];
  }
  function chart(id, option) {
    const host = $(id); if (!host) return null;
    const instance = echarts.init(host);
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    instance.setOption({ animation: motion, animationDuration: 750, animationDurationUpdate: 450, animationEasing: "cubicOut", animationEasingUpdate: "cubicOut", textStyle: { fontFamily: '"Segoe UI", Arial, sans-serif' }, ...option });
    charts.push(instance); return instance;
  }
  function disposeCharts() { charts.forEach(c => c.dispose()); charts = []; }
  function panelHeading(title, sub, action = "") { return `<div class="panel-heading"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${action}</div>`; }
  function bar(row, base, max, color = colors[0]) {
    return `<div class="bar-row"><div class="bar-label"><span>${esc(row.label)}</span><strong>${E.fmt(row.count)} <em>${E.pct(row.count, base)}</em></strong></div><div class="bar-track"><div class="bar-fill" style="width:${max ? row.count * 100 / max : 0}%;background:${color}"></div></div></div>`;
  }
  function rows(id) { return E.distribution(byId.get(id), result); }
  function sortedRows(f) { return E.distribution(f, result).filter(r => !r.missing && r.count).sort((a, b) => b.count - a.count); }
  function fieldButton(id, text = "Ver tabla y análisis ↗") { return `<button class="text-link" data-detail="${esc(id)}">${text}</button>`; }
  function groupTitle(id) { return D.sections.find(s => s.id === id)?.title || "Catálogo"; }
  function visibleFields() {
    let fields = D.fields.filter(f => sectionId === "catalogo" || search || f.section === sectionId);
    if (search) fields = fields.filter(f => norm(f.title + " " + f.id + " " + groupTitle(f.section)).includes(norm(search)));
    const order = priorities[sectionId] || [];
    return fields.sort((a, b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  }
  function buildNav() {
    const icons = ["↳", "♙", "⌖", "◉", "≋", "♧", "◇", "+", "⚖"];
    const nav = (id, title, icon, n = "") => `<button class="nav-link" data-section="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${title}</span>${n !== "" ? `<span class="nav-count">${n}</span>` : ""}</button>`;
    $("navigation").innerHTML = nav("panorama", "Panorama general", "▦") + D.sections.map((s, i) => nav(s.id, s.title, icons[i], D.fields.filter(f => f.section === s.id).length)).join("") + '<div class="nav-divider"></div>' + nav("historico", "Evolución temporal", "⌁") + nav("catalogo", "Catálogo de indicadores", "⌕", D.fields.length);
    $("population-buttons").innerHTML = D.populations.map(p => `<button type="button" class="population-button" data-population="${p.id}" aria-pressed="false">${esc(p.title)}</button>`).join("");
    $("header-month").innerHTML = `<option value="all">Todo el periodo</option>${D.months.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join("")}`;
    $("departments-options").innerHTML = D.departments.map((label, i) => `<div class="picker-option"><label><input type="checkbox" value="${i}" checked> <span>${esc(label)}</span></label><button type="button" class="select-only" data-department-only="${i}" aria-label="Seleccionar solo ${esc(label)}">Solo este</button></div>`).join("");
  }
  function syncDraft() {
    document.querySelectorAll("[data-population]").forEach(button => {
      const active = button.dataset.population === filters.population;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $("header-month").value = filters.months.length === D.months.length ? "all" : String(filters.months[0]);
    document.querySelectorAll("#departments-options input").forEach(input => { input.checked = filters.departments.includes(Number(input.value)); });
    draftCaptions();
  }
  function draftCaptions() {
    const inputs = [...document.querySelectorAll("#departments-options input")];
    const checked = inputs.filter(i => i.checked);
    $("departments-caption").textContent = checked.length === inputs.length ? "Todos los departamentos" : checked.length === 1 ? checked[0].parentElement.textContent.trim() : `${checked.length} departamentos seleccionados`;
  }
  function applyDepartmentDraft(closePicker = false) {
    const inputs = [...document.querySelectorAll("#departments-options input")];
    const departments = inputs.filter(i => i.checked).map(i => Number(i.value));
    if (!departments.length) {
      $("filter-hint").textContent = "Selecciona al menos un departamento.";
      return false;
    }
    filters.departments = departments;
    draftCaptions();
    if (closePicker) document.querySelectorAll(".picker").forEach(p => { p.open = false; });
    $("filter-hint").textContent = departments.length === D.departments.length ? "Se muestran todos los departamentos." : "Departamento aplicado al dashboard y al reporte.";
    refresh();
    return true;
  }
  function renderKpis() {
    const severe = count("NIVEL_DE_RIESGO_VICTIMA", "severo");
    const children = count("EDAD_GRANDE", "0 a 17");
    const deptN = result.territorial.filter(n => n > 0).length;
    const kpis = [
      ["Casos atendidos", E.fmt(result.total), `${E.pct(result.total, D.meta.rows)} del corte nacional`, "featured", "↗"],
      ["Niñas, niños y adolescentes", E.fmt(children), `${E.pct(children, result.total)} de los casos seleccionados`, "", "♙"],
      ["Riesgo severo", E.fmt(severe), `${E.pct(severe, result.total)} de los casos seleccionados`, "", "◇"],
      ["Departamentos con casos", E.fmt(deptN), `${filters.departments.length} departamentos seleccionados`, "", "⌖"]
    ];
    $("kpis").innerHTML = kpis.map(([label, value, note, cls, icon]) => `<article class="kpi ${cls}"><p class="kpi-label">${label}</p><span class="kpi-decoration" aria-hidden="true">${icon}</span><div class="kpi-value">${value}</div><p class="kpi-note">${note}</p></article>`).join("");
    const desc = E.filterDescription(D, filters);
    $("active-filters").innerHTML = `<strong>Filtros aplicados:</strong><span><b>Población:</b> ${esc(desc.population)}</span><span><b>Mes:</b> ${esc(desc.months)}</span><span><b>Departamento de atención:</b> ${esc(desc.departments)}</span>`;
  }
  function ageMarkup() {
    const age = rows("EDAD_GRANDE").filter(r => !r.missing);
    const keys = [["nina", "nino"], ["nina2", "nino2"], ["nina3", "nino3"]];
    return `<article class="panel age-panel">${panelHeading("Las personas detrás de las cifras", "Distribución por grandes grupos de edad", '<span class="panel-tag">CICLO DE VIDA</span>')}<div class="age-grid">${age.map((r, i) => {
      const silhouettes = keys[i] || keys[2];
      const allowed = filters.population === "hombres" ? [silhouettes[1]] : ["mujeres", "gestantes"].includes(filters.population) ? [silhouettes[0]] : silhouettes;
      return `<div class="age-card"><div class="silhouettes" aria-hidden="true">${allowed.map(k => window.ICONS_SVG[k] || "").join("")}</div><div><span class="age-label">${esc(r.label)}</span><strong>${E.fmt(r.count)}</strong><span class="age-pct">${E.pct(r.count, result.total)}</span></div></div>`;
    }).join("")}</div><div class="panel-footer"><span>Porcentaje sobre la selección</span>${fieldButton("EDAD_GRANDE", "Ver detalle ↗")}</div></article>`;
  }
  function overview() {
    const risk = rows("NIVEL_DE_RIESGO_VICTIMA").filter(r => !r.missing);
    const ranked = D.departments.map((label, i) => ({ label, count: result.territorial[i] })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
    $("dashboard").innerHTML = `<div class="overview-grid"><article class="panel map-panel">${panelHeading("Distribución territorial", "Departamento donde se ubica el CEM", '<div class="segment"><button id="map-view" class="selected">Mapa</button><button id="rank-view">Ranking</button></div>')}<div id="map-chart" class="map-chart" role="img" aria-label="Mapa de casos por departamento"></div><div id="rank-list" class="panel-body" hidden>${ranked.map(r => bar(r, result.total, ranked[0].count)).join("")}</div><p class="map-caption" id="map-instruction">Selecciona un departamento en el mapa para filtrar.</p><div class="map-foot" id="map-top">${ranked.slice(0, 3).map(r => bar(r, result.total, ranked[0].count)).join("")}</div><div class="panel-footer"><span>Cantidad de casos, no tasas poblacionales</span>${fieldButton("DPTO_UBI_CEM", "Ver tabla ↗")}</div></article>${ageMarkup()}<div class="two-panels"><article class="panel">${panelHeading("Tipo de violencia", "Distribución de los casos registrados")}<div class="donut-wrap"><div id="violence-chart" class="donut-chart" role="img" aria-label="Distribución por tipo de violencia"></div><div class="legend" id="violence-legend"></div></div><div class="panel-footer"><span>Base: ${E.fmt(result.total)} casos</span>${fieldButton("TIPO_VIOLENCIA", "Detalle ↗")}</div></article><article class="panel">${panelHeading("Nivel de riesgo", "Valoración registrada en la atención")}<div class="risk-list">${risk.map((r, i) => bar(r, result.total, result.total, norm(r.label).includes("severo") ? colors[2] : colors[i])).join("")}</div><div class="panel-footer"><span>Porcentaje sobre la selección</span>${fieldButton("NIVEL_DE_RIESGO_VICTIMA", "Detalle ↗")}</div></article></div></div><article class="panel wide-panel">${panelHeading("Evolución de los casos atendidos", "Mes de ingreso al servicio · Solo los meses seleccionados", '<span class="panel-tag">' + esc(D.meta.period.split(" ").slice(-1)[0]) + '</span>')}<div id="trend-chart" class="trend-chart" role="img" aria-label="Casos por mes de ingreso"></div><div class="insight">${esc(monthlyInsight())}</div></article>`;
    renderMap(); renderViolence(); renderTrend("trend-chart");
    $("rank-view").onclick = () => mapMode(false);
    $("map-view").onclick = () => mapMode(true);
  }
  function mapMode(showMap) {
    $("map-chart").hidden = !showMap; $("rank-list").hidden = showMap;
    $("map-top").hidden = !showMap; $("map-instruction").hidden = !showMap;
    $("rank-view").classList.toggle("selected", !showMap); $("map-view").classList.toggle("selected", showMap);
    if (showMap) charts.forEach(c => c.resize());
  }
  function renderMap() {
    const geo = window.GEODATA_DEPT;
    const featureNames = geo.features.map(f => f.properties.nombdep);
    echarts.registerMap("peru-pagina2", geo);
    const mapData = D.departments.map((name, i) => ({ name: featureNames.find(n => norm(n) === norm(name)) || name, value: result.territorial[i] })).filter(item => item.value > 0);
    const map = chart("map-chart", {
      tooltip: { trigger: "item", formatter: p => p.data && p.value > 0 ? `${esc(p.name)}<br><strong>${E.fmt(p.value)}</strong> casos` : "" },
      visualMap: { min: 0, max: Math.max(1, ...result.territorial), calculable: false, orient: "vertical", left: 12, bottom: 18, itemWidth: 7, itemHeight: 65, text: ["Más", "Menos"], textStyle: { color: "#849799", fontSize: 8 }, inRange: { color: ["#e8f3ef", "#82b9aa", "#126e66"] } },
      series: [{ type: "map", map: "peru-pagina2", nameProperty: "nombdep", roam: false, layoutCenter: ["53%", "49%"], layoutSize: "106%", data: mapData, itemStyle: { borderColor: "#fff", borderWidth: 1, areaColor: "#edf4f2" }, emphasis: { label: { show: true, fontSize: 10, color: "#143f43" }, itemStyle: { areaColor: "#d2b081" } }, select: { disabled: true } }]
    });
    map.on("click", p => {
      if (!p.data || !(p.value > 0)) return;
      const index = D.departments.findIndex(n => norm(n) === norm(p.name));
      if (index >= 0) { filters.departments = [index]; syncDraft(); refresh(); }
    });
  }
  function renderViolence() {
    const data = rows("TIPO_VIOLENCIA").filter(r => !r.missing);
    $("violence-legend").innerHTML = data.map((r, i) => `<div class="legend-row"><i style="background:${colors[i]}"></i><span>${esc(r.label)}</span><strong>${E.pct(r.count, result.total)}</strong></div>`).join("");
    chart("violence-chart", { color: colors, tooltip: { trigger: "item", formatter: p => `${esc(p.name)}: ${E.fmt(p.value)} (${E.pct(p.value, result.total)})` },
      graphic: [{ type: "text", left: "center", top: "42%", style: { text: E.fmt(result.total), fill: "#23494a", fontSize: 20, fontWeight: 700 } }, { type: "text", left: "center", top: "57%", style: { text: "CASOS", fill: "#91a3a4", fontSize: 8 } }],
      series: [{ type: "pie", radius: ["66%", "88%"], center: ["50%", "50%"], label: { show: false }, emphasis: { scale: false }, itemStyle: { borderWidth: 3, borderColor: "white", borderRadius: 3 }, data: data.map(r => ({ name: r.label, value: r.count })) }]
    });
  }
  function monthlyInsight() {
    if (!result.total) return "Sin casos para esta selección.";
    const values = filters.months.map(i => ({ label: D.months[i].title, count: result.monthly[i] }));
    const max = Math.max(...values.map(v => v.count));
    const top = values.filter(v => v.count === max);
    return top.length === 1 ? `${top[0].label} registra la mayor cantidad del periodo seleccionado: ${E.fmt(max)} casos (${E.pct(max, result.total)}). La serie representa ingresos al servicio, no fechas de ocurrencia de la violencia.` : `${top.length} meses comparten el mayor conteo, con ${E.fmt(max)} casos cada uno. La serie representa ingresos al servicio.`;
  }
  function renderTrend(host) {
    chart(host, { tooltip: { trigger: "axis", valueFormatter: n => E.fmt(n) + " casos" }, grid: { left: 55, right: 30, top: 35, bottom: 35 },
      xAxis: { type: "category", data: filters.months.map(i => D.months[i].title.split(" ")[0].slice(0, 3)), axisTick: { show: false }, axisLine: { lineStyle: { color: "#e5eeeb" } }, axisLabel: { color: "#8c9d9f", fontSize: 10 } },
      yAxis: { type: "value", axisLabel: { color: "#8c9d9f", fontSize: 9 }, splitLine: { lineStyle: { color: "#edf2f1", type: "dashed" } } },
      series: [{ type: "line", data: filters.months.map(i => result.monthly[i]), connectNulls: false, smooth: false, symbol: "circle", symbolSize: 6, lineStyle: { color: colors[0], width: 2.5 }, itemStyle: { color: colors[0] }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#c9e6db88" }, { offset: 1, color: "#ffffff00" }] } }, label: { show: true, position: "top", fontSize: 9, color: "#537b70", formatter: p => E.fmt(p.value) } }]
    });
  }
  function card(f) {
    const data = sortedRows(f), missing = result.vector[f.offset + f.missingIndex], registered = result.total - missing;
    const preview = data.slice(0, 5), max = data[0]?.count || 0;
    const categoryRows = E.distribution(f, result).filter(r => !r.missing);
    const binaryRows = categoryRows;
    const binary = binaryRows.length === 2 && binaryRows.every(r => ["si", "no"].includes(norm(r.label)));
    const vertical = !binary && categoryRows.length >= 2 && categoryRows.length < 5;
    let content;
    if (binary && registered) {
      const yes = binaryRows.find(r => norm(r.label) === "si");
      const no = binaryRows.find(r => norm(r.label) === "no");
      const yesPct = yes.count * 100 / registered;
      content = `<div class="binary-donut-wrap"><div class="binary-donut" role="img" aria-label="Sí: ${E.pct(yes.count, registered)}; No: ${E.pct(no.count, registered)}" style="--yes-angle:${yesPct * 3.6}deg"><div><strong>${E.pct(yes.count, registered)}</strong><span>Sí</span></div></div><div class="binary-legend"><div><i class="yes"></i><span>Sí</span><strong>${E.fmt(yes.count)}</strong><em>${E.pct(yes.count, registered)}</em></div><div><i class="no"></i><span>No</span><strong>${E.fmt(no.count)}</strong><em>${E.pct(no.count, registered)}</em></div></div></div>`;
    } else if (vertical) {
      const verticalMax = Math.max(...categoryRows.map(r => r.count), 1);
      content = `<div class="vertical-bars" role="img" aria-label="Distribución de ${esc(f.title)}">${categoryRows.map((r, i) => `<div class="vertical-bar-item" title="${esc(r.label)}: ${E.fmt(r.count)} (${E.pct(r.count, result.total)})"><div class="vertical-value"><strong>${E.fmt(r.count)}</strong><span>${E.pct(r.count, result.total)}</span></div><div class="vertical-track"><span style="height:${r.count * 100 / verticalMax}%;background:${colors[i % colors.length]}"></span></div><div class="vertical-label">${esc(r.label)}</div></div>`).join("")}</div>`;
    } else {
      content = preview.length ? preview.map(r => bar(r, result.total, max)).join("") : '<p class="muted" style="font-size:12px;line-height:1.7">Sin respuestas registradas para esta selección.</p>';
    }
    return `<article class="panel indicator-card ${binary ? "binary-card" : vertical ? "vertical-card" : ""}">${`<div class="panel-heading"><div><span class="eyebrow" style="font-size:8px;letter-spacing:.8px">${esc(groupTitle(f.section))}</span><h3>${esc(f.title)}</h3></div></div>`}<div class="panel-body">${content}${!binary && !vertical && data.length > 5 ? `<span class="quality-label">${data.length - 5} categorías adicionales en el detalle</span>` : ""}<div class="coverage"><span style="width:${result.total ? registered * 100 / result.total : 0}%"></span></div><span class="quality-label">Con registro: ${E.fmt(registered)} / ${E.fmt(result.total)}</span></div><div class="panel-footer"><span>${binary ? "% de respuestas registradas" : "% de la selección"}</span>${fieldButton(f.id, "Tabla y análisis ↗")}</div></article>`;
  }
  function renderCatalog() {
    const fields = visibleFields();
    $("section-caption").textContent = `${fields.length} indicadores ${search ? "encontrados" : "disponibles"} · ${Math.min(pageLimit, fields.length)} visibles`;
    $("dashboard").innerHTML = fields.length ? `<div class="indicator-grid">${fields.slice(0, pageLimit).map(card).join("")}</div>${fields.length > pageLimit ? `<button class="button view-more" id="more-indicators">Mostrar ${Math.min(12, fields.length - pageLimit)} indicadores más</button>` : ""}` : '<div class="empty-state"><strong>No encontramos ese indicador</strong><p>Prueba con otra palabra, como «riesgo», «salud» o «denuncia».</p></div>';
    if ($("more-indicators")) $("more-indicators").onclick = () => { pageLimit += 12; renderCatalog(); };
  }
  function historical() {
    const national = filters.months.length === D.months.length && filters.departments.length === D.departments.length && ["total", "hombres", "mujeres"].includes(filters.population);
    $("dashboard").innerHTML = `<article class="panel">${panelHeading("Ingresos mensuales", "La serie respeta todos los filtros aplicados")}<div id="history-monthly" class="trend-chart" style="height:290px"></div><div class="insight">${esc(monthlyInsight())}</div></article><div class="wide-panel historical-note">El histórico 2021–2025 contiene años completos y proviene de la versión anterior; su fuente documental está pendiente de verificar. El dato de ${esc(D.meta.period)} es parcial. No se calculan variaciones entre años completos y el corte parcial.</div>${national ? `<article class="panel">${panelHeading("Referencia anual nacional", "Disponible para el total, hombres y mujeres, sin filtros territoriales ni mensuales")}<div id="history-annual" class="trend-chart" style="height:285px"></div></article>` : '<div class="empty-state"><strong>Histórico anual no disponible para este filtro</strong><p>La serie anterior no contiene los cruces de esta selección. Puedes consultar la evolución mensual de arriba.</p></div>'}`;
    renderTrend("history-monthly");
    if (national) {
      const years = Object.keys(D.annual.hombres);
      const values = years.map(y => filters.population === "total" ? D.annual.hombres[y] + D.annual.mujeres[y] : D.annual[filters.population][y]);
      chart("history-annual", { grid: { left: 70, right: 25, top: 40, bottom: 45 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: years.map((y, i) => i === years.length - 1 ? y + " (parcial)" : y), axisLabel: { fontSize: 10 } }, yAxis: { type: "value", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#edf2f1" } } }, series: [{ type: "bar", barMaxWidth: 55, label: { show: true, position: "top", fontSize: 10, formatter: p => E.fmt(p.value) }, data: values.map((value, i) => ({ value, itemStyle: { color: i === values.length - 1 ? colors[1] : colors[0], borderRadius: [5, 5, 0, 0] } })) }] });
    }
  }
  function refresh(recompute = true) {
    if (recompute) result = E.aggregate(D, filters);
    disposeCharts(); renderKpis();
    const section = D.sections.find(s => s.id === sectionId);
    $("page-title").textContent = search ? "Catálogo de indicadores" : section?.title || ({ panorama: "Panorama general", historico: "Evolución temporal", catalogo: "Catálogo de indicadores" }[sectionId]);
    $("page-description").textContent = search ? `Resultados para «${search}» en todos los rubros.` : section?.description || (sectionId === "panorama" ? "Una mirada integral a los casos atendidos por los CEM." : sectionId === "historico" ? "Observa la distribución de los ingresos en el tiempo." : "Explora todas las variables esquematizadas de la base.");
    document.querySelectorAll("[data-section]").forEach(b => { b.classList.toggle("active", b.dataset.section === (search ? "catalogo" : sectionId)); b.setAttribute("aria-current", b.classList.contains("active") ? "page" : "false"); });
    $("section-caption").textContent = `Lectura de la selección · ${E.fmt(result.total)} casos`;
    if (!result.total) $("dashboard").innerHTML = '<div class="empty-state"><strong>No hay casos con estos filtros</strong><p>Amplía el periodo o los departamentos para explorar los indicadores.<br>El reporte conservará esta selección e indicará la ausencia de resultados.</p><button id="empty-reset" class="button" style="margin-top:17px">Restablecer filtros</button></div>';
    else if (!search && sectionId === "panorama") overview();
    else if (!search && sectionId === "historico") historical();
    else renderCatalog();
    if ($("empty-reset")) $("empty-reset").onclick = reset;
    $("download-report").disabled = false;
    $("footer-count").textContent = `${D.meta.indicators} indicadores · ${D.meta.variables} variables revisadas`;
  }
  function reset() {
    filters = { population: "total", months: [D.months[D.months.length - 1].id], departments: D.departments.map((_, i) => i) };
    syncDraft(); $("filter-hint").textContent = "Filtros restablecidos."; refresh();
  }
  function tableHTML(f) {
    const distribution = E.distribution(f, result), registered = result.total - distribution[f.missingIndex].count;
    const visible = f.id === "DPTO_UBI_CEM" ? distribution.filter(r => r.count > 0) : distribution.filter(r => r.count || !r.missing);
    return `<div class="table-wrap"><table><thead><tr><th>Categoría</th><th class="numeric">Casos</th><th class="numeric">% selección</th><th class="numeric">% con registro</th></tr></thead><tbody>${visible.map(r => `<tr class="${r.missing ? "missing" : ""}"><td>${esc(r.label)}</td><td class="numeric">${E.fmt(r.count)}</td><td class="numeric">${E.pct(r.count, result.total)}</td><td class="numeric">${r.missing ? "—" : E.pct(r.count, registered)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function detail(id) {
    detailField = byId.get(id); const f = detailField;
    $("detail-title").textContent = f.title;
    $("detail-content").innerHTML = `<p class="muted">${esc(E.filterDescription(D, filters).population)} · ${E.fmt(result.total)} casos seleccionados</p><div class="insight" style="margin:0 0 18px">${esc(E.interpret(f, result))}</div>${tableHTML(f)}<h3>Cómo leer este indicador</h3><p class="muted">${esc(f.note)}</p><p class="muted">El porcentaje con registro usa únicamente las respuestas registradas para este indicador. Una respuesta «No sabe/no responde» se conserva como categoría registrada. Las marcas múltiples pueden coexistir en un mismo caso.</p><p class="muted">Variable de origen: <code>${esc(f.id)}</code></p>`;
    $("detail-dialog").showModal();
  }
  function csvDownload() {
    const f = detailField, description = E.filterDescription(D, filters), registered = result.total - result.vector[f.offset + f.missingIndex];
    const distribution = E.distribution(f, result).filter(r => f.id !== "DPTO_UBI_CEM" || r.count > 0);
    const rows = [["Indicador", f.title], ["Población", description.population], ["Meses", description.months], ["Departamentos", description.departments], ["Base seleccionada", result.total], ["Base con registro", registered], [], ["Categoría", "Casos", "% selección", "% con registro"], ...distribution.map(r => [r.label, r.count, E.pct(r.count, result.total), r.missing ? "" : E.pct(r.count, registered)])];
    const text = "\ufeff" + rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `CEM_${f.id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function methodology() {
    const partial = D.fields.filter(f => f.registered < D.meta.rows).length;
    $("method-content").innerHTML = `<p><strong>${E.fmt(D.meta.rows)} registros · ${D.meta.variables} variables revisadas · ${D.meta.indicators} indicadores agregados.</strong></p><p>Fuente: ${esc(D.meta.source)}. Corte ${esc(D.meta.period)}, preliminar. Generado el ${esc(D.meta.generated.replace("T", " a las "))}.</p><h3>Filtros y unidades</h3><ul><li>Mes: fecha de ingreso al CEM. Departamento: ubicación del servicio, no residencia ni lugar del hecho.</li><li>Se pueden combinar meses y departamentos. Las poblaciones se seleccionan de una en una porque pueden solaparse.</li><li>Alcohol y drogas: estado de la presunta persona agresora en la última agresión, códigos 2, 3 o 4. LGBTI y extranjeras: indicadores de reporte de la fuente. Gestantes: gestación registrada.</li><li>Los conteos corresponden a registros de casos; no a personas únicas ni a prevalencia.</li></ul><h3>Porcentajes y cobertura</h3><p>Las tarjetas usan como denominador todos los casos seleccionados. Las tablas también muestran el porcentaje entre quienes tienen respuesta registrada. Los valores vacíos se presentan como «Sin registro / no aplicable» y nunca se convierten automáticamente en «No».</p><p>${partial} indicadores tienen cobertura parcial en el corte nacional. Las respuestas múltiples pueden coexistir y no deben sumarse como personas distintas.</p><h3>Comprobaciones realizadas</h3><p>Los totales de las seis poblaciones coinciden con la versión anterior. Se verificaron ${D.meta.checks} combinaciones de filtros contra la fuente, incluyendo todos los indicadores.</p><ul>${D.audit.relationships.map(r => `<li><strong>${esc(byId.get(r.field).title)}</strong>: ${E.fmt(r.registered)} respuestas; ${r.registered_outside_condition} fuera de la condición y ${r.eligible_without_registration} sin respuesta dentro de la condición verificada.</li>`).join("")}</ul><h3>Alcance de publicación</h3><p>Se publican exclusivamente distribuciones agregadas. ${D.meta.variables - D.meta.indicators} variables quedan documentadas como filtros derivados o campos no publicados: identificadores, fechas exactas, texto libre y variables sin categorías verificadas. Los motivos narrativos para no denunciar requieren una clasificación revisada antes de producir estadísticas.</p><h3>Interpretaciones e histórico</h3><p>Los comentarios son descripciones calculadas: no establecen causas, diagnósticos ni eficacia institucional. Las medidas solicitadas, concedidas y ejecutadas se muestran como indicadores independientes; no se asume que constituyen un embudo de una misma cohorte. El histórico anual anterior es una referencia nacional con fuente documental pendiente de verificar.</p><div class="method-links"><a class="button" href="data/diccionario_variables.csv" download>Descargar diccionario completo</a><a class="button" href="data/validacion.json" download>Descargar comprobaciones</a></div>`;
    $("method-dialog").showModal();
  }
  function selectedReportFields() {
    const scope = $("report-scope").value;
    if (scope === "all") return D.fields;
    if (scope === "summary" || (!search && ["panorama", "historico"].includes(sectionId))) return summaryIds.map(id => byId.get(id)).filter(Boolean);
    return visibleFields();
  }
  function reportInfo() {
    $("report-size").textContent = `${selectedReportFields().length} indicadores. Incluye todas sus categorías, no solo las visibles en pantalla. El informe completo puede tener muchas páginas.`;
  }
  function openReport() {
    const d = E.filterDescription(D, filters);
    $("report-filter-summary").innerHTML = `<strong>${esc(d.population)} · ${E.fmt(result.total)} casos</strong><br>${esc(d.months)}<br>${esc(d.departments)}`;
    $("report-scope").value = sectionId === "panorama" || sectionId === "historico" ? "summary" : "section";
    $("report-status").textContent = ""; reportInfo(); $("report-dialog").showModal();
  }
  async function generateReport() {
    const button = $("generate-report"); button.disabled = true; $("report-status").textContent = "Preparando el PDF…";
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      const report = await window.DashReport.create({ data: D, filters: structuredClone(filters), result, fields: selectedReportFields(), scope: $("report-scope").selectedOptions[0].textContent, sectionTitle: $("page-title").textContent });
      report.save(`CEM_reporte_${filters.population}_${new Date().toISOString().slice(0, 10)}.pdf`);
      $("report-status").textContent = "PDF generado. La descarga incluye los filtros aplicados.";
    } catch (error) {
      console.error(error); $("report-status").textContent = "No se pudo generar el PDF. " + error.message;
    } finally { button.disabled = false; }
  }
  function setSection(id) {
    sectionId = id; search = ""; pageLimit = 12; $("indicator-search").value = "";
    document.body.classList.remove("menu-open"); refresh(false); window.scrollTo({ top: 0, behavior: "instant" });
  }
  function bind() {
    document.addEventListener("click", event => {
      const section = event.target.closest("[data-section]"); if (section) setSection(section.dataset.section);
      const population = event.target.closest("[data-population]");
      if (population && population.dataset.population !== filters.population) {
        filters.population = population.dataset.population;
        syncDraft(); refresh();
      }
      const info = event.target.closest("[data-detail]"); if (info) detail(info.dataset.detail);
      const close = event.target.closest("[data-close]"); if (close) $(close.dataset.close).close();
      const only = event.target.closest("[data-department-only]");
      if (only) {
        const selected = Number(only.dataset.departmentOnly);
        document.querySelectorAll("#departments-options input").forEach(input => { input.checked = Number(input.value) === selected; });
        applyDepartmentDraft();
      }
      const select = event.target.closest("[data-select]"); if (select) {
        document.querySelectorAll(`#${select.dataset.select}-options input`).forEach(i => { i.checked = select.dataset.value === "all"; });
        if (select.dataset.value === "all") applyDepartmentDraft(); else draftCaptions();
      }
    });
    $("apply-filters").onclick = () => { if (applyDepartmentDraft(true)) document.body.classList.remove("menu-open"); };
    $("reset").onclick = reset;
    $("departments-options").addEventListener("change", event => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      if (!applyDepartmentDraft()) {
        event.target.checked = true;
        draftCaptions();
      }
    });
    $("header-month").onchange = event => {
      filters.months = event.target.value === "all" ? D.months.map(month => month.id) : [Number(event.target.value)];
      $("filter-hint").textContent = "Mes aplicado al dashboard y al reporte.";
      refresh();
    };
    $("dept-search").oninput = event => { document.querySelectorAll("#departments-options .picker-option").forEach(option => { option.hidden = !norm(option.querySelector("label").textContent).includes(norm(event.target.value)); }); };
    let timer;
    $("indicator-search").oninput = event => { clearTimeout(timer); search = event.target.value.trim(); pageLimit = 12; timer = setTimeout(() => refresh(false), 150); };
    $("menu-button").onclick = () => {
      const mobile = window.innerWidth <= 960;
      document.body.classList.toggle(mobile ? "menu-open" : "sidebar-collapsed");
      $("menu-button").setAttribute("aria-expanded", mobile ? document.body.classList.contains("menu-open") : !document.body.classList.contains("sidebar-collapsed"));
      setTimeout(() => charts.forEach(c => c.resize()), 230);
    };
    $("backdrop").onclick = () => { document.body.classList.remove("menu-open"); $("menu-button").setAttribute("aria-expanded", "false"); };
    $("method-button").onclick = methodology; $("detail-csv").onclick = csvDownload;
    $("download-report").onclick = openReport; $("report-scope").onchange = reportInfo; $("generate-report").onclick = generateReport;
    window.addEventListener("resize", () => charts.forEach(c => c.resize()));
    document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); $("indicator-search").focus(); } });
  }
  try {
    if (!D || !E) throw new Error("No se pudo cargar data/data.js. Comprueba que todos los archivos de pagina2 estén presentes.");
    buildNav(); syncDraft(); bind(); $("source-period").textContent = D.meta.period;
    $("menu-button").setAttribute("aria-expanded", window.innerWidth > 960 ? "true" : "false");
    refresh();
    // Read-only hooks for reproducible checks of the shared calculation contract.
    window.Dashboard = { getState: () => ({ filters: structuredClone(filters), result, section: sectionId }), getReportFields: selectedReportFields };
  } catch (error) {
    console.error(error); $("error").hidden = false; $("error").textContent = error.message; $("dashboard").innerHTML = "";
  }
})();
