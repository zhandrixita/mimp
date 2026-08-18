"""
Genera pagina/data/casos_data.js a partir del registro de casos (.sav) del CEM.

Este script se debe volver a ejecutar cada vez que se actualiza la base .sav
(ej. cada mes/corte). Solo escribe los AGREGADOS (conteos y porcentajes) que
necesita la pagina web -- nunca las filas crudas -- para que el archivo JS
que carga el navegador se mantenga pequeno (KB) sin importar cuantos casos
tenga la base (filas).

Salida: pagina/data/casos_data.js
    window.CASOS_DATA = { hombres: {...}, mujeres: {...}, total: {...}, generado: {...} }
"""

import json

import pandas as pd
import pyreadstat

RUTA_SAV = "data/BD_Registro_casos_julio_2026_SDP.sav"
SALIDA_JS = "pagina/data/casos_data.js"
SALIDA_EXCEL = "pagina/data/casos_tablas.xlsx"

# Historico 2021-2025: no esta en el .sav actual (que solo trae el corte
# preliminar de 2026), son cifras fijas proporcionadas directamente.
# 2026 SI se calcula desde el .sav (ver resumen() / historico_anual).
HISTORICO_ESTATICO = {
    "hombres": {2021: 22964, 2022: 20766, 2023: 24131, 2024: 26348, 2025: 27728},
    "mujeres": {2021: 140833, 2022: 133436, 2023: 142182, 2024: 142144, 2025: 141808},
}
HISTORICO_ESTATICO["total"] = {
    anio: HISTORICO_ESTATICO["hombres"][anio] + HISTORICO_ESTATICO["mujeres"][anio]
    for anio in HISTORICO_ESTATICO["hombres"]
}

