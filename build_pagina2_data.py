"""Construye exclusivamente agregados para pagina2; nunca publica registros SPSS.

Ejecutar: python build_pagina2_data.py [--source data/nuevo_corte.sav]
Los cubos independientes por población permiten combinar meses y departamentos.
Las poblaciones se solapan: nunca se suman sus cubos entre sí.
"""
import argparse
import csv
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import pyreadstat

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "pagina2" / "data"
SECTIONS = [
    ("ingreso", "Ingreso y servicios CEM", "Condición del caso, canales de ingreso y servicios."),
    ("perfil", "Perfil personal y familiar", "Edad, educación, actividad y composición familiar."),
    ("territorio", "Territorio e interculturalidad", "Ubicación de atención, residencia, lenguas y pertenencia étnica."),
    ("poblaciones", "Poblaciones específicas", "Gestación, diversidad, discapacidad y condiciones registradas."),
    ("violencia", "Violencia y antecedentes", "Tipos, actos específicos, frecuencia y antecedentes de violencia."),
    ("agresor", "Persona agresora y vínculo", "Perfil de la presunta persona agresora y vínculo relacional."),
    ("riesgo", "Riesgo y protección", "Factores de riesgo, redes de apoyo y recursos de protección."),
    ("atencion", "Atención y salud", "Intervenciones, derivaciones y atención especializada."),
    ("justicia", "Denuncia y acceso a justicia", "Denuncias, medidas, patrocinio y actuaciones legales."),
]
POPULATIONS = [("total", "Todas las personas"), ("mujeres", "Mujeres"), ("hombres", "Hombres"),
               ("alcohol_drogas", "Alcohol y drogas"), ("lgtbi", "Personas LGBTI"),
               ("extranjeras", "Personas extranjeras"), ("gestantes", "Mujeres gestantes")]
MONTHS = "Enero Febrero Marzo Abril Mayo Junio Julio Agosto Septiembre Octubre Noviembre Diciembre".split()


def clean(value):
    text = "" if value is None else str(value)
    for _ in range(3):
        try:
            candidate = text.encode("latin1").decode("utf-8")
        except (UnicodeError, ValueError):
            break
        if candidate == text:
            break
        text = candidate
    return text.replace("\x91", "Ñ").replace("\x93", "Ó").strip()


def key(value):
    return re.sub(r"[^A-Z0-9_]", "", unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode().upper())


def section(c, i):
    if c == "SIN_VINCULO":
        return "agresor"
    if c.startswith("DERIVA_SGT_SERVICIO_") or c == "DERIVA_SERV_ACOMPANAMIENTO":
        return "atencion"
    if c.startswith("FACTOR_") or c.startswith("VULNERABILIDAD_") or 358 <= i <= 374 or 401 <= i <= 434:
        return "riesgo"
    if c.startswith(("AGRESOR_", "VINCULO_")) or "AGRESOR" in c or c == "SITUACION_AGRESOR":
        return "agresor"
    if c.startswith(("EDAD_", "HIJAS_", "HIJOS_")):
        return "perfil"
    if c in {"CEM", "CONDICION", "TURNO_INGRESO", "FORMA_INGRESO", "MEDIO", "CATEGORIA", "MODALIDAD_REGISTRO", "CEM_VIGENTE"} or i < 65 and c != "INTERPUSO_DENUNCIA":
        return "ingreso"
    if c.startswith(("NOM_", "DPTO_", "REGION_")) or c in {"LENGUA_MATERNA_VICTIMA", "OTRA_LENGUA_NATIVA_VICTIMA", "ETNIA_VICTIMA", "PUEBLO_INDIGENA_AMAZONIA", "PUEBLO_INDIGENA_ANDES", "AREA_RESIDENCIA_DOMICILIO", "VRAEM", "TIPO_VRAEM", "AREA_DISTRITO", "DIST_POBRE"}:
        return "territorio"
    if 65 <= i <= 78 or 81 <= i <= 82 or 122 <= i <= 129 or 180 <= i <= 185 or c in {"CASOS_PERSONAS_LGBTI", "CASOS_PERSONAS_EXTRANJERAS"}:
        return "poblaciones"
    if 79 <= i <= 121:
        return "perfil"
    if 175 <= i <= 179 or 186 <= i <= 274 or 283 <= i <= 299 or 461 <= i <= 465:
        return "violencia"
    if 275 <= i <= 282 or 467 <= i <= 496 or c in {"ATENCION_INTEGRAL", "ATENCION_INTERDISCIPLINARIA"} or 541 <= i <= 544 or 549 <= i <= 557:
        return "atencion"
    return "justicia"


