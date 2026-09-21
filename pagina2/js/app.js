(function () {
  "use strict";
  const D = window.DASH_DATA, E = window.DashEngine;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const themes = {
    total: { primary: "#147d77", deep: "#133f43", mint: "#e4f3ef", accent: "#b24c73", mid: "#82b9aa", pale: "#e8f3ef", colors: ["#247f79", "#cf8c62", "#af5f80", "#88aaa9", "#8b91ba", "#b2bd83"] },
    mujeres: { primary: "#a13f6b", deep: "#5b2440", mint: "#f8e8ef", accent: "#d47b9f", mid: "#d18ca8", pale: "#f9edf2", colors: ["#a13f6b", "#d484a5", "#7b5f9c", "#d39468", "#668f91", "#b6a06a"] },
    hombres: { primary: "#286da8", deep: "#173f63", mint: "#e7f1fa", accent: "#4b94cf", mid: "#83b3d8", pale: "#edf5fb", colors: ["#286da8", "#639aca", "#596fa8", "#cf8c62", "#5e9793", "#9b8eb7"] },
    alcohol: { primary: "#a45f13", deep: "#59380f", mint: "#f8eddd", accent: "#d99035", mid: "#d2a363", pale: "#fbf3e8", colors: ["#a45f13", "#d58b35", "#8c6f45", "#b85d50", "#6f8b76", "#9a78a5"] },
    lgtbi: { primary: "#7551a6", deep: "#3f2b62", mint: "#f0eafb", accent: "#bd5c91", mid: "#aa91ca", pale: "#f4effa", colors: ["#7551a6", "#bd5c91", "#4c8ba4", "#d18752", "#579475", "#b39b48"] },
    extranjeras: { primary: "#39717d", deep: "#234852", mint: "#e5f1f3", accent: "#d47a58", mid: "#83adb5", pale: "#edf6f7", colors: ["#39717d", "#d47a58", "#6b83ad", "#9b668c", "#7c9b68", "#b09554"] },
    gestantes: { primary: "#bd5d55", deep: "#6a3430", mint: "#faeae8", accent: "#d78a72", mid: "#d99a94", pale: "#fcf0ee", colors: ["#bd5d55", "#d78a72", "#9c668c", "#c59a4e", "#668f91", "#8584ae"] }
  };
  const paletteThemes = {
    oceanico: { title: "Oceánico", note: "Azules y verdes", primary: "#087f8c", deep: "#164b68", mint: "#e3f3f4", accent: "#ef476f", mid: "#48b8bd", pale: "#eef8f8", colors: ["#2774cf", "#087f8c", "#11b99a", "#ffad0a", "#7442d8", "#ef2150"] },
    crepusculo: { title: "Crepúsculo", note: "Violetas e índigos", primary: "#6254c7", deep: "#302b63", mint: "#efedfb", accent: "#e94b91", mid: "#9a8ce0", pale: "#f5f3fc", colors: ["#8447cf", "#7868e6", "#5271c8", "#3294d1", "#e94b91", "#9361df"] },
    tierra: { title: "Tierra", note: "Naranjas y verdes cálidos", primary: "#a85d08", deep: "#57370e", mint: "#f7eddd", accent: "#e7522d", mid: "#d19a49", pale: "#fbf5e9", colors: ["#ff7622", "#e67e00", "#7acb10", "#078c79", "#c68708", "#e23437"] },
    glacial: { title: "Glacial", note: "Azul hielo corporativo", primary: "#1689b4", deep: "#23435d", mint: "#e5f3f8", accent: "#37b8ea", mid: "#79bdd5", pale: "#eff8fb", colors: ["#117ea9", "#0995b8", "#139fd2", "#38b9ea", "#53657b", "#6c7c91"] },
    coral: { title: "Coral", note: "Rosas y corales", primary: "#c44768", deep: "#6b3046", mint: "#fae8ee", accent: "#ff7043", mid: "#df8da3", pale: "#fcf0f3", colors: ["#f54262", "#ff6f20", "#a92ac2", "#f5c92e", "#f17a8e", "#ca43d5"] },
    selva: { title: "Selva", note: "Verdes profundos", primary: "#168348", deep: "#16462d", mint: "#e4f3e9", accent: "#7cc70c", mid: "#6aae82", pale: "#edf7f0", colors: ["#198843", "#1ca24b", "#48ce72", "#4e8212", "#79c90c", "#087548"] },
    grises: { title: "Neutro", note: "Colores semánticos atenuados", primary: "#565b60", deep: "#1c1e20", mint: "#eceeef", accent: "#858a90", mid: "#a9adb1", pale: "#f4f5f5", colors: ["#17191b", "#4b5054", "#767b80", "#9a9ea2", "#bcc0c3", "#64686c"] }
  };
  let paletteChoice = "default";
  let theme = themes.total, colors = theme.colors;
  let charts = [], pageLimit = 12, sectionId = "panorama", search = "", detailField = null, result, fullscreenKey = null, relationshipGrouped = true, mapPulseTimer = null;
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
  function palettePopulationTheme(base, population) {
    const semantic = themes[population] || themes.total;
    const profile = {
      oceanico: { target: "#071b24", amount: .03 }, crepusculo: { target: "#171126", amount: .12 },
      tierra: { target: "#2d1d0c", amount: .06 }, glacial: { target: "#ffffff", amount: .18 },
      coral: { target: "#ffffff", amount: .04 }, selva: { target: "#092417", amount: .11 },
      grises: { target: "#ffffff", amount: .32 }
    }[paletteChoice] || { target: "#ffffff", amount: 0 };
    const sourcePrimary = population === "total" ? base.primary : semantic.primary;
    const sourceAccent = population === "total" ? base.accent : semantic.accent;
    const amount = population === "total" ? 0 : profile.amount;
    const primary = mixHex(sourcePrimary, profile.target, amount);
    const accent = mixHex(sourceAccent, profile.target, Math.min(amount, .18));
    const sourceColors = population === "total" ? base.colors : semantic.colors;
    const adjustedColors = sourceColors.map(color => mixHex(color, profile.target, amount));
    return { primary, deep: mixHex(primary, "#101820", .58), mint: mixHex(primary, "#ffffff", .88), accent, mid: mixHex(primary, "#ffffff", .48), pale: mixHex(primary, "#ffffff", .94), colors: [primary, ...adjustedColors.filter(color => color !== primary)].slice(0, 6) };
  }
  function applyTheme(population) {
    theme = themes[population] || themes.total;
    colors = paletteChoice === "default" ? theme.colors : (paletteThemes[paletteChoice]?.colors || theme.colors);
    const root = document.documentElement;
    root.dataset.theme = population;
    [["--teal", theme.primary], ["--deep", theme.deep], ["--mint", theme.mint], ["--pink", theme.accent], ["--viz-primary", theme.primary], ["--viz-deep", theme.deep], ["--viz-mint", theme.mint], ["--viz-accent", theme.accent], ["--theme-mid", theme.mid], ["--theme-pale", theme.pale], ["--theme-border", mixHex(theme.pale, theme.primary, .34)], ["--chart-color-1", colors[0]]].forEach(([name, value]) => root.style.setProperty(name, value));
  }
  function buildPaletteGrid() {
    const entries = [{ id: "default", title: "Por población", note: "Colores automáticos del sistema", colors: themes.total.colors }, ...Object.entries(paletteThemes).map(([id, value]) => ({ id, ...value }))];
    $("palette-grid").innerHTML = entries.map(item => `<button type="button" class="palette-option" data-palette="${item.id}" aria-pressed="false"><span class="palette-swatches">${item.colors.map(color => `<i style="background:${color}"></i>`).join("")}</span><strong>${item.title}</strong><small>${item.note}</small></button>`).join("");
  }
  function setPalette(id) {
    paletteChoice = id === "default" || paletteThemes[id] ? id : "default";
    try { localStorage.setItem("cem-color-palette", paletteChoice); } catch (_) {}
    document.querySelectorAll("[data-palette]").forEach(button => { const active = button.dataset.palette === paletteChoice; button.classList.toggle("active", active); button.setAttribute("aria-pressed", active ? "true" : "false"); });
    refresh();
  }
  function setThemeMode(mode) {
    const allowed = ["light", "dark", "contrast"];
    const selected = allowed.includes(mode) ? mode : "light";
    document.documentElement.dataset.mode = selected;
    if ($("theme-mode")) $("theme-mode").value = selected;
    try { localStorage.setItem("cem-theme-mode", selected); } catch (_) {}
    setTimeout(() => charts.forEach(chart => chart.resize()), 50);
  }
  function count(id, labelOrIndex) {
    const f = byId.get(id); if (!f) return 0;
    const i = typeof labelOrIndex === "number" ? labelOrIndex : f.labels.findIndex(s => norm(s).includes(norm(labelOrIndex)));
    return i < 0 ? 0 : result.vector[f.offset + i];
  }
  function chart(id, option) {
    const host = $(id); if (!host) return null;
    const instance = echarts.init(host);
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = Math.min(1.5, Math.max(1, window.innerWidth / 1440));
    const scalable = new Set(["fontSize", "lineHeight", "symbolSize", "barMaxWidth", "itemWidth", "itemHeight"]);
    const scaleOption = value => {
      if (!value || typeof value !== "object") return value;
      Object.entries(value).forEach(([key, child]) => {
        if (scalable.has(key) && typeof child === "number") value[key] = Math.round(child * scale * 10) / 10;
        else scaleOption(child);
      });
      return value;
    };
    instance.setOption(scaleOption({ animation: motion, animationDuration: 750, animationDurationUpdate: 450, animationEasing: "cubicOut", animationEasingUpdate: "cubicOut", textStyle: { fontFamily: '"Segoe UI", Arial, sans-serif', fontSize: 12 }, ...option }));
    charts.push(instance); return instance;
  }
  function disposeCharts() { if (mapPulseTimer) { clearInterval(mapPulseTimer); mapPulseTimer = null; } charts.forEach(c => c.dispose()); charts = []; }
  function enhancePanels() {
    document.querySelectorAll("#dashboard .panel").forEach(panel => {
      const heading = panel.querySelector(":scope > .panel-heading");
      if (!heading || heading.querySelector("[data-expand-panel]")) return;
      panel.dataset.panelKey = heading.querySelector("h2,h3")?.textContent.trim() || "panel";
      heading.insertAdjacentHTML("beforeend", '<button type="button" class="panel-expand" data-expand-panel aria-label="Ampliar gráfico" title="Ampliar gráfico">⛶</button>');
    });
  }
  function togglePanelFullscreen(panel, forceClose = false) {
    const current = document.querySelector(".fullscreen-panel");
    if (current && (forceClose || current === panel)) {
      current.classList.remove("fullscreen-panel");
      const button = current.querySelector("[data-expand-panel]");
      if (button) { button.textContent = "⛶"; button.title = "Ampliar gráfico"; button.setAttribute("aria-label", "Ampliar gráfico"); }
      document.body.classList.remove("panel-expanded");
      fullscreenKey = null;
    } else if (panel) {
      if (current) togglePanelFullscreen(current, true);
      panel.classList.add("fullscreen-panel");
      const button = panel.querySelector("[data-expand-panel]");
      if (button) { button.textContent = "×"; button.title = "Cerrar vista ampliada"; button.setAttribute("aria-label", "Cerrar vista ampliada"); }
      document.body.classList.add("panel-expanded");
      fullscreenKey = panel.dataset.panelKey;
    }
    setTimeout(() => charts.forEach(chart => chart.resize()), 180);
  }
  function panelHeading(title, sub, action = "") { return `<div class="panel-heading"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${action}</div>`; }
  function bar(row, base, max, color = colors[0]) {
    return `<div class="bar-row"><div class="bar-label"><span>${esc(row.label)}</span><strong>${E.fmt(row.count)} <em>${row.percentLabel || E.pct(row.count, base)}</em></strong></div><div class="bar-track"><div class="bar-fill" style="width:${max ? row.count * 100 / max : 0}%;background:${color}"></div></div></div>`;
  }
  function exactShareLabels(rows) {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    if (!total) return rows.map(() => "—");
    const raw = rows.map(row => row.count * 1000 / total), tenths = raw.map(Math.floor);
    let remaining = 1000 - tenths.reduce((sum, value) => sum + value, 0);
    raw.map((value, index) => ({ index, fraction: value - tenths[index] })).sort((a, b) => b.fraction - a.fraction).slice(0, remaining).forEach(item => tenths[item.index]++);
    return tenths.map(value => (value / 10).toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%");
  }
  function sexualModalities() {
    const rows = [
      ["ACOSO_SEX_ESP_PUB", "Acoso sexual en espacios públicos"],
      ["HOSTIGAMIENTO_SEXUAL", "Hostigamiento sexual"],
      ["TRATA_CON_FINES_EXPLOTACION_SEXUAL", "Trata con fines de explotación sexual"],
      ["VIOLACION", "Violación sexual"]
    ].map(([id, label]) => ({ id, label, count: count(id, "si") }));
    const labels = exactShareLabels(rows);
    return rows.map((row, index) => ({ ...row, percentLabel: labels[index] }));
  }
  function verticalDistribution(distribution, base) {
    const relational = distribution.some(row => ["pareja", "familiar", "sin vinculo", "otro vinculo"].some(value => norm(row.label).includes(value)));
    const max = Math.max(...distribution.map(row => row.count), 1);
    if (relational) return `<div class="relational-list" tabindex="0" aria-label="Distribución por vínculo relacional">${distribution.map((row, i) => bar(row, base, max, colors[i % colors.length])).join("")}</div>`;
    return `<div class="vertical-bars">${distribution.map((row, i) => `<div class="vertical-bar-item"><div class="vertical-value"><strong>${E.fmt(row.count)}</strong><span>${E.pct(row.count, base)}</span></div><div class="vertical-track"><span style="height:${row.count * 100 / max}%;background:${colors[i % colors.length]}"></span></div><div class="vertical-label">${esc(row.label)}</div></div>`).join("")}</div>`;
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
    $("navigation").innerHTML = nav("panorama", "Panorama general", "▦") + D.sections.map((s, i) => nav(s.id, s.title, icons[i], D.fields.filter(f => f.section === s.id).length)).join("");
    $("population-buttons").innerHTML = D.populations.map(p => `<button type="button" class="population-button" data-population="${p.id}" aria-pressed="false" style="--population-color:${themes[p.id]?.primary || themes.total.primary};--population-soft:${themes[p.id]?.mint || themes.total.mint}">${esc(p.title)}</button>`).join("");
    $("header-month").innerHTML = `<option value="all">Todo el periodo</option>${D.months.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join("")}`;
    $("departments-options").innerHTML = D.departments.map((label, i) => `<div class="picker-option"><label><input type="checkbox" value="${i}" checked> <span>${esc(label)}</span></label><button type="button" class="select-only" data-department-only="${i}" aria-label="Seleccionar solo ${esc(label)}">Solo este</button></div>`).join("");
  }
  function syncDraft() {
    document.querySelectorAll("[data-population]").forEach(button => {
      const active = button.dataset.population === filters.population;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const activePopulation = document.querySelector("[data-population].active"), populationNav = $("population-buttons");
    if (activePopulation && populationNav) {
      const target = activePopulation.offsetLeft - (populationNav.clientWidth - activePopulation.offsetWidth) / 2;
      populationNav.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
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
      ["Casos atendidos", result.total, `${E.pct(result.total, D.meta.rows)} del corte nacional`, "featured", "↗"],
      ["Niñas, niños y adolescentes", children, `${E.pct(children, result.total)} de los casos seleccionados`, "", "♙"],
      ["Riesgo severo", severe, `${E.pct(severe, result.total)} de los casos seleccionados`, "", "◇"],
      ["Departamentos con casos", deptN, `${filters.departments.length} departamentos seleccionados`, "", "⌖"]
    ];
    $("kpis").innerHTML = kpis.map(([label, value, note, cls, icon]) => `<article class="kpi ${cls}"><p class="kpi-label">${label}</p><span class="kpi-decoration" aria-hidden="true">${icon}</span><div class="kpi-value" data-count="${value}">${E.fmt(value)}</div><p class="kpi-note">${note}</p></article>`).join("");
    animateCounts();
    const desc = E.filterDescription(D, filters);
    $("active-filters").innerHTML = `<strong>Filtros aplicados:</strong><span><b>Población:</b> ${esc(desc.population)}</span><span><b>Mes:</b> ${esc(desc.months)}</span><span><b>Departamento de atención:</b> ${esc(desc.departments)}</span>`;
  }
  function animateCounts() {
    const elements = document.querySelectorAll("[data-count]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = 850, started = performance.now();
    const values = [...elements].map(element => ({ element, target: Number(element.dataset.count), start: Math.floor(Number(element.dataset.count) * .8) }));
    values.forEach(item => { item.element.textContent = E.fmt(item.start); });
    const frame = now => {
      const progress = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - progress, 3);
      values.forEach(item => { item.element.textContent = E.fmt(Math.round(item.start + (item.target - item.start) * eased)); });
      if (progress < 1 && values.some(item => item.element.isConnected)) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function ageMarkup() {
    const age = E.ageSex(D, filters);
    const keys = [["nina", "nino"], ["nina2", "nino2"], ["nina3", "nino3"]];
    return `<article class="panel age-panel">${panelHeading("Las personas detrás de las cifras", "Grupos de edad diferenciados por sexo registrado", '<span class="panel-tag">CICLO DE VIDA</span>')}<div class="age-grid age-sex-grid">${age.map((group, i) => {
      const total = group.values.reduce((sum, item) => sum + item.count, 0), silhouettes = keys[i] || keys[2];
      return `<div class="age-card age-sex-card"><div class="age-band"><span class="age-band-icon" aria-hidden="true">${window.ICONS_SVG[silhouettes[0]] || ""}</span><span>${esc(group.label)}</span></div><div class="age-group-total"><strong>${E.fmt(total)}</strong><div><span class="age-pct">${E.pct(total, result.total)}</span><small>del total</small></div></div><div class="age-sex-pairs">${group.values.map((item, sexIndex) => { const share = total ? item.count * 100 / total : 0; return `<div class="age-sex-person ${item.count ? "" : "is-zero"} ${filters.population === (sexIndex ? "hombres" : "mujeres") ? "is-selected" : ""}" title="${esc(group.label)} · ${esc(item.label)}: ${E.fmt(item.count)} casos (${E.pct(item.count, total)})"><div class="age-sex-silhouette" aria-hidden="true">${window.ICONS_SVG[silhouettes[sexIndex]] || ""}</div><div class="age-sex-data"><span>${esc(item.label)}</span><b>${E.fmt(item.count)}</b><em>${E.pct(item.count, total)}</em></div><i class="age-sex-progress" aria-hidden="true"><span style="width:${share}%"></span></i></div>`; }).join("")}</div></div>`;
    }).join("")}</div><div class="panel-footer"><span>Sexo registrado · % dentro de cada edad</span><button class="text-link" data-age-sex-detail>Tabla y análisis ↗</button></div></article>`;
  }
  function overview() {
    const risk = rows("NIVEL_DE_RIESGO_VICTIMA").filter(r => !r.missing);
    const riskMax = Math.max(...risk.map(row => row.count), 1);
    const riskChart = `<div class="risk-vertical vertical-bars">${risk.map((row, i) => `<div class="vertical-bar-item"><div class="vertical-value"><strong>${E.fmt(row.count)}</strong><span>${E.pct(row.count, result.total)}</span></div><div class="vertical-track"><span style="height:${row.count * 100 / riskMax}%;background:${norm(row.label).includes("severo") ? colors[2] : colors[i]}"></span></div><div class="vertical-label">${esc(row.label)}</div></div>`).join("")}</div>`;
    const ranked = D.departments.map((label, i) => ({ label, count: result.territorial[i] })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
    $("dashboard").innerHTML = `<div class="overview-grid"><article class="panel map-panel">${panelHeading("Distribución territorial", "Departamento donde se ubica el CEM", '<div class="segment"><button id="map-view" class="selected">Mapa</button><button id="rank-view">Ranking</button></div>')}<div class="map-wrap"><div id="map-chart" class="map-chart" role="img" aria-label="Mapa de casos por departamento"></div><div id="map-legend" class="map-legend" aria-label="Intervalos de casos"></div></div><div id="rank-list" class="panel-body" hidden>${ranked.map(r => bar(r, result.total, ranked[0].count)).join("")}</div><p class="map-caption" id="map-instruction">Selecciona un departamento en el mapa para filtrar.</p><div class="panel-footer"><span>Cantidad de casos, no tasas poblacionales</span>${fieldButton("DPTO_UBI_CEM", "Ver tabla ↗")}</div></article>${ageMarkup()}<div class="two-panels"><article class="panel">${panelHeading("Tipo de violencia", "Distribución de los casos registrados")}<div class="donut-wrap"><div id="violence-chart" class="donut-chart" role="img" aria-label="Distribución por tipo de violencia"></div><div class="legend" id="violence-legend"></div></div><div class="panel-footer"><span>Base: ${E.fmt(result.total)} casos</span>${fieldButton("TIPO_VIOLENCIA", "Detalle ↗")}</div></article><article class="panel">${panelHeading("Nivel de riesgo", "Valoración registrada en la atención")}<div class="risk-list">${risk.map((r, i) => bar(r, result.total, result.total, norm(r.label).includes("severo") ? colors[2] : colors[i])).join("")}</div><div class="panel-footer"><span>Porcentaje sobre la selección</span>${fieldButton("NIVEL_DE_RIESGO_VICTIMA", "Detalle ↗")}</div></article></div></div><article class="panel wide-panel">${panelHeading("Evolución de los casos atendidos", "Serie completa del periodo · El mes filtrado aparece destacado", '<span class="panel-tag">' + esc(D.meta.period.split(" ").slice(-1)[0]) + '</span>')}<div id="trend-chart" class="trend-chart" role="img" aria-label="Casos por mes de ingreso"></div><div class="insight">${esc(monthlyInsight())}</div></article>`;
    $("dashboard").querySelector(".map-wrap").insertAdjacentHTML("beforeend", `<button type="button" id="map-reset" class="map-reset-button" aria-label="Restablecer filtro territorial" title="Mostrar todos los departamentos" ${filters.departments.length === D.departments.length ? "hidden" : ""}>↺ Restablecer</button>`);
    $("dashboard").querySelector(".risk-list").outerHTML = riskChart;
    $("trend-chart").closest(".wide-panel").insertAdjacentHTML("beforebegin", panoramaExtras());
    renderMap(); renderViolence(); renderTrend("trend-chart");
    $("rank-view").onclick = () => mapMode(false);
    $("map-view").onclick = () => mapMode(true);
    if ($("map-reset")) $("map-reset").onclick = resetMapDepartment;
  }
  function resetMapDepartment() {
    filters.departments = D.departments.map((_, i) => i);
    syncDraft();
    $("filter-hint").textContent = "Filtro territorial restablecido desde el mapa.";
    refresh();
  }
  function panoramaExtras() {
    const civil = sortedRows(byId.get("ESTADO_CIVIL_VICTIMA"));
    const links = sortedRows(byId.get("VINCULO_GRUPAL"));
    const sexual = sexualModalities();
    const sexualTotal = sexual.reduce((sum, row) => sum + row.count, 0);
    const sexualMax = Math.max(...sexual.map(row => row.count), 1);
    return `<section class="panorama-extra-grid" aria-label="Indicadores complementarios"><article class="panel panorama-extra">${panelHeading("Estado civil de la persona usuaria", "Distribución de los casos seleccionados")}<div class="panel-body">${verticalDistribution(civil, result.total)}</div><div class="panel-footer"><span>% de la selección</span>${fieldButton("ESTADO_CIVIL_VICTIMA", "Tabla y análisis ↗")}</div></article><article class="panel panorama-extra relationship-panel">${panelHeading("Vínculo con la presunta persona agresora", "Pareja, familiar u otro vínculo")}<div class="panel-body">${relationshipDistribution(links)}</div><div class="panel-footer"><span>% de la selección</span>${fieldButton("VINCULO_GRUPAL", "Tabla y análisis ↗")}</div></article><article class="panel panorama-extra modalities-panel">${panelHeading("Modalidades de violencia sexual", "Composición de las modalidades mostradas · total 100%")}<div class="panel-body modality-list">${sexual.map((row, i) => bar(row, sexualTotal, sexualMax, colors[i % colors.length])).join("")}</div><div class="panel-footer"><span>Participación entre modalidades</span><div class="panel-footer-actions"><button class="text-link" data-modalities-detail>Tabla y análisis ↗</button><button class="text-link" data-section="violencia">Ver sección ↗</button></div></div></article></section>`;
  }
  function relationshipDistribution(rows) {
    const toggle = `<div class="relationship-toolbar"><span>${relationshipGrouped ? "Resumen por grupos con detalle visible" : "Todos los descriptores individuales"}</span><button type="button" class="relationship-toggle" data-toggle-relationship aria-pressed="${relationshipGrouped ? "true" : "false"}">${relationshipGrouped ? "Desagrupar" : "Agrupar"}</button></div>`;
    if (!relationshipGrouped) return toggle + verticalDistribution(rows, result.total);
    const definitions = [
      { label: "Pareja o expareja", indexes: new Set([0,1,2,3,4,5,6,7,8,9]) },
      { label: "Familiar", indexes: new Set([10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,30]) },
      { label: "Otra persona", indexes: new Set([29,31,32,33,34,35,36,37,38]) }
    ];
    const groups = definitions.map(group => {
      const detail = rows.filter(row => group.indexes.has(row.index) && row.count > 0);
      return { ...group, detail, count: detail.reduce((sum, row) => sum + row.count, 0) };
    }).filter(group => group.count > 0);
    const max = Math.max(...groups.map(group => group.count), 1);
    return toggle + `<div class="relationship-groups" aria-label="Vínculos agrupados con detalle">${groups.map((group, i) => `<section class="relationship-group"><div class="relationship-summary">${bar(group, result.total, max, colors[i % colors.length])}</div><div class="relationship-detail" aria-label="Detalle de ${esc(group.label)}">${group.detail.map(row => `<span><b>${esc(row.label)}</b><em>${E.fmt(row.count)} · ${E.pct(row.count, result.total)}</em></span>`).join("")}</div></section>`).join("")}</div>`;
  }
  function mapMode(showMap) {
    document.querySelector(".map-wrap").hidden = !showMap; $("rank-list").hidden = showMap;
    $("map-instruction").hidden = !showMap;
    if ($("map-reset")) $("map-reset").hidden = !showMap || filters.departments.length === D.departments.length;
    $("rank-view").classList.toggle("selected", !showMap); $("map-view").classList.toggle("selected", showMap);
    if (showMap) charts.forEach(c => c.resize());
  }
  function mixHex(from, to, amount) {
    const parts = color => color.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
    const a = parts(from), b = parts(to);
    return "#" + a.map((value, i) => Math.round(value + (b[i] - value) * amount).toString(16).padStart(2, "0")).join("");
  }
  function mapPieces(values) {
    const sorted = [...new Set(values.filter(value => value > 0).sort((a, b) => a - b))];
    if (!sorted.length) return [];
    const classCount = Math.min(5, sorted.length);
    const limits = Array.from({ length: classCount }, (_, i) => sorted[Math.ceil((i + 1) * sorted.length / classCount) - 1]);
    const shades = ["#5f9f78cc", "#a8c69acc", "#e2d59acc", "#d9a17fcc", "#c87470cc"];
    let lower = 1;
    return limits.map((upper, i) => {
      const shadeIndex = limits.length === 1 ? 4 : Math.round(i * 4 / (limits.length - 1));
      const piece = { min: lower, max: upper, color: shades[shadeIndex], label: `${E.fmt(lower)} a ${E.fmt(upper)} casos` };
      lower = upper + 1;
      return piece;
    });
  }
  function renderMap() {
    const geo = window.GEODATA_DEPT;
    const featureNames = geo.features.map(f => f.properties.nombdep);
    echarts.registerMap("peru-pagina2", geo);
    // Keep the national territorial scale stable when a department is selected.
    // The dashboard values remain filtered, but the selected region preserves
    // the same thermal color it had before the map click.
    const territorialContext = E.aggregate(D, { ...filters, departments: D.departments.map((_, i) => i) });
    const contextMapData = D.departments.map((name, i) => ({ name: featureNames.find(n => norm(n) === norm(name)) || name, value: territorialContext.territorial[i] })).filter(item => item.value > 0);
    const mapData = D.departments.map((name, i) => ({ name: featureNames.find(n => norm(n) === norm(name)) || name, value: result.territorial[i], percent: E.pct(result.territorial[i], result.total) })).filter(item => item.value > 0);
    const pieces = mapPieces(contextMapData.map(item => item.value));
    const thermalColor = value => pieces.find(piece => value >= piece.min && value <= piece.max)?.color || "#edf2f1";
    const intenseShades = ["#3f9f68", "#82c36d", "#e8cd48", "#e6864f", "#d94f4b"];
    const hoverShades = ["#218c50", "#69b84e", "#ddb916", "#d96a2f", "#c72f32"];
    const intenseThermalColor = value => {
      const pieceIndex = pieces.findIndex(piece => value >= piece.min && value <= piece.max);
      if (pieceIndex < 0) return "#b85f4f";
      const shadeIndex = pieces.length === 1 ? 4 : Math.round(pieceIndex * 4 / (pieces.length - 1));
      return intenseShades[shadeIndex];
    };
    const hoverThermalColor = value => {
      const pieceIndex = pieces.findIndex(piece => value >= piece.min && value <= piece.max);
      if (pieceIndex < 0) return "#b84444";
      const shadeIndex = pieces.length === 1 ? 4 : Math.round(pieceIndex * 4 / (pieces.length - 1));
      return hoverShades[shadeIndex];
    };
    const rankedMap = [...contextMapData].sort((a, b) => b.value - a.value), territorialAverage = contextMapData.reduce((sum, item) => sum + item.value, 0) / Math.max(contextMapData.length, 1), territorialMax = rankedMap[0]?.value || 1;
    const coloredMapData = mapData.map(item => {
      const pieceIndex = pieces.findIndex(candidate => item.value >= candidate.min && item.value <= candidate.max), piece = pieces[pieceIndex];
      return { ...item, rank: rankedMap.findIndex(candidate => candidate.name === item.name) + 1, departmentsWithCases: contextMapData.length, interval: piece?.label || "Sin intervalo", quintileIndex: pieceIndex, average: territorialAverage, maximum: territorialMax, itemStyle: { areaColor: thermalColor(item.value) }, emphasis: { itemStyle: { areaColor: hoverThermalColor(item.value), borderColor: "#fff", borderWidth: 2.6, shadowColor: hoverThermalColor(item.value) + "88", shadowBlur: 12 } } };
    });
    const topNames = new Set(rankedMap.slice(0, 3).map(item => item.name));
    $("map-legend").innerHTML = `<strong>Casos</strong>${pieces.map(piece => `<span><i style="background:${piece.color}"></i>${esc(piece.label)}</span>`).join("")}`;
    const map = chart("map-chart", {
      tooltip: { trigger: "item", confine: true, backgroundColor: "rgba(255,255,255,.97)", borderColor: theme.mid, borderWidth: 1, padding: [8, 9], textStyle: { color: "#24464a", fontSize: 9 }, extraCssText: "box-shadow:0 6px 20px rgba(16,52,55,.16);border-radius:7px;", formatter: p => {
        if (!p.data || p.value <= 0) return "";
        const difference = p.value - p.data.average, relation = difference >= 0 ? `${E.pct(difference, p.data.average)} por encima` : `${E.pct(Math.abs(difference), p.data.average)} por debajo`;
        const departmentWidth = Math.max(3, p.value * 100 / p.data.maximum), averageWidth = Math.max(3, p.data.average * 100 / p.data.maximum);
        const thermalScale = pieces.map((piece, index) => `<i style="display:block;flex:1;height:${index === p.data.quintileIndex ? 7 : 4}px;border:${index === p.data.quintileIndex ? "1px solid #294a47" : "0"};border-radius:2px;background:${piece.color};opacity:${index === p.data.quintileIndex ? 1 : .5}"></i>`).join("");
        return `<div style="min-width:190px;font-size:9px;line-height:1.35"><strong style="font-size:9px">${esc(p.name)}</strong><div style="margin:4px 0;border-top:1px solid #e3ece9"></div><div style="display:flex;justify-content:space-between;gap:14px"><span>Casos atendidos</span><b>${E.fmt(p.value)}</b></div><div style="display:flex;justify-content:space-between;gap:14px"><span>% de la selección</span><b>${p.data.percent}</b></div><div style="display:flex;justify-content:space-between;gap:14px"><span>Posición territorial</span><b>${p.data.rank} de ${p.data.departmentsWithCases}</b></div><div style="display:flex;justify-content:space-between;gap:14px"><span>Intervalo</span><b>${esc(p.data.interval)}</b></div><div class="map-tooltip-mini" style="margin-top:6px;padding-top:5px;border-top:1px solid #e3ece9"><b style="display:block;margin-bottom:4px;font-size:9px">Comparación visual</b><div style="display:grid;grid-template-columns:58px 1fr 31px;align-items:center;gap:3px;font-size:9px"><span>Depto.</span><i style="display:block;height:5px;border-radius:4px;background:#edf2f1;overflow:hidden"><i style="display:block;width:${departmentWidth}%;height:100%;background:${thermalColor(p.value)}"></i></i><b style="text-align:right">${E.fmt(p.value)}</b><span>Promedio</span><i style="display:block;height:5px;border-radius:4px;background:#edf2f1;overflow:hidden"><i style="display:block;width:${averageWidth}%;height:100%;background:#8ca5a2"></i></i><b style="text-align:right">${E.fmt(Math.round(p.data.average))}</b></div><div style="display:flex;align-items:center;gap:2px;height:9px;margin-top:5px">${thermalScale}</div><small style="display:block;text-align:center;color:#718789;font-size:9px">Nivel ${p.data.quintileIndex + 1} de ${pieces.length}</small></div><div style="margin-top:4px;padding-top:4px;border-top:1px solid #e3ece9;color:#617b7d;font-size:9px">Promedio: ${relation}</div><small style="display:block;margin-top:3px;color:#84989a;font-size:9px">Ubicación del CEM</small></div>`;
      } },
      animationDurationUpdate: 1000,
      visualMap: { type: "piecewise", pieces, show: false, seriesIndex: [] },
      series: [{ type: "map", map: "peru-pagina2", nameProperty: "nombdep", roam: false, layoutCenter: ["54%", "50%"], layoutSize: "101%", data: coloredMapData, label: { show: true, color: "#183d3b", fontSize: 7, lineHeight: 9, fontWeight: 600, textBorderColor: "#fff", textBorderWidth: 3, formatter: p => p.data && p.value > 0 ? `${p.name.toUpperCase()}\n${p.data.percent}` : "" }, labelLayout: { hideOverlap: false }, itemStyle: { borderColor: "#f8fffd", borderWidth: 1.8, areaColor: "#edf2f1", shadowColor: "#284a4660", shadowBlur: 1 }, emphasis: { focus: "self", label: { show: true, fontSize: 8, color: "#102f2d" }, itemStyle: { borderColor: "#f8fffd", borderWidth: 2.2 } }, select: { disabled: true } }]
    });
    const topIndexes = coloredMapData.map((item, index) => topNames.has(item.name) ? index : -1).filter(index => index >= 0);
    map.__pulseRegions = topIndexes;
    map.__topIntenseColors = coloredMapData.filter(item => topNames.has(item.name)).map(item => intenseThermalColor(item.value));
    if (topIndexes.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let highlighted = false;
      const pulse = () => {
        if (map.isDisposed()) return; highlighted = !highlighted;
        map.setOption({ series: [{ data: coloredMapData.map(item => ({ ...item, itemStyle: { areaColor: topNames.has(item.name) && highlighted ? intenseThermalColor(item.value) : thermalColor(item.value), borderColor: "#f8fffd", borderWidth: 1.8, shadowColor: "#284a4628", shadowBlur: 1 } })) }] });
      };
      pulse(); mapPulseTimer = setInterval(pulse, 1800);
    }
    map.on("click", p => {
      const index = D.departments.findIndex(n => norm(n) === norm(p.name));
      if (index >= 0) {
        filters.departments = [index];
        syncDraft();
        $("filter-hint").textContent = `${D.departments[index]} aplicado desde el mapa.`;
        refresh();
      }
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
    const allMonths = D.months.map(month => month.id);
    const history = E.aggregate(D, { population: filters.population, months: allMonths, departments: filters.departments });
    const selected = new Set(filters.months);
    const points = D.months.map((month, i) => ({ value: history.monthly[i], symbolSize: selected.has(i) ? 11 : 5, itemStyle: { color: selected.has(i) ? theme.accent : theme.primary, borderColor: selected.has(i) ? "#fff" : theme.primary, borderWidth: selected.has(i) ? 3 : 0 }, label: { show: selected.has(i), position: "top", distance: 7, color: theme.deep, fontSize: 9, fontWeight: 700, formatter: p => E.fmt(p.value) } }));
    chart(host, { tooltip: { trigger: "axis", valueFormatter: n => E.fmt(n) + " casos" }, grid: { left: 55, right: 30, top: 42, bottom: 35 },
      xAxis: { type: "category", data: D.months.map(month => month.title.split(" ")[0].slice(0, 3)), axisTick: { show: false }, axisLine: { lineStyle: { color: "#e5eeeb" } }, axisLabel: { color: "#8c9d9f", fontSize: 10, formatter: (value, index) => selected.has(index) ? `{selected|${value}}` : value, rich: { selected: { color: theme.accent, fontWeight: 700 } } } },
      yAxis: { type: "value", axisLabel: { color: "#8c9d9f", fontSize: 9 }, splitLine: { lineStyle: { color: "#edf2f1", type: "dashed" } } },
      series: [{ type: "line", data: points, connectNulls: false, smooth: false, symbol: "circle", lineStyle: { color: colors[0], width: 2.5 }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: theme.mid + "88" }, { offset: 1, color: "#ffffff00" }] } } }]
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
    const reopenFullscreen = fullscreenKey;
    document.body.classList.remove("panel-expanded");
    applyTheme(filters.population);
    if (recompute) result = E.aggregate(D, filters);
    disposeCharts(); renderKpis();
    const section = D.sections.find(s => s.id === sectionId);
    $("page-title").textContent = search ? "Catálogo de indicadores" : section?.title || ({ panorama: "Panorama general", historico: "Evolución temporal", catalogo: "Catálogo de indicadores" }[sectionId]);
    $("page-description").textContent = search ? `Resultados para «${search}» en todos los rubros.` : section?.description || (sectionId === "panorama" ? "Una mirada integral a los casos atendidos por los CEM." : sectionId === "historico" ? "Observa la distribución de los ingresos en el tiempo." : "Explora todas las variables esquematizadas de la base.");
    document.querySelectorAll("[data-section]").forEach(b => { b.classList.toggle("active", b.dataset.section === (search ? "catalogo" : sectionId)); b.setAttribute("aria-current", b.classList.contains("active") ? "page" : "false"); });
    if (!result.total) $("dashboard").innerHTML = '<div class="empty-state"><strong>No hay casos con estos filtros</strong><p>Amplía el periodo o los departamentos para explorar los indicadores.<br>El reporte conservará esta selección e indicará la ausencia de resultados.</p><button id="empty-reset" class="button" style="margin-top:17px">Restablecer filtros</button></div>';
    else if (!search && sectionId === "panorama") overview();
    else if (!search && sectionId === "historico") historical();
    else renderCatalog();
    enhancePanels();
    if (reopenFullscreen) {
      const panel = [...document.querySelectorAll("#dashboard .panel")].find(item => item.dataset.panelKey === reopenFullscreen);
      if (panel) togglePanelFullscreen(panel); else fullscreenKey = null;
    }
    if ($("empty-reset")) $("empty-reset").onclick = reset;
    $("download-report").disabled = false;
    $("footer-count").textContent = `${D.meta.indicators} indicadores · ${D.meta.variables} variables revisadas`;
  }
  function reset() {
    filters = { population: "total", months: [D.months[D.months.length - 1].id], departments: D.departments.map((_, i) => i) };
    syncDraft(); document.querySelectorAll(".picker").forEach(p => { p.open = false; }); $("filter-hint").textContent = "Filtros restablecidos."; refresh();
  }
  function tableHTML(f) {
    const distribution = E.distribution(f, result), registered = result.total - distribution[f.missingIndex].count;
    const visible = f.id === "DPTO_UBI_CEM" ? distribution.filter(r => r.count > 0) : distribution.filter(r => r.count || !r.missing);
    return `<div class="table-wrap"><table class="sortable-table"><thead><tr><th data-sort-table="text" aria-sort="none"><button type="button">Categoría <i>↕</i></button></th><th class="numeric" data-sort-table="integer" aria-sort="none"><button type="button">Casos <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% selección <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% con registro <i>↕</i></button></th></tr></thead><tbody>${visible.map(r => `<tr class="${r.missing ? "missing" : ""}"><td>${esc(r.label)}</td><td class="numeric">${E.fmt(r.count)}</td><td class="numeric">${E.pct(r.count, result.total)}</td><td class="numeric">${r.missing ? "—" : E.pct(r.count, registered)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function sortDetailTable(header) {
    const table = header.closest("table"), body = table?.tBodies[0]; if (!body) return;
    const headers = [...header.parentElement.children], column = headers.indexOf(header);
    const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    headers.forEach(item => { item.setAttribute("aria-sort", "none"); const icon = item.querySelector("i"); if (icon) icon.textContent = "↕"; });
    header.setAttribute("aria-sort", direction); const icon = header.querySelector("i"); if (icon) icon.textContent = direction === "ascending" ? "↑" : "↓";
    const rows = [...body.rows].filter(row => !row.hasAttribute("data-summary"));
    const value = row => {
      const text = row.cells[column]?.textContent.trim() || "";
      if (header.dataset.sortTable === "text") return norm(text);
      if (text === "—") return Number.NEGATIVE_INFINITY;
      if (header.dataset.sortTable === "integer") return Number(text.replace(/[.,\s]/g, "")) || 0;
      return Number(text.replace(/\./g, "").replace(",", ".").replace("%", "")) || 0;
    };
    rows.sort((a, b) => { const av = value(a), bv = value(b), comparison = typeof av === "string" ? av.localeCompare(bv, "es") : av - bv; return direction === "ascending" ? comparison : -comparison; });
    const summary = body.querySelector("[data-summary]"); rows.forEach(row => body.insertBefore(row, summary));
  }
  function detail(id) {
    detailField = byId.get(id); const f = detailField;
    $("detail-title").textContent = f.title;
    $("detail-content").innerHTML = `<p class="muted">${esc(E.filterDescription(D, filters).population)} · ${E.fmt(result.total)} casos seleccionados</p><div class="insight" style="margin:0 0 18px">${esc(E.interpret(f, result))}</div>${tableHTML(f)}<h3>Cómo leer este indicador</h3><p class="muted">${esc(f.note)}</p><p class="muted">El porcentaje con registro usa únicamente las respuestas registradas para este indicador. Una respuesta «No sabe/no responde» se conserva como categoría registrada. Las marcas múltiples pueden coexistir en un mismo caso.</p><p class="muted">Variable de origen: <code>${esc(f.id)}</code></p>`;
    $("detail-dialog").showModal();
  }
  function ageSexDetail() {
    const groups = E.ageSex(D, filters), description = E.filterDescription(D, filters);
    detailField = { id: "__AGE_SEX__", title: "Grupos de edad por sexo registrado" };
    $("detail-title").textContent = detailField.title;
    const tableRows = groups.flatMap(group => {
      const total = group.values.reduce((sum, item) => sum + item.count, 0);
      return group.values.map(item => `<tr><td>${esc(group.label)}</td><td>${esc(item.label)}</td><td class="numeric">${E.fmt(item.count)}</td><td class="numeric">${E.pct(item.count, total)}</td><td class="numeric">${E.pct(item.count, result.total)}</td></tr>`);
    }).join("");
    $("detail-content").innerHTML = `<p class="muted">${esc(description.population)} · ${E.fmt(result.total)} casos seleccionados</p><div class="insight" style="margin:0 0 18px">Cruce calculado directamente desde los registros de edad y sexo. El porcentaje dentro de la edad compara mujeres y hombres del mismo grupo; el porcentaje de la selección usa todos los casos filtrados.</div><div class="table-wrap"><table class="sortable-table"><thead><tr><th data-sort-table="text" aria-sort="none"><button type="button">Grupo de edad <i>↕</i></button></th><th data-sort-table="text" aria-sort="none"><button type="button">Sexo <i>↕</i></button></th><th class="numeric" data-sort-table="integer" aria-sort="none"><button type="button">Casos <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% dentro de edad <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% selección <i>↕</i></button></th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
    $("detail-dialog").showModal();
  }
  function modalitiesDetail() {
    const rows = sexualModalities(), total = rows.reduce((sum, row) => sum + row.count, 0);
    detailField = { id: "__SEXUAL_MODALITIES__", title: "Modalidades de violencia sexual" };
    $("detail-title").textContent = detailField.title;
    $("detail-content").innerHTML = `<p class="muted">${esc(E.filterDescription(D, filters).population)} · ${E.fmt(result.total)} casos seleccionados</p><div class="insight" style="margin:0 0 18px"><strong>Lectura:</strong> la composición distribuye el total de registros de estas cuatro modalidades y suma exactamente 100%. El porcentaje sobre casos usa como base todos los casos seleccionados. Como las modalidades son indicadores independientes, una persona puede aparecer en más de una modalidad.</div><div class="table-wrap"><table class="sortable-table"><thead><tr><th data-sort-table="text" aria-sort="none"><button type="button">Modalidad <i>↕</i></button></th><th class="numeric" data-sort-table="integer" aria-sort="none"><button type="button">Casos <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% composición <i>↕</i></button></th><th class="numeric" data-sort-table="number" aria-sort="none"><button type="button">% de casos <i>↕</i></button></th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.label)}</td><td class="numeric">${E.fmt(row.count)}</td><td class="numeric">${row.percentLabel}</td><td class="numeric">${E.pct(row.count, result.total)}</td></tr>`).join("")}<tr data-summary><td><strong>Total de registros de modalidades</strong></td><td class="numeric"><strong>${E.fmt(total)}</strong></td><td class="numeric"><strong>100,0%</strong></td><td class="numeric">—</td></tr></tbody></table></div>`;
    $("detail-dialog").showModal();
  }
  function csvDownload() {
    const f = detailField, description = E.filterDescription(D, filters);
    if (f.id === "__AGE_SEX__") {
      const groups = E.ageSex(D, filters);
      const rows = [["Indicador", f.title], ["Población", description.population], ["Meses", description.months], ["Departamentos", description.departments], ["Base seleccionada", result.total], [], ["Grupo de edad", "Sexo", "Casos", "% dentro de edad", "% selección"], ...groups.flatMap(group => { const total = group.values.reduce((sum, item) => sum + item.count, 0); return group.values.map(item => [group.label, item.label, item.count, E.pct(item.count, total), E.pct(item.count, result.total)]); })];
      const text = "\ufeff" + rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "CEM_edad_por_sexo.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); return;
    }
    if (f.id === "__SEXUAL_MODALITIES__") {
      const modalities = sexualModalities(), total = modalities.reduce((sum, row) => sum + row.count, 0);
      const rows = [["Indicador", f.title], ["Población", description.population], ["Meses", description.months], ["Departamentos", description.departments], ["Base seleccionada", result.total], ["Total de registros de modalidades", total], [], ["Modalidad", "Casos", "% composición", "% de casos"], ...modalities.map(row => [row.label, row.count, row.percentLabel, E.pct(row.count, result.total)]), ["Total", total, "100,0%", ""]];
      const text = "\ufeff" + rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "CEM_modalidades_violencia_sexual.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); return;
    }
    const registered = result.total - result.vector[f.offset + f.missingIndex];
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
    $("population-buttons").addEventListener("wheel", event => {
      const nav = event.currentTarget;
      if (nav.scrollWidth <= nav.clientWidth) return;
      event.preventDefault();
      nav.scrollBy({ left: Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX, behavior: "smooth" });
    }, { passive: false });
    document.addEventListener("click", event => {
      const sortHeader = event.target.closest("[data-sort-table]"); if (sortHeader) sortDetailTable(sortHeader);
      const section = event.target.closest("[data-section]"); if (section) setSection(section.dataset.section);
      const population = event.target.closest("[data-population]");
      if (population && population.dataset.population !== filters.population) {
        filters.population = population.dataset.population;
        syncDraft(); refresh();
      }
      const info = event.target.closest("[data-detail]"); if (info) detail(info.dataset.detail);
      const modalities = event.target.closest("[data-modalities-detail]"); if (modalities) modalitiesDetail();
      const ageSex = event.target.closest("[data-age-sex-detail]"); if (ageSex) ageSexDetail();
      const expand = event.target.closest("[data-expand-panel]"); if (expand) togglePanelFullscreen(expand.closest(".panel"));
      const relationshipToggle = event.target.closest("[data-toggle-relationship]");
      if (relationshipToggle) { relationshipGrouped = !relationshipGrouped; refresh(false); }
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
    $("theme-mode").onchange = event => setThemeMode(event.target.value);
    $("palette-button").onclick = () => $("palette-dialog").showModal();
    $("palette-grid").onclick = event => { const option = event.target.closest("[data-palette]"); if (option) { setPalette(option.dataset.palette); $("palette-dialog").close(); } };
    $("download-report").onclick = openReport; $("report-scope").onchange = reportInfo; $("generate-report").onclick = generateReport;
    window.addEventListener("resize", () => charts.forEach(c => c.resize()));
    document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); $("indicator-search").focus(); } });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && document.querySelector(".fullscreen-panel")) togglePanelFullscreen(document.querySelector(".fullscreen-panel"), true); });
  }
  try {
    if (!D || !E) throw new Error("No se pudo cargar data/data.js. Comprueba que todos los archivos de pagina2 estén presentes.");
    buildNav(); buildPaletteGrid(); syncDraft(); bind(); $("source-period").textContent = D.meta.period;
    let savedMode = "light"; try { savedMode = localStorage.getItem("cem-theme-mode") || "light"; } catch (_) {}
    setThemeMode(savedMode);
    try { paletteChoice = localStorage.getItem("cem-color-palette") || "default"; } catch (_) {}
    document.querySelectorAll("[data-palette]").forEach(button => { const active = button.dataset.palette === paletteChoice; button.classList.toggle("active", active); button.setAttribute("aria-pressed", active ? "true" : "false"); });
    $("menu-button").setAttribute("aria-expanded", window.innerWidth > 960 ? "true" : "false");
    refresh();
    // Read-only hooks for reproducible checks of the shared calculation contract.
    window.Dashboard = { getState: () => ({ filters: structuredClone(filters), result, section: sectionId }), getReportFields: selectedReportFields };
  } catch (error) {
    console.error(error); $("error").hidden = false; $("error").textContent = error.message; $("dashboard").innerHTML = "";
  }
})();