COLUMNAS = [
    "SEXO_VICTIMA",
    "EDAD_GRANDE",
    "ESTADO_CIVIL_VICTIMA",
    "DISCAPACIDAD_VICTIMA",
    "VICTIMA_EXTRANJERA",
    "VICTIMA_PERUANA",
    "TRABAJA_VICTIMA",
    "NIVEL_DE_RIESGO_VICTIMA",
    "VINCULO_AGRESOR_VICTIMA",
    "ACOSO_SEX_ESP_PUB",
    "TRATA_CON_FINES_EXPLOTACION_SEXUAL",
    "HOSTIGAMIENTO_SEXUAL",
    "VIOLACION",
    "TIPO_VIOLENCIA",
    "DPTO_UBI_CEM",
    "REGION_UBI_CEM",
    "FECHA_INGRESO",
    # --- v2: perfil de la persona agresora ---
    "SEXO_AGRESOR",
    "EDAD_GRANDE_AGRESOR",
    "NIVEL_EDUCATIVO_AGRESOR",
    "TRABAJA_AGRESOR",
    "DISCAPACIDAD_AGRESOR",
    # --- v2: detalle victima ---
    "NIVEL_EDUCATIVO_VICTIMA",
    "VICTIMA_DISCAPACIDAD_FISICA",
    "VICTIMA_DISCAPACIDAD_VISUAL",
    "VICTIMA_DISCAPACIDAD_AUDITIVA",
    "VICTIMA_DISCAPACIDAD_PSICOSOCIAL",
    "VICTIMA_DISCAPACIDAD_INTELECTUAL",
    "SIS_SEGURO",
    "ESSALUD_SEGURO",
    "PRIVADO_SEGURO",
    "PNP_SEGURO",
    "NINGUN_SEGURO",
    "ETNIA_VICTIMA",
    # --- v2: lugar / ambito ---
    "LUGAR_OCURRENCIA",
    "AMBITO_VIOLENCIA",
    # --- v2: atencion y seguimiento del CEM ---
    "INTERPUSO_DENUNCIA",
    "CUENTA_MEDIDAS_PROTECCION",
    "CUENTA_MEDIDAS_CAUTELARES",
    "ATENCION_INTEGRAL",
    "ATENCION_INTERDISCIPLINARIA",
    "SENTENCIA_FAVORABLE",
    # --- v2: factores de riesgo (persona usuaria) ---
    "FACTOR_VICTIMA_CARENCIA_RED_FAMILIAR",
    "FACTOR_VICTIMA_DEPENDE_ECONOMICAMENTE_AGRESOR",
    "FACTOR_VICTIMA_JUSTIFICA_AGRESIONES",
    "FACTOR_VICTIMA_INTENTA_RETIRAR_DENUNCIA",
    "FACTOR_VICTIMA_INICIA_NUEVA_RELACION",
    "FACTOR_VICTIMA_AISLAMIENTO",
    "FACTOR_VICTIMA_VULNERABILIDAD",
    "FACTOR_VICTIMA_DISCAPACIDAD",
    "FACTOR_VICTIMA_DEPENDE_EMOCIONALMENTE_AGRESOR",
    "FACTOR_VICTIMA_PERCIBE_PELIGRO_DE_MUERTE",
    "FACTOR_VICTIMA_ABUSO_CONSUMO_ALCOHOL",
    "FACTOR_VICTIMA_CONSUME_DROGAS",
    "FACTOR_VICTIMA_HISTORIAL_VIOLENCIA_OTRA_PAREJA",
    "FACTOR_VICTIMA_INDEFENSION",
    "FACTOR_VICTIMA_TENTATIVA_DE_FEMINICIDIO",
    "FACTOR_VICTIMA_PROBLEMA_COMPORTAMENTAL",
    "FACTOR_VICTIMA_INTENTO_DE_SUICIDIO",
    "FACTOR_VICTIMA_INSEGURIDAD_EN_VIVIENDA",
    "FACTOR_VICTIMA_AUSENCIA_DE_CUIDADOR",
    "FACTOR_VICTIMA_OTRO",
    # --- v2: factores de riesgo (presunta persona agresora) ---
    "FACTOR_AGRESOR_VFIS_CAUSA_LESION",
    "FACTOR_AGRESOR_VFIS_PRESENCIA_HIJOS_FAMILIARES",
    "FACTOR_AGRESOR_AMENAZA_CON_OBJETO_PELIGROSO",
    "FACTOR_AGRESOR_ACCESO_ARMA_DE_FUEGO",
    "FACTOR_AGRESOR_AMENAZA_DE_MUERTE",
    "FACTOR_AGRESOR_TIENE_ACCESO_A_VICTIMA",
    "FACTOR_AGRESOR_AUMENTA_EPISODIO_VIOLENTO",
    "FACTOR_AGRESOR_INTENCION_DE_CAUSAR_LESION",
    "FACTOR_AGRESOR_TENTATIVA_DE_FEMINICIDIO",
    "FACTOR_AGRESOR_AGRESION_SEXUAL_DE_PAREJA",
    "FACTOR_AGRESOR_VIOLENTA_HIJOS_FAMILIARES",
    "FACTOR_AGRESOR_INCUMPLE_MEDIDA_PROTECCION",
    "FACTOR_AGRESOR_CELOS_PATOLOGICOS",
    "FACTOR_AGRESOR_HISTORIAL_VIOLENCIA_PAREJA",
    "FACTOR_AGRESOR_HISTORIAL_VIOLENCIA_OTRA_PERSONA",
    "FACTOR_AGRESOR_CONSUMO_ALCOHOL",
    "FACTOR_AGRESOR_CONSUME_DROGA",
    "FACTOR_AGRESOR_ENFERMEDAD_MENTAL",
    "FACTOR_AGRESOR_CONDUCTAS_DE_CRUELDAD",
    "FACTOR_AGRESOR_NEGATIVA_A_SEPARACION",
    "FACTOR_AGRESOR_ANTECEDENTE_LEGAL",
    "FACTOR_AGRESOR_NEGLIGENTE",
    "FACTOR_AGRESOR_LIMITACION_FISICA",
    "FACTOR_AGRESOR_SIN_RED_DE_APOYO",
    "FACTOR_AGRESOR_HISTORIAL_DE_MALTRATO",
    "FACTOR_AGRESOR_RESPUESTA_NEGATIVA",
    "FACTOR_AGRESOR_OTRO",
    # --- v2: sub-actos por tipo de violencia ---
    "PERTURBACION_POSESION",
    "MENOSCABO_TENENCIA_BIENES",
    "PERDIDA_DERECHOS_PATRIMONIALES",
    "LIMITACION_RECURSOS_ECONOMICOS",
    "PRIVACION_MEDIOS_INDISPENSABLES",
    "INCUMPLIMIENTO_OBLIGACION_ALIMENTARIA",
    "CONTROL_DE_INGRESOS",
    "PERCEPCION_SALARIO_MENOR",
    "PROHIBIR_DES_LABORAL",
    "SUSTRAER_INGRESOS",
    "FRACCION_RECURSOS_NEC",
    "OBLIGACION_ALIMENTOS",
    "DESTRUIR_INST_TRABAJO",
    "DESTRUIR_BIEN_PERSONAL",
    "GRITOS_INSULTOS",
    "VIOLENCIA_RACIAL",
    "INDIFERENCIA",
    "DISCR_ORIENTACION_SEXUAL",
    "DISCR_GENERO",
    "DISCR_IDENTIDAD_GENERO",
    "RECHAZO",
    "DESVALORIZACION_HUMILLACION",
    "AMENAZA_QUITAR_HIJOS",
    "OTRAS_AMENAZAS",
    "PROHIBE_RECIBIR_VISITAS",
    "PROHIBE_ESTUDIAR_TRABAJAR_SALIR",
    "ROMPE_DESTRUYE_COSAS",
    "VIGILANCIA_CONTINUA_PERSECUCION",
    "BOTAR_CASA",
    "AMENAZA_DE_MUERTE",
    "ABANDONO",
    "PUNTAPIES_PATADAS",
    "BOFETADAS",
    "JALONES_CABELLO",
    "MORDEDURA",
    "OTRAS_AGRESIONES",
    "EMPUJONES",
    "GOLPES_CON_PALOS",
    "LATIGAZO",
    "AHORCAMIENTO",
    "HERIDAS_CON_ARMAS",
    "GOLPES_CON_OBJETOS_CONTUNDENTES",
    "NEGLIGENCIA",
    "QUEMADURA",
    "EXPLOTACION_SEXUAL",
    "PORNOGRAFIA",
    "EXHIBICION_OBSCENIDAD",
    "PROP_NNA_MED_TEC",
    "ACOSO_SEXUAL",
    "CHANTAJE_SEXUAL",
    "DIF_IMAGEN_CONT_SEX",
    "TOCAMIENTO_SIN_CONSENTIMIENTO",
    "TOCAMIENTO_AGRAVIO_MENORES",
]