TITLES = {
    "EDAD_GRANDE": "Grupos de edad", "SEXO_VICTIMA": "Sexo de la persona usuaria",
    "TIPO_VIOLENCIA": "Tipo de violencia", "NIVEL_DE_RIESGO_VICTIMA": "Nivel de riesgo",
    "CONDICION": "Condición del caso", "CEM": "Casos por CEM", "DPTO_UBI_CEM": "Departamento de atención",
    "REGION_UBI_CEM": "Región de atención", "NOM_DPTO": "Departamento de residencia",
    "CATEGORIA": "Categoría del CEM", "FORMA_INGRESO": "Canal de ingreso", "TURNO_INGRESO": "Turno de ingreso",
    "ESTADO_CIVIL_VICTIMA": "Estado civil", "LENGUA_MATERNA_VICTIMA": "Lengua materna",
    "AREA_RESIDENCIA_DOMICILIO": "Residencia urbana y rural", "VICTIMA_TIEMPO_GESTACION": "Meses de gestación",
    "REDES_FAM_SOC": "Redes familiares o sociales", "FRECUENCIA_AGREDE": "Frecuencia de la agresión",
}


def population_masks(df):
    return {
        "total": np.ones(len(df), dtype=bool), "mujeres": (df.SEXO_VICTIMA == 0).to_numpy(),
        "hombres": (df.SEXO_VICTIMA == 1).to_numpy(),
        "alcohol_drogas": df.ESTADO_AGRESOR_U_A.isin([2, 3, 4]).to_numpy(),
        "lgtbi": (df.CASOS_PERSONAS_LGBTI == 1).to_numpy(),
        "extranjeras": (df.CASOS_PERSONAS_EXTRANJERAS == 1).to_numpy(),
        "gestantes": (df.VICTIMA_GESTANDO == 1).to_numpy(),
    }


