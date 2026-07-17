"""
Convierte un archivo SPSS (.sav) a un DataFrame de pandas incorporando:
- Las etiquetas de variable (nombres descriptivos de columnas) como columnas nuevas *_label
- Las etiquetas de valor (categorias) aplicadas directamente sobre las variables categoricas
"""

import pyreadstat

RUTA_SAV = "data/BD_Registro_casos_junio_2026_SDP.sav"


def _des_mojibake(texto):
    """
    Revierte un bug de pyreadstat: en una lectura completa (no metadataonly)
    con encoding="latin1", los textos quedan decodificados dos veces
    (ej. "años" -> "aÃ±os"). En metadataonly no ocurre, lo que confirma que
    es un problema interno de pyreadstat y no del archivo .sav.
    """
    if not isinstance(texto, str):
        return texto
    try:
        return texto.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return texto


def cargar_spss(ruta=RUTA_SAV):
    # apply_value_formats reemplaza los codigos numericos por su etiqueta de valor (ej. 1 -> "Si")
    # encoding="latin1": el archivo declara UTF-8 pero las etiquetas de valor
    # (ej. "años") estan realmente en Latin-1; sin esto se corrompen los acentos.
    df, meta = pyreadstat.read_sav(ruta, apply_value_formats=True, encoding="latin1")

    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(_des_mojibake)

    meta.column_names_to_labels = {
        col: _des_mojibake(label) for col, label in meta.column_names_to_labels.items()
    }
    for columna, etiquetas in meta.variable_value_labels.items():
        meta.variable_value_labels[columna] = {
            valor: _des_mojibake(texto) for valor, texto in etiquetas.items()
        }

    # Diccionario columna -> etiqueta de variable (nombre descriptivo original)
    etiquetas_variable = meta.column_names_to_labels

    return df, meta, etiquetas_variable


if __name__ == "__main__":
    df, meta, etiquetas_variable = cargar_spss()

    print(f"Filas: {df.shape[0]:,} | Columnas: {df.shape[1]:,}")
    print("\nEjemplo de etiquetas de variable:")
    for col, label in list(etiquetas_variable.items())[:10]:
        print(f"  {col}: {label}")

    print("\nPrimeras filas:")
    print(df.head())