# Grupos de sub-actos por tipo de violencia (para el detalle "ver mas").
# Se excluyen un par de columnas cuyo NOMBRE de columna trae un caracter mal
# codificado en el propio .sav (ej. PU\x91ETAZOS) -- no es el bug de
# _des_mojibake (que corrige ETIQUETAS, no nombres de columna), asi que se
# omiten en vez de arriesgar un KeyError.
SUBACTOS_POR_TIPO = {
    "economica": [
        "PERTURBACION_POSESION", "MENOSCABO_TENENCIA_BIENES", "PERDIDA_DERECHOS_PATRIMONIALES",
        "LIMITACION_RECURSOS_ECONOMICOS", "PRIVACION_MEDIOS_INDISPENSABLES",
        "INCUMPLIMIENTO_OBLIGACION_ALIMENTARIA", "CONTROL_DE_INGRESOS", "PERCEPCION_SALARIO_MENOR",
        "PROHIBIR_DES_LABORAL", "SUSTRAER_INGRESOS", "FRACCION_RECURSOS_NEC", "OBLIGACION_ALIMENTOS",
        "DESTRUIR_INST_TRABAJO", "DESTRUIR_BIEN_PERSONAL",
    ],
    "psicologica": [
        "GRITOS_INSULTOS", "VIOLENCIA_RACIAL", "INDIFERENCIA", "DISCR_ORIENTACION_SEXUAL",
        "DISCR_GENERO", "DISCR_IDENTIDAD_GENERO", "RECHAZO", "DESVALORIZACION_HUMILLACION",
        "AMENAZA_QUITAR_HIJOS", "OTRAS_AMENAZAS", "PROHIBE_RECIBIR_VISITAS",
        "PROHIBE_ESTUDIAR_TRABAJAR_SALIR", "ROMPE_DESTRUYE_COSAS", "VIGILANCIA_CONTINUA_PERSECUCION",
        "BOTAR_CASA", "AMENAZA_DE_MUERTE", "ABANDONO",
    ],
    "fisica": [
        "PUNTAPIES_PATADAS", "BOFETADAS", "JALONES_CABELLO", "MORDEDURA", "OTRAS_AGRESIONES",
        "EMPUJONES", "GOLPES_CON_PALOS", "LATIGAZO", "AHORCAMIENTO", "HERIDAS_CON_ARMAS",
        "GOLPES_CON_OBJETOS_CONTUNDENTES", "NEGLIGENCIA", "QUEMADURA",
    ],
    "sexual": [
        "HOSTIGAMIENTO_SEXUAL", "ACOSO_SEX_ESP_PUB", "VIOLACION", "TRATA_CON_FINES_EXPLOTACION_SEXUAL",
        "EXPLOTACION_SEXUAL", "PORNOGRAFIA", "EXHIBICION_OBSCENIDAD", "PROP_NNA_MED_TEC",
        "ACOSO_SEXUAL", "CHANTAJE_SEXUAL", "DIF_IMAGEN_CONT_SEX", "TOCAMIENTO_SIN_CONSENTIMIENTO",
        "TOCAMIENTO_AGRAVIO_MENORES",
    ],
}