def main(source):
    OUT.mkdir(parents=True, exist_ok=True)
    _, meta = pyreadstat.read_sav(str(source), metadataonly=True, encoding="latin1")
    # All labelled categorical variables are reviewed. Free text, record IDs and
    # exact dates are not exported; four numeric counts and gestation are grouped.
    extras = {"CEM", "DPTO_UBI_CEM", "REGION_UBI_CEM", "NOM_DPTO", "HIJAS_VIVAS_0_17", "HIJOS_VIVOS_0_17",
              "HIJAS_VIVAS_18_MAS", "HIJOS_VIVOS_18_MAS", "VICTIMA_TIEMPO_GESTACION"}
    selected = [c for c in meta.column_names if c in meta.variable_value_labels or key(c) in extras]
    dates = ["FECHA_INGRESO"]
    df, full = pyreadstat.read_sav(str(source), usecols=selected + dates, encoding="latin1")
    raw_to_key = {c: key(c) for c in df.columns}
    if len(set(raw_to_key.values())) != len(raw_to_key):
        raise ValueError("Colisión de nombres normalizados")
    df.rename(columns=raw_to_key, inplace=True)
    df["FECHA_INGRESO"] = pd.to_datetime(df.FECHA_INGRESO, errors="coerce")
    if not (df.FECHA_INGRESO.dt.month == df.MES).all():
        raise ValueError("MES no coincide con la fecha de ingreso")
    months = sorted(df.FECHA_INGRESO.dt.strftime("%Y-%m").dropna().unique().tolist())
    if df.FECHA_INGRESO.isna().any():
        raise ValueError("Hay fechas sin registro; resolver antes de generar filtros")
    month_codes = pd.Categorical(df.FECHA_INGRESO.dt.strftime("%Y-%m"), categories=months).codes
    depts = sorted(df.DPTO_UBI_CEM.map(clean).unique().tolist())
    if "" in depts:
        raise ValueError("Departamento de atención vacío")
    dept_codes = pd.Categorical(df.DPTO_UBI_CEM.map(clean), categories=depts).codes
    group_codes = month_codes.astype(np.int32) * len(depts) + dept_codes
    group_count = len(months) * len(depts)
    masks = population_masks(df)
    cubes = {}
    totals = {}
    for pop, mask in masks.items():
        ns = np.bincount(group_codes[mask], minlength=group_count)
        totals[pop] = int(mask.sum())
        cubes[pop] = [[g // len(depts), g % len(depts), int(n), []] for g, n in enumerate(ns)]
    fields, audit, encoded = [], [], []
    offset = 0
    for i, raw in enumerate(meta.column_names):
        c = key(raw)
        label = clean(full.column_names_to_labels.get(raw, meta.column_names_to_labels.get(raw))) or clean(raw)
        if raw not in selected or c == "MES":
            audit.append({"variable": c, "label": label, "decision": "Filtro derivado de fecha" if c == "MES" else "No publicado: texto libre, identificador, fecha exacta o campo sin categorías verificadas", "registered": "", "missing": "", "section": ""})
            continue
        s = df[c]
        labels = {v: clean(l) for v, l in full.variable_value_labels.get(raw, {}).items()}
        note = "Porcentajes sobre los casos seleccionados. Se conservan por separado los valores sin registro o no aplicables."
        if c.startswith(("HIJAS_", "HIJOS_")):
            s = s.map(lambda v: None if pd.isna(v) or v < 0 else str(int(v)) if v < 5 else "5 o más")
            labels = {v: v for v in ["0", "1", "2", "3", "4", "5 o más"]}
        elif s.dtype == object:
            s = s.map(lambda v: clean(v) if pd.notna(v) and clean(v) else None)
        observed = sorted(s.dropna().unique().tolist(), key=lambda x: (isinstance(x, str), x))
        if labels:
            values = sorted(set(labels) | set(observed), key=lambda x: (isinstance(x, str), x))
        else:
            values = observed
        cats = [labels.get(v, clean(v) if isinstance(v, str) else str(int(v)) if float(v).is_integer() else str(v)) for v in values]
        codes = pd.Categorical(s, categories=values).codes.astype(np.int32)
        valid = int((codes >= 0).sum())
        if c == "VICTIMA_TIEMPO_GESTACION":
            note += " Meses registrados; no se asumen como edad gestacional clínica."
        if len(observed) == 1 and observed[0] == 1 and labels.get(1, "").lower() in {"si", "sí"}:
            note = "Marca afirmativa. Un vacío no equivale a No. Porcentaje de casos con marca afirmativa sobre la selección; puede formar parte de una pregunta de respuesta múltiple."
        if c == "DIST_POBRE":
            note = "Clasificación territorial registrada en la fuente; no mide la pobreza de la persona usuaria. Un vacío no equivale a No."
        if c == "AREA_DISTRITO":
            note = "Perfil del distrito según la fuente; no equivale al área de residencia individual."
        missing_label = "Sin registro / no aplicable"
        cats.append(missing_label)
        codes[codes < 0] = len(cats) - 1
        title = TITLES.get(c, label)
        title = re.sub(r"^Plan de Atención Integral:\s*", "", title)
        field = {"id": c, "title": title, "section": section(c, i), "labels": cats,
                 "offset": offset, "size": len(cats), "missingIndex": len(cats)-1,
                 "registered": valid, "note": note,
                 "yesIndex": next((j for j, v in enumerate(values) if v == 1 and labels.get(v, "").lower() in {"si", "sí"}), -1)}
        fields.append(field)
        encoded.append(codes)
        for pop, mask in masks.items():
            counts = np.bincount(group_codes[mask] * len(cats) + codes[mask], minlength=group_count * len(cats)).reshape(group_count, len(cats))
            assert np.array_equal(counts.sum(axis=1), np.array([g[2] for g in cubes[pop]])), c
            for g in np.flatnonzero(counts.sum(axis=1)):
                nonzero = np.flatnonzero(counts[g])
                pairs = np.column_stack((nonzero + offset, counts[g, nonzero])).ravel().tolist()
                cubes[pop][g][3].extend(pairs)
        audit.append({"variable": c, "label": label, "decision": "Indicador agregado", "registered": valid, "missing": len(df)-valid, "section": field["section"]})
        offset += len(cats)
    cubes = {p: [g for g in gs if g[2]] for p, gs in cubes.items()}
    # Validate independent selections against direct source counts, not just totals.
    checks = []
    rng = np.random.default_rng(20260919)
    for pop, mask in masks.items():
        for _ in range(4):
            mm = sorted(rng.choice(len(months), size=min(3, len(months)), replace=False).tolist())
            dd = sorted(rng.choice(len(depts), size=min(4, len(depts)), replace=False).tolist())
            source_mask = mask & np.isin(month_codes, mm) & np.isin(dept_codes, dd)
            vector = np.zeros(offset, dtype=np.int32)
            selected_cubes = [g for g in cubes[pop] if g[0] in mm and g[1] in dd]
            assert sum(g[2] for g in selected_cubes) == int(source_mask.sum())
            for g in selected_cubes:
                pairs = np.array(g[3]).reshape(-1, 2)
                vector[pairs[:, 0]] += pairs[:, 1]
            for f, codes in zip(fields, encoded):
                expected = np.bincount(codes[source_mask], minlength=f["size"])
                assert np.array_equal(expected, vector[f["offset"]:f["offset"]+f["size"]]), f["id"]
            checks.append({"population": pop, "months": mm, "departments": dd, "total": int(source_mask.sum()), "all_indicators_match": True})
    relationships = []
    for child, parent, value in [("FRECUENCIA_AGREDE", "PRIMERA_VEZ_AGREDE", 0), ("DENUNCIA_ANTERIORES_HECHOS", "PRIMERA_VEZ_AGREDE", 0), ("LUGAR_ESTUDIA", "ESTUDIA", 1), ("OCUPACION_VICTIMA", "TRABAJA_VICTIMA", 1), ("VICTIMA_TIEMPO_GESTACION", "VICTIMA_GESTANDO", 1)]:
        valid = df[child].notna()
        eligible = df[parent] == value
        relationships.append({"field": child, "condition": f"{parent} = {value}", "registered": int(valid.sum()), "eligible": int(eligible.sum()), "registered_outside_condition": int((valid & ~eligible).sum()), "eligible_without_registration": int((~valid & eligible).sum())})
    for f in fields:
        rel = next((r for r in relationships if r["field"] == f["id"]), None)
        if rel:
            f["note"] += f" Comprobación en la fuente: {rel['registered_outside_condition']} registros fuera de la condición {rel['condition']}; {rel['eligible_without_registration']} registros sin respuesta dentro de ella."
    old = ROOT / "pagina/data/casos_data.js"
    existing = json.loads(old.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";"))
    same_cut = Path(existing.get("generado", {}).get("fuente", "")).name == source.name
    for pop in dict(POPULATIONS):
        if same_cut and pop != "total":
            assert totals[pop] == existing[pop]["total"], f"Diferencia con versión actual: {pop}"
    annual = {p: existing[p].get("historico_anual", {}) for p in ("hombres", "mujeres")}
    data = {"meta": {"source": source.name, "rows": len(df), "variables": meta.number_columns,
                     "indicators": len(fields), "generated": datetime.now().isoformat(timespec="seconds"),
                     "period": f"{MONTHS[int(months[0][-2:])-1]} - {MONTHS[int(months[-1][-2:])-1]} {months[-1][:4]}",
                     "preliminary": True, "totals": totals, "checks": len(checks)},
            "sections": [{"id": a, "title": b, "description": c} for a, b, c in SECTIONS],
            "populations": [{"id": a, "title": b} for a, b in POPULATIONS],
            "months": [{"id": i, "title": MONTHS[int(m[-2:])-1] + " " + m[:4]} for i, m in enumerate(months)],
            "departments": depts, "fields": fields, "vectorSize": offset, "cubes": cubes,
            "annual": annual, "audit": {"relationships": relationships, "variables": audit}}
    (OUT / "data.js").write_text("window.DASH_DATA=" + json.dumps(data, ensure_ascii=True, separators=(",", ":")) + ";\n", encoding="ascii")
    with (OUT / "diccionario_variables.csv").open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(audit[0]))
        writer.writeheader()
        writer.writerows(audit)
    report = {"source": source.name, "totals": totals, "indicators": len(fields), "source_variables": meta.number_columns,
              "excluded": sum(a["decision"] != "Indicador agregado" for a in audit),
              "conditional_checks": relationships, "filter_checks": checks,
              "no_record_rows_exported": True, "payload_bytes": (OUT / "data.js").stat().st_size}
    (OUT / "validacion.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / "data/BD_Registro_casos_agosto_2026_SDP.sav")
    args = parser.parse_args()
    main(args.source)
