(function (root) {
  "use strict";
  const number = new Intl.NumberFormat("es-PE");
  const decimal = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt = n => number.format(n);
  const pct = (n, base) => base ? decimal.format(n * 100 / base) + "%" : "—";
  function aggregate(data, filters) {
    const months = new Set(filters.months), departments = new Set(filters.departments);
    const vector = new Int32Array(data.vectorSize);
    const monthly = new Int32Array(data.months.length), territorial = new Int32Array(data.departments.length);
    let total = 0;
    for (const [month, dept, n, pairs] of data.cubes[filters.population]) {
      if (!months.has(month) || !departments.has(dept)) continue;
      total += n; monthly[month] += n; territorial[dept] += n;
      for (let i = 0; i < pairs.length; i += 2) vector[pairs[i]] += pairs[i + 1];
    }
    return { total, vector, monthly: Array.from(monthly), territorial: Array.from(territorial) };
  }
  function distribution(field, result) {
    return field.labels.map((label, i) => ({ label, count: result.vector[field.offset + i], missing: i === field.missingIndex, index: i }));
  }
  function ageSex(data, filters) {
    const months = new Set(filters.months), departments = new Set(filters.departments);
    const values = Array(data.ageSex.ageLabels.length * data.ageSex.sexLabels.length).fill(0);
    for (const [month, department, counts] of data.ageSex.cubes[filters.population]) {
      if (!months.has(month) || !departments.has(department)) continue;
      counts.forEach((count, index) => { values[index] += count; });
    }
    return data.ageSex.ageLabels.map((label, ageIndex) => ({ label, values: data.ageSex.sexLabels.map((sex, sexIndex) => ({ label: sex, count: values[ageIndex * data.ageSex.sexLabels.length + sexIndex] })) }));
  }
  function interpret(field, result) {
    if (!result.total) return "No se registran casos para esta combinación de filtros. No corresponde calcular porcentajes.";
    const rows = distribution(field, result), missing = rows[field.missingIndex].count;
    const registered = result.total - missing;
    if (!registered) return "No hay respuestas registradas para este indicador en la selección. Los valores vacíos pueden corresponder a preguntas no aplicables.";
    const coverage = `Hay ${fmt(registered)} respuestas registradas de ${fmt(result.total)} casos seleccionados (${pct(registered, result.total)}).`;
    if (field.yesIndex >= 0) {
      const yes = rows[field.yesIndex].count;
      return `Se registra una respuesta afirmativa en ${fmt(yes)} casos (${pct(yes, result.total)} de la selección). ${coverage}`;
    }
    const sorted = rows.filter(r => !r.missing && r.count).sort((a, b) => b.count - a.count);
    const leaders = sorted.filter(r => r.count === sorted[0].count);
    if (leaders.length > 1) return `${leaders.length} categorías comparten la mayor frecuencia, con ${fmt(leaders[0].count)} casos cada una (${pct(leaders[0].count, result.total)} de la selección). ${coverage}`;
    return `La categoría con mayor frecuencia es «${sorted[0].label}», con ${fmt(sorted[0].count)} casos (${pct(sorted[0].count, result.total)} de la selección). ${coverage}`;
  }
  function filterDescription(data, filters) {
    const population = data.populations.find(p => p.id === filters.population).title;
    const months = filters.months.length === data.months.length ? data.meta.period : filters.months.map(i => data.months[i].title).join(", ");
    const departments = filters.departments.length === data.departments.length ? "Todos los departamentos de atención" : filters.departments.map(i => data.departments[i]).join(", ");
    return { population, months, departments };
  }
  const api = { aggregate, distribution, ageSex, interpret, filterDescription, fmt, pct };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DashEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