FACTORES_VICTIMA = [
    "FACTOR_VICTIMA_CARENCIA_RED_FAMILIAR", "FACTOR_VICTIMA_DEPENDE_ECONOMICAMENTE_AGRESOR",
    "FACTOR_VICTIMA_JUSTIFICA_AGRESIONES", "FACTOR_VICTIMA_INTENTA_RETIRAR_DENUNCIA",
    "FACTOR_VICTIMA_INICIA_NUEVA_RELACION", "FACTOR_VICTIMA_AISLAMIENTO", "FACTOR_VICTIMA_VULNERABILIDAD",
    "FACTOR_VICTIMA_DISCAPACIDAD", "FACTOR_VICTIMA_DEPENDE_EMOCIONALMENTE_AGRESOR",
    "FACTOR_VICTIMA_PERCIBE_PELIGRO_DE_MUERTE", "FACTOR_VICTIMA_ABUSO_CONSUMO_ALCOHOL",
    "FACTOR_VICTIMA_CONSUME_DROGAS", "FACTOR_VICTIMA_HISTORIAL_VIOLENCIA_OTRA_PAREJA",
    "FACTOR_VICTIMA_INDEFENSION", "FACTOR_VICTIMA_TENTATIVA_DE_FEMINICIDIO",
    "FACTOR_VICTIMA_PROBLEMA_COMPORTAMENTAL", "FACTOR_VICTIMA_INTENTO_DE_SUICIDIO",
    "FACTOR_VICTIMA_INSEGURIDAD_EN_VIVIENDA", "FACTOR_VICTIMA_AUSENCIA_DE_CUIDADOR", "FACTOR_VICTIMA_OTRO",
]

FACTORES_AGRESOR = [
    "FACTOR_AGRESOR_VFIS_CAUSA_LESION", "FACTOR_AGRESOR_VFIS_PRESENCIA_HIJOS_FAMILIARES",
    "FACTOR_AGRESOR_AMENAZA_CON_OBJETO_PELIGROSO", "FACTOR_AGRESOR_ACCESO_ARMA_DE_FUEGO",
    "FACTOR_AGRESOR_AMENAZA_DE_MUERTE", "FACTOR_AGRESOR_TIENE_ACCESO_A_VICTIMA",
    "FACTOR_AGRESOR_AUMENTA_EPISODIO_VIOLENTO", "FACTOR_AGRESOR_INTENCION_DE_CAUSAR_LESION",
    "FACTOR_AGRESOR_TENTATIVA_DE_FEMINICIDIO", "FACTOR_AGRESOR_AGRESION_SEXUAL_DE_PAREJA",
    "FACTOR_AGRESOR_VIOLENTA_HIJOS_FAMILIARES", "FACTOR_AGRESOR_INCUMPLE_MEDIDA_PROTECCION",
    "FACTOR_AGRESOR_CELOS_PATOLOGICOS", "FACTOR_AGRESOR_HISTORIAL_VIOLENCIA_PAREJA",
    "FACTOR_AGRESOR_HISTORIAL_VIOLENCIA_OTRA_PERSONA", "FACTOR_AGRESOR_CONSUMO_ALCOHOL",
    "FACTOR_AGRESOR_CONSUME_DROGA", "FACTOR_AGRESOR_ENFERMEDAD_MENTAL",
    "FACTOR_AGRESOR_CONDUCTAS_DE_CRUELDAD", "FACTOR_AGRESOR_NEGATIVA_A_SEPARACION",
    "FACTOR_AGRESOR_ANTECEDENTE_LEGAL", "FACTOR_AGRESOR_NEGLIGENTE", "FACTOR_AGRESOR_LIMITACION_FISICA",
    "FACTOR_AGRESOR_SIN_RED_DE_APOYO", "FACTOR_AGRESOR_HISTORIAL_DE_MALTRATO",
    "FACTOR_AGRESOR_RESPUESTA_NEGATIVA", "FACTOR_AGRESOR_OTRO",
]

# Nivel educativo (12 categorias crudas) consolidado a 5 grupos legibles.
BUCKETS_EDUCACION = {
    1.0: "Sin nivel / Inicial", 2.0: "Sin nivel / Inicial",
    3.0: "Primaria", 4.0: "Primaria",
    5.0: "Secundaria", 6.0: "Secundaria",
    7.0: "Superior", 8.0: "Superior", 9.0: "Superior", 10.0: "Superior",
    11.0: "Básica especial",
    12.0: "Posgrado",
}


def _des_mojibake(texto):
    """
    Revierte un bug de pyreadstat: en una lectura completa (no metadataonly)
    con encoding="latin1", las etiquetas de valor quedan decodificadas dos
    veces (ej. "años" -> "aÃ±os"). En metadataonly no ocurre, lo que confirma
    que es un problema interno de pyreadstat y no del archivo .sav.
    """
    try:
        return texto.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return texto


