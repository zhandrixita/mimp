(function () {
  "use strict";
  const INK = [25, 58, 64], TEAL = [20, 125, 119], MUTED = [107, 128, 134], LINE = [224, 234, 232];
  const safe = value => String(value).replace(/[\u2010-\u2015]/g, "-").replace(/[\u00a0\u202f]/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/…/g, "...");
  async function silhouetteImage(key) {
    const svg = window.ICONS_SVG?.[key];
    if (!svg) return null;
    const markup = svg.replace(/currentColor/g, "#147d77");
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 180;
      const ctx = canvas.getContext("2d");
      const scale = Math.min(100 / img.naturalWidth, 180 / img.naturalHeight);
      ctx.drawImage(img, (100 - img.naturalWidth * scale) / 2, (180 - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      return canvas.toDataURL("image/png");
    } finally { URL.revokeObjectURL(url); }
  }
  async function create({ data, filters, result, fields, scope, sectionTitle }) {
    if (!window.jspdf) throw new Error("La librería PDF no está disponible.");
    const E = window.DashEngine, { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.setProperties({ title: "CEM - Reporte de casos atendidos", subject: scope, author: "Observatorio de casos CEM", creator: "Dashboard pagina2" });
    const desc = E.filterDescription(data, filters);
    const date = new Date().toLocaleString("es-PE");
    const byId = new Map(data.fields.map(f => [f.id, f]));
    let y = 18;
    function style(size = 10, color = INK, weight = "normal") { doc.setFont("helvetica", weight); doc.setFontSize(size); doc.setTextColor(...color); }
    function newPage() {
      doc.addPage(); y = 24; style(8, TEAL, "bold"); doc.text("CEM / REPORTE DE CASOS ATENDIDOS", 18, 13);
      doc.setDrawColor(...LINE); doc.line(18, 17, 192, 17);
    }
    function ensure(height) { if (y + height > 276) newPage(); }
    function paragraph(text, size = 9, color = MUTED, weight = "normal", gap = 4) {
      style(size, color, weight);
      const lines = doc.splitTextToSize(safe(text), 174), lineHeight = size * .45;
      for (const line of lines) { ensure(lineHeight); style(size, color, weight); doc.text(line, 18, y); y += lineHeight; }
      y += gap;
    }
    function heading(title, sub) {
      ensure(24); y += 4; paragraph(title, 14, INK, "bold", 2); if (sub) paragraph(sub, 9, MUTED, "normal", 5);
    }
    function table(headers, tableRows, widths = [100, 25, 25, 24], caption = "") {
      function head() {
        ensure(13); doc.setFillColor(233, 243, 239); doc.rect(18, y - 4, 174, 9, "F"); style(8, TEAL, "bold");
        let x = 18;
        headers.forEach((h, i) => { doc.text(safe(h), i ? x + widths[i] - 3 : x + 3, y + 1, { align: i ? "right" : "left" }); x += widths[i]; }); y += 10;
      }
      head();
      tableRows.forEach((cells, ri) => {
        style(8, INK);
        const lines = doc.splitTextToSize(safe(cells[0]), widths[0] - 6);
        const height = Math.max(8, lines.length * 3.8 + 4);
        if (y + height > 273) { newPage(); if (caption) paragraph(caption + " (continuación)", 9, INK, "bold", 4); head(); }
        if (ri % 2 === 0) { doc.setFillColor(249, 251, 250); doc.rect(18, y - 4, 174, height, "F"); }
        let x = 18; style(8, INK);
        doc.text(lines, x + 3, y, { lineHeightFactor: 1.35 }); x += widths[0];
        for (let i = 1; i < cells.length; i++) { doc.text(safe(cells[i]), x + widths[i] - 3, y, { align: "right" }); x += widths[i]; }
        y += height;
      }); y += 6;
    }
    doc.setFillColor(...INK); doc.rect(0, 0, 210, 49, "F"); style(9, [173, 214, 202], "bold"); doc.text("OBSERVATORIO DE CASOS / CEM", 18, 16);
    style(23, [255, 255, 255], "bold"); doc.text("Reporte de casos atendidos", 18, 29);
    style(10, [214, 233, 227]); doc.text(safe(data.meta.period + " · Información preliminar"), 18, 40);
    y = 61; paragraph(scope + (scope.includes("Sección") ? " - " + sectionTitle : ""), 11, TEAL, "bold");
    paragraph(`Población: ${desc.population}`, 10, INK, "bold");
    paragraph(`Meses de ingreso: ${desc.months}`);
    paragraph(`Departamento de atención: ${desc.departments}`);
    paragraph(`Generado: ${date} | Fuente: ${data.meta.source}`, 8);
    ensure(27); doc.setFillColor(235, 246, 240); doc.roundedRect(18, y, 174, 25, 3, 3, "F");
    style(23, TEAL, "bold"); doc.text(E.fmt(result.total), 24, y + 12);
    style(8, MUTED); doc.text("CASOS EN LA SELECCIÓN", 24, y + 20);
    style(11, INK, "bold"); doc.text(`${E.pct(result.total, data.meta.rows)} del corte nacional`, 112, y + 12);
    style(8, MUTED); doc.text(`${data.meta.rows.toLocaleString("es-PE")} registros en la fuente`, 112, y + 19); y += 35;
    if (!result.total) {
      paragraph("No se registran casos para los filtros seleccionados. No corresponde calcular porcentajes ni interpretar distribuciones.", 12, INK, "bold");
    } else {
      heading("Perfil por ciclo de vida", "Distribución de edad. Porcentajes sobre todos los casos seleccionados.");
      const age = byId.get("EDAD_GRANDE"), ageRows = E.distribution(age, result).filter(r => !r.missing);
      ensure(46);
      for (let i = 0; i < ageRows.length; i++) {
        const x = 18 + i * 58, row = ageRows[i];
        const bases = filters.population === "hombres" ? ["nino"] : ["mujeres", "gestantes"].includes(filters.population) ? ["nina"] : ["nina", "nino"];
        for (let j = 0; j < bases.length; j++) {
          const img = await silhouetteImage(bases[j] + (i ? i + 1 : ""));
          if (img) doc.addImage(img, "PNG", x + 1 + j * 9, y, bases.length === 1 ? 15 : 10, 27);
        }
        style(8, MUTED); doc.text(safe(row.label), x + 21, y + 5);
        style(15, INK, "bold"); doc.text(E.fmt(row.count), x + 21, y + 15);
        style(9, TEAL, "bold"); doc.text(E.pct(row.count, result.total), x + 21, y + 23);
      } y += 37;
      paragraph(E.interpret(age, result), 9);
      heading("Lectura de los principales indicadores");
      for (const id of ["TIPO_VIOLENCIA", "NIVEL_DE_RIESGO_VICTIMA"]) {
        const f = byId.get(id); paragraph(f.title + ": " + E.interpret(f, result), 9);
      }
    }
    if (result.total) {
      newPage(); heading("Evolución de los ingresos", "Mes de ingreso al servicio. No corresponde a la fecha de ocurrencia del hecho.");
      const monthly = filters.months.map(i => ({ label: data.months[i].title, count: result.monthly[i] }));
      const max = Math.max(...monthly.map(m => m.count));
      for (const month of monthly) {
        ensure(13); style(9, INK); doc.text(safe(month.label), 18, y); doc.text(E.fmt(month.count), 192, y, { align: "right" });
        doc.setFillColor(233, 241, 237); doc.roundedRect(18, y + 2, 174, 3, 1, 1, "F");
        if (month.count) { doc.setFillColor(...TEAL); doc.roundedRect(18, y + 2, month.count * 174 / max, 3, 1, 1, "F"); } y += 13;
      }
      heading("Distribución territorial", "Ubicación del CEM que atendió el caso. Se incluyen los departamentos seleccionados.");
      table(["Departamento", "Casos", "% selección"], filters.departments.map(i => [data.departments[i], result.territorial[i], E.pct(result.territorial[i], result.total)]).filter(row => row[1] > 0).sort((a, b) => b[1] - a[1]).map(row => [row[0], E.fmt(row[1]), row[2]]), [119, 27, 28], "Distribución territorial");
      newPage(); heading("Indicadores de la selección", `${fields.length} indicadores. Las tablas incluyen todas las categorías definidas, incluso cuando el conteo es cero, salvo la distribución territorial.`);
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i], distribution = E.distribution(f, result), registered = result.total - distribution[f.missingIndex].count;
        ensure(75);
        const sec = data.sections.find(s => s.id === f.section);
        paragraph(`${i + 1}. ${f.title}`, 11, INK, "bold", 2);
        paragraph(`${sec?.title || "Indicador"} | Con registro: ${E.fmt(registered)} de ${E.fmt(result.total)}`, 8, TEAL);
        paragraph(E.interpret(f, result), 9);
        const reportRows = (f.id === "DPTO_UBI_CEM" ? distribution.filter(r => r.count > 0) : distribution).map(r => [r.label, E.fmt(r.count), E.pct(r.count, result.total), r.missing ? "-" : E.pct(r.count, registered)]);
        table(["Categoría", "Casos", "% selección", "% registro"], reportRows, [100, 25, 25, 24], f.title);
        paragraph(f.note, 8);
        paragraph(`Variable: ${f.id}`, 7, MUTED, "normal", 7);
        if (i % 15 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    heading("Notas metodológicas");
    paragraph("Unidad: registros de casos atendidos. Los conteos no representan personas únicas ni prevalencia en la población. Los filtros de territorio corresponden al departamento de atención; los de tiempo, al mes de ingreso.");
    paragraph("Los porcentajes de selección usan todos los casos filtrados. El porcentaje con registro usa las respuestas registradas de cada indicador. Sin registro / no aplicable no significa No. No sabe/no responde se conserva como categoría registrada. Las marcas de respuesta múltiple pueden coexistir.");
    paragraph("Las interpretaciones son descripciones automáticas de las frecuencias observadas. No establecen causalidad, diagnósticos ni eficacia institucional. Las medidas solicitadas, concedidas y ejecutadas son indicadores independientes, no una cohorte de seguimiento verificada.");
    paragraph("Las poblaciones específicas pueden solaparse y no deben sumarse entre sí. El histórico anual 2021-2025 no forma parte de los resultados filtrados de este reporte. Los datos del corte actual son preliminares.");
    paragraph(`Cobertura técnica: ${data.meta.indicators} indicadores agregados de ${data.meta.variables} variables revisadas. Se comprobaron ${data.meta.checks} combinaciones de filtros contra la base de origen. No se publican relatos, identificadores ni registros individuales.`);
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setDrawColor(...LINE); doc.line(18, 282, 192, 282); style(7, MUTED);
      doc.text(safe("CEM · " + desc.population + " · Información preliminar"), 18, 287);
      doc.text(`${p} / ${pages}`, 192, 287, { align: "right" });
    }
    return doc;
  }
  window.DashReport = { create };
})();
