
import json
import re
import sys
from pathlib import Path

import vtracer
from PIL import Image

RAW_DIR = Path("pagina/assets/icons/raw")
OUT_DIR = Path("pagina/assets/icons")
BUNDLE_JS = OUT_DIR / "icons.js"
EXTENSIONES = {".png", ".jpg", ".jpeg", ".bmp"}

VTRACER_OPCIONES = dict(
    colormode="binary",  # una sola forma vs. fondo -> ideal para siluetas
    mode="spline",  # curvas suaves (mejor para formas organicas/personas)
    filter_speckle=4,  # limpia ruido/motas pequenas del trazado
    corner_threshold=60,
    length_threshold=4.0,
    splice_threshold=45,
    path_precision=3,
)


def aplanar_a_blanco(ruta_entrada, ruta_temporal):
    """
    vtracer no interpreta bien la transparencia (la lee como un lienzo
    negro completo). Se aplana la imagen sobre fondo blanco antes de
    vectorizar, sea o no que tenga canal alfa.
    """
    img = Image.open(ruta_entrada).convert("RGBA")
    fondo = Image.new("RGB", img.size, (255, 255, 255))
    fondo.paste(img, mask=img.split()[3])
    fondo.save(ruta_temporal)


def limpiar_svg(svg_texto):
    # Un solo color de relleno -> currentColor, para poder pintarlo por CSS.
    svg_texto = re.sub(r'fill="#[0-9a-fA-F]{3,8}"', 'fill="currentColor"', svg_texto)

    # Quita el comentario del generador (cosmetico).
    svg_texto = re.sub(r"<!--.*?-->\n?", "", svg_texto, flags=re.DOTALL)

    # Convierte width/height fijos en viewBox, para que escale por CSS.
    m = re.search(r'<svg([^>]*)\swidth="(\d+)"\s+height="(\d+)"', svg_texto)
    if m:
        atributos_previos, ancho, alto = m.group(1), m.group(2), m.group(3)
        nueva_cabecera = (
            f'<svg{atributos_previos} viewBox="0 0 {ancho} {alto}" '
            f'preserveAspectRatio="xMidYMid meet"'
        )
        svg_texto = svg_texto[: m.start()] + nueva_cabecera + svg_texto[m.end() :]

    return svg_texto.strip() + "\n"


def vectorizar_uno(ruta_entrada, ruta_salida):
    temporal = ruta_salida.with_suffix(".tmp.png")
    aplanar_a_blanco(ruta_entrada, temporal)
    try:
        vtracer.convert_image_to_svg_py(str(temporal), str(ruta_salida), **VTRACER_OPCIONES)
    finally:
        temporal.unlink(missing_ok=True)

    svg_texto = ruta_salida.read_text(encoding="utf-8")
    svg_texto = limpiar_svg(svg_texto)
    ruta_salida.write_text(svg_texto, encoding="utf-8")

    n_paths = svg_texto.count("<path")
    return n_paths


def main():
    if not RAW_DIR.exists():
        print(f"No existe {RAW_DIR}. Crea la carpeta y coloca ahi las imagenes de origen.")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    entradas = sorted(p for p in RAW_DIR.iterdir() if p.suffix.lower() in EXTENSIONES)
    if not entradas:
        print(f"No hay imagenes en {RAW_DIR} (extensiones esperadas: {sorted(EXTENSIONES)}).")
        return

    bundle = {}
    for ruta_entrada in entradas:
        nombre = ruta_entrada.stem
        ruta_salida = OUT_DIR / (nombre + ".svg")
        n_paths = vectorizar_uno(ruta_entrada, ruta_salida)
        aviso = "" if n_paths >= 1 else "  <- revisar, no genero ningun path"
        print(f"OK  {ruta_entrada.name:30s} -> {ruta_salida}  ({n_paths} path{'s' if n_paths != 1 else ''}){aviso}")
        bundle[nombre] = ruta_salida.read_text(encoding="utf-8")

    # Ademas de los .svg sueltos, se empaqueta todo en un .js (window.ICONS_SVG)
    # que se carga con <script src>, igual que geodata.js/casos_data.js.
    # fetch() de un .svg individual falla bajo file:// (y en algunos
    # visores/preview embebidos); <script src> no tiene ese problema.
    with open(BUNDLE_JS, "w", encoding="ascii") as f:
        f.write("window.ICONS_SVG = ")
        json.dump(bundle, f, ensure_ascii=True, indent=2)
        f.write(";\n")
    print(f"OK  {BUNDLE_JS} generado con {len(bundle)} icono(s).")

    print(f"\nListo. Revisa visualmente los .svg en {OUT_DIR} antes de usarlos en la pagina.")


if __name__ == "__main__":
    main()