def cargar():
    # encoding="latin1": el archivo declara UTF-8 en su cabecera pero las
    # etiquetas de valor (ej. "años") estan realmente en Latin-1; sin esto
    # pyreadstat las corrompe (reemplaza los caracteres acentuados por "�").
    df, meta = pyreadstat.read_sav(
        RUTA_SAV, usecols=COLUMNAS, apply_value_formats=False, encoding="latin1"
    )

    for columna, etiquetas in meta.variable_value_labels.items():
        meta.variable_value_labels[columna] = {
            valor: _des_mojibake(texto) for valor, texto in etiquetas.items()
        }
    # El mismo bug de doble-decodificacion de pyreadstat afecta tambien las
    # etiquetas de VARIABLE (ej. "Factor de riesgo ... : Depende económicamente
    # de la presunta persona agresora"), usadas en top_banderas() para
    # factores de riesgo y sub-actos de violencia.
    meta.column_names_to_labels = {
        col: _des_mojibake(label) for col, label in meta.column_names_to_labels.items()
    }

    # Replica el IF(VICTIMA_EXTRANJERA=1 & VICTIMA_PERUANA=0) del .sps
    df["EXTRANJERO_REPORTE"] = (
        (df["VICTIMA_EXTRANJERA"] == 1) & (df["VICTIMA_PERUANA"] == 0)
    ).astype(int)

    df["ANIO"] = pd.to_datetime(df["FECHA_INGRESO"]).dt.year

    return df, meta


def conteo_pct(serie, etiquetas, total):
    """value_counts + % sobre el total, con las etiquetas de valor de SPSS aplicadas."""
    conteo = serie.value_counts(dropna=True)
    salida = {}
    for valor, n in conteo.items():
        clave = etiquetas.get(valor, str(valor)) if etiquetas else str(valor)
        salida[clave] = {"casos": int(n), "pct": round(float(n) / total * 100, 1)}
    return salida


def bandera_pct(serie, total):
    """Cuenta cuantos == 1 en una columna binaria (1=Si, resto=No/perdido)."""
    n = int((serie == 1).sum())
    return {"casos": n, "pct": round(n / total * 100, 1)}


def top_banderas(d, meta, columnas, total, top_n=10):
    """% de cada columna binaria (1=Si) de una lista, con la etiqueta corta
    (lo que sigue despues de ':' en la etiqueta de variable de SPSS),
    ordenado de mayor a menor. Para rankings (factores de riesgo, sub-actos)."""
    filas = []
    for col in columnas:
        n = int((d[col] == 1).sum())
        if n == 0:
            continue
        etiqueta_completa = meta.column_names_to_labels.get(col, col)
        etiqueta = etiqueta_completa.split(":", 1)[-1].strip()
        filas.append({"label": etiqueta, "casos": n, "pct": round(n / total * 100, 1)})
    filas.sort(key=lambda f: -f["casos"])
    return filas[:top_n]


def conteo_por_bucket(serie, buckets, orden, total):
    """Como conteo_pct, pero agrupando valores crudos en buckets (ej. 12
    niveles educativos -> 5 grupos legibles), preservando el orden dado."""
    agrupado = serie.map(buckets)
    conteo = agrupado.value_counts(dropna=True)
    salida = {}
    for clave in orden:
        n = int(conteo.get(clave, 0))
        if n == 0:
            continue
        salida[clave] = {"casos": n, "pct": round(n / total * 100, 1)}
    return salida


ORDEN_EDUCACION = ["Sin nivel / Inicial", "Primaria", "Secundaria", "Superior", "Básica especial", "Posgrado"]


def resumen(df, meta, filtro=None, historico_previo=None):
    d = df if filtro is None else df[filtro]
    total = len(d)

    edad = conteo_pct(d["EDAD_GRANDE"], meta.variable_value_labels.get("EDAD_GRANDE"), total)
    estado_civil = conteo_pct(
        d["ESTADO_CIVIL_VICTIMA"], meta.variable_value_labels.get("ESTADO_CIVIL_VICTIMA"), total
    )
    nivel_riesgo = conteo_pct(
        d["NIVEL_DE_RIESGO_VICTIMA"], meta.variable_value_labels.get("NIVEL_DE_RIESGO_VICTIMA"), total
    )
    vinculo_agresor = conteo_pct(
        d["VINCULO_AGRESOR_VICTIMA"], meta.variable_value_labels.get("VINCULO_AGRESOR_VICTIMA"), total
    )
    tipo_violencia = conteo_pct(
        d["TIPO_VIOLENCIA"], meta.variable_value_labels.get("TIPO_VIOLENCIA"), total
    )

    modalidades_sexuales = {
        "acoso_sexual_espacios_publicos": bandera_pct(d["ACOSO_SEX_ESP_PUB"], total),
        "trata_fines_explotacion_sexual": bandera_pct(d["TRATA_CON_FINES_EXPLOTACION_SEXUAL"], total),
        "hostigamiento_sexual": bandera_pct(d["HOSTIGAMIENTO_SEXUAL"], total),
        "violacion": bandera_pct(d["VIOLACION"], total),
    }

    # DPTO_UBI_CEM: 25 departamentos -- para el mapa (coincide con geodata.js: nombdep)
    por_departamento = conteo_pct(d["DPTO_UBI_CEM"], None, total)
    # REGION_UBI_CEM: 26 categorias, separa Lima Metropolitana / Lima Provincia -- para el listado ordenado
    por_region = conteo_pct(d["REGION_UBI_CEM"], None, total)

    historico_anual = {int(a): int(n) for a, n in d.groupby("ANIO").size().sort_index().items()}
    if historico_previo:
        historico_anual = {**historico_previo, **historico_anual}
    historico_anual = dict(sorted(historico_anual.items()))

    # --- v2: perfil de la persona agresora ---
    agresor_sexo = conteo_pct(d["SEXO_AGRESOR"], meta.variable_value_labels.get("SEXO_AGRESOR"), total)
    agresor_edad = conteo_pct(
        d["EDAD_GRANDE_AGRESOR"], meta.variable_value_labels.get("EDAD_GRANDE_AGRESOR"), total
    )
    agresor_educacion = conteo_por_bucket(d["NIVEL_EDUCATIVO_AGRESOR"], BUCKETS_EDUCACION, ORDEN_EDUCACION, total)

    # --- v2: detalle victima ---
    educacion_victima = conteo_por_bucket(d["NIVEL_EDUCATIVO_VICTIMA"], BUCKETS_EDUCACION, ORDEN_EDUCACION, total)
    discapacidad_detalle = {
        "fisica": bandera_pct(d["VICTIMA_DISCAPACIDAD_FISICA"], total),
        "visual": bandera_pct(d["VICTIMA_DISCAPACIDAD_VISUAL"], total),
        "auditiva": bandera_pct(d["VICTIMA_DISCAPACIDAD_AUDITIVA"], total),
        "psicosocial": bandera_pct(d["VICTIMA_DISCAPACIDAD_PSICOSOCIAL"], total),
        "intelectual": bandera_pct(d["VICTIMA_DISCAPACIDAD_INTELECTUAL"], total),
    }
    seguro_medico = {
        "sis": bandera_pct(d["SIS_SEGURO"], total),
        "essalud": bandera_pct(d["ESSALUD_SEGURO"], total),
        "privado": bandera_pct(d["PRIVADO_SEGURO"], total),
        "pnp_ffaa": bandera_pct(d["PNP_SEGURO"], total),
        "ninguno": bandera_pct(d["NINGUN_SEGURO"], total),
    }
    etnia = conteo_pct(d["ETNIA_VICTIMA"], meta.variable_value_labels.get("ETNIA_VICTIMA"), total)

    # --- v2: lugar / ambito de ocurrencia ---
    lugar_ocurrencia = conteo_pct(
        d["LUGAR_OCURRENCIA"], meta.variable_value_labels.get("LUGAR_OCURRENCIA"), total
    )
    ambito_violencia = conteo_pct(
        d["AMBITO_VIOLENCIA"], meta.variable_value_labels.get("AMBITO_VIOLENCIA"), total
    )

    # --- v2: atencion y seguimiento del CEM ---
    atencion_seguimiento = {
        "denuncia_interpuesta": bandera_pct(d["INTERPUSO_DENUNCIA"], total),
        "medidas_proteccion": bandera_pct(d["CUENTA_MEDIDAS_PROTECCION"], total),
        "medidas_cautelares": bandera_pct(d["CUENTA_MEDIDAS_CAUTELARES"], total),
        "atencion_integral": bandera_pct(d["ATENCION_INTEGRAL"], total),
        "atencion_interdisciplinaria": bandera_pct(d["ATENCION_INTERDISCIPLINARIA"], total),
        "sentencia_favorable": bandera_pct(d["SENTENCIA_FAVORABLE"], total),
    }

    # --- v2: rankings (factores de riesgo, sub-actos por tipo de violencia) ---
    factores_riesgo_victima = top_banderas(d, meta, FACTORES_VICTIMA, total, top_n=8)
    factores_riesgo_agresor = top_banderas(d, meta, FACTORES_AGRESOR, total, top_n=8)
    subactos_violencia = {
        tipo: top_banderas(d, meta, columnas, total, top_n=6)
        for tipo, columnas in SUBACTOS_POR_TIPO.items()
    }

    return {
        "total": total,
        "edad": edad,
        "estado_civil": estado_civil,
        "discapacidad": bandera_pct(d["DISCAPACIDAD_VICTIMA"], total),
        "extranjero": bandera_pct(d["EXTRANJERO_REPORTE"], total),
        "trabaja": bandera_pct(d["TRABAJA_VICTIMA"], total),
        "nivel_riesgo": nivel_riesgo,
        "vinculo_agresor": vinculo_agresor,
        "modalidades_sexuales": modalidades_sexuales,
        "tipo_violencia": tipo_violencia,
        "por_departamento": por_departamento,
        "por_region": por_region,
        "historico_anual": historico_anual,
        "agresor_sexo": agresor_sexo,
        "agresor_edad": agresor_edad,
        "agresor_educacion": agresor_educacion,
        "agresor_trabaja": bandera_pct(d["TRABAJA_AGRESOR"], total),
        "agresor_discapacidad": bandera_pct(d["DISCAPACIDAD_AGRESOR"], total),
        "educacion_victima": educacion_victima,
        "discapacidad_detalle": discapacidad_detalle,
        "seguro_medico": seguro_medico,
        "etnia": etnia,
        "lugar_ocurrencia": lugar_ocurrencia,
        "ambito_violencia": ambito_violencia,
        "atencion_seguimiento": atencion_seguimiento,
        "factores_riesgo_victima": factores_riesgo_victima,
        "factores_riesgo_agresor": factores_riesgo_agresor,
        "subactos_violencia": subactos_violencia,
    }


def resumen_departamento(d, meta, total):
    """
    Version reducida de resumen(), para el detalle por departamento (popup
    al hacer clic en el mapa). Sin por_departamento/por_region/historico
    -- no aportan nada ya filtrado a un solo departamento.
    """
    if total == 0:
        return {"total": 0}
    return {
        "total": total,
        "edad": conteo_pct(d["EDAD_GRANDE"], meta.variable_value_labels.get("EDAD_GRANDE"), total),
        "estado_civil": conteo_pct(
            d["ESTADO_CIVIL_VICTIMA"], meta.variable_value_labels.get("ESTADO_CIVIL_VICTIMA"), total
        ),
        "discapacidad": bandera_pct(d["DISCAPACIDAD_VICTIMA"], total),
        "extranjero": bandera_pct(d["EXTRANJERO_REPORTE"], total),
        "trabaja": bandera_pct(d["TRABAJA_VICTIMA"], total),
        "nivel_riesgo": conteo_pct(
            d["NIVEL_DE_RIESGO_VICTIMA"], meta.variable_value_labels.get("NIVEL_DE_RIESGO_VICTIMA"), total
        ),
        "vinculo_agresor": conteo_pct(
            d["VINCULO_AGRESOR_VICTIMA"], meta.variable_value_labels.get("VINCULO_AGRESOR_VICTIMA"), total
        ),
        "tipo_violencia": conteo_pct(
            d["TIPO_VIOLENCIA"], meta.variable_value_labels.get("TIPO_VIOLENCIA"), total
        ),
        "atencion_seguimiento": {
            "denuncia_interpuesta": bandera_pct(d["INTERPUSO_DENUNCIA"], total),
            "medidas_proteccion": bandera_pct(d["CUENTA_MEDIDAS_PROTECCION"], total),
            "atencion_integral": bandera_pct(d["ATENCION_INTEGRAL"], total),
        },
    }


def construir_detalle_departamentos(df, meta):
    """{ hombres: {depto: resumen_departamento(...)}, mujeres: {...}, total: {...} }"""
    departamentos = sorted(df["DPTO_UBI_CEM"].dropna().unique())
    filtros_sexo = {"hombres": df["SEXO_VICTIMA"] == 1, "mujeres": df["SEXO_VICTIMA"] == 0, "total": None}
    detalle = {"hombres": {}, "mujeres": {}, "total": {}}
    for depto in departamentos:
        base = df["DPTO_UBI_CEM"] == depto
        for clave, filtro_sexo in filtros_sexo.items():
            mask = base if filtro_sexo is None else (base & filtro_sexo)
            sub = df[mask]
            detalle[clave][depto] = resumen_departamento(sub, meta, len(sub))
    return detalle


def exportar_excel(data, ruta=SALIDA_EXCEL):
    """Exporta los agregados del dashboard a tablas reutilizables en Excel."""
    perfiles = ("total", "hombres", "mujeres")
    categorias = (
        "edad", "estado_civil", "nivel_riesgo", "vinculo_agresor",
        "tipo_violencia", "agresor_sexo", "agresor_edad",
        "agresor_educacion", "educacion_victima", "etnia",
        "lugar_ocurrencia", "ambito_violencia",
    )
    banderas_simples = (
        "discapacidad", "extranjero", "trabaja", "agresor_trabaja",
        "agresor_discapacidad",
    )
    grupos_banderas = (
        "modalidades_sexuales", "discapacidad_detalle", "seguro_medico",
        "atencion_seguimiento",
    )

    resumen_filas = []
    categorias_filas = []
    banderas_filas = []
    historico_filas = []
    departamentos_filas = []
    rankings_filas = []
    detalle_filas = []

    for perfil in perfiles:
        bloque = data[perfil]
        resumen_filas.append({"perfil": perfil, "casos_totales": bloque["total"]})

        for indicador in categorias:
            for categoria, valor in bloque.get(indicador, {}).items():
                categorias_filas.append({
                    "perfil": perfil, "indicador": indicador,
                    "categoria": categoria, "casos": valor["casos"],
                    "porcentaje": valor["pct"],
                })

        for indicador in banderas_simples:
            valor = bloque.get(indicador, {})
            banderas_filas.append({
                "perfil": perfil, "grupo": "general", "indicador": indicador,
                "casos": valor.get("casos", 0), "porcentaje": valor.get("pct", 0),
            })
        for grupo in grupos_banderas:
            for indicador, valor in bloque.get(grupo, {}).items():
                banderas_filas.append({
                    "perfil": perfil, "grupo": grupo, "indicador": indicador,
                    "casos": valor["casos"], "porcentaje": valor["pct"],
                })

        for anio, casos in bloque.get("historico_anual", {}).items():
            historico_filas.append({"perfil": perfil, "anio": anio, "casos": casos})
        for departamento, valor in bloque.get("por_departamento", {}).items():
            departamentos_filas.append({
                "perfil": perfil, "nivel": "departamento", "ubicacion": departamento,
                "casos": valor["casos"], "porcentaje": valor["pct"],
            })
        for region, valor in bloque.get("por_region", {}).items():
            departamentos_filas.append({
                "perfil": perfil, "nivel": "region", "ubicacion": region,
                "casos": valor["casos"], "porcentaje": valor["pct"],
            })

        for grupo in ("factores_riesgo_victima", "factores_riesgo_agresor"):
            for posicion, valor in enumerate(bloque.get(grupo, []), start=1):
                rankings_filas.append({
                    "perfil": perfil, "grupo": grupo, "tipo_violencia": "",
                    "posicion": posicion, **valor,
                })
        for tipo, filas in bloque.get("subactos_violencia", {}).items():
            for posicion, valor in enumerate(filas, start=1):
                rankings_filas.append({
                    "perfil": perfil, "grupo": "subactos_violencia",
                    "tipo_violencia": tipo, "posicion": posicion, **valor,
                })

        for departamento, valores in bloque.get("por_departamento_detalle", {}).items():
            for indicador in ("edad", "estado_civil", "nivel_riesgo", "vinculo_agresor", "tipo_violencia"):
                for categoria, valor in valores.get(indicador, {}).items():
                    detalle_filas.append({
                        "perfil": perfil, "departamento": departamento,
                        "indicador": indicador, "categoria": categoria,
                        "casos": valor["casos"], "porcentaje": valor["pct"],
                    })

    hojas = {
        "Resumen": resumen_filas,
        "Categorias": categorias_filas,
        "Indicadores_si": banderas_filas,
        "Historico": historico_filas,
        "Ubicaciones": departamentos_filas,
        "Rankings": rankings_filas,
        "Detalle_departamento": detalle_filas,
    }
    with pd.ExcelWriter(ruta, engine="openpyxl") as writer:
        for nombre, filas in hojas.items():
            tabla = pd.DataFrame(filas)
            tabla.to_excel(writer, sheet_name=nombre, index=False)
            hoja = writer.sheets[nombre]
            hoja.freeze_panes = "A2"
            hoja.auto_filter.ref = hoja.dimensions
            for columna in hoja.columns:
                ancho = min(max(len(str(celda.value or "")) for celda in columna) + 2, 45)
                hoja.column_dimensions[columna[0].column_letter].width = ancho


def main():
    df, meta = cargar()

    data = {
        "hombres": resumen(df, meta, df["SEXO_VICTIMA"] == 1, HISTORICO_ESTATICO["hombres"]),
        "mujeres": resumen(df, meta, df["SEXO_VICTIMA"] == 0, HISTORICO_ESTATICO["mujeres"]),
        "total": resumen(df, meta, None, HISTORICO_ESTATICO["total"]),
        "generado": {
            "filas_totales": len(df),
            "fuente": RUTA_SAV,
        },
    }

    detalle_departamentos = construir_detalle_departamentos(df, meta)
    for clave in ("hombres", "mujeres", "total"):
        data[clave]["por_departamento_detalle"] = detalle_departamentos[clave]

    # ensure_ascii=True (default): escapa acentos/enies como \uXXXX para que el
    # archivo sea puro ASCII y no dependa de que el servidor declare charset=utf-8
    # al servir el .js (si no lo declara, el navegador puede decodificar mal).
    with open(SALIDA_JS, "w", encoding="ascii") as f:
        f.write("window.CASOS_DATA = ")
        json.dump(data, f, ensure_ascii=True, indent=2)
        f.write(";\n")

    exportar_excel(data)

    print(f"OK -> {SALIDA_JS}")
    print(f"OK -> {SALIDA_EXCEL}")
    print(f"Filas totales: {data['generado']['filas_totales']:,}")
    print(f"Hombres: {data['hombres']['total']:,} | Mujeres: {data['mujeres']['total']:,}")


if __name__ == "__main__":
    main()
