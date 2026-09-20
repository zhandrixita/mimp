"""Verifica y renderiza los PDF descargados por la prueba de navegador.

Requiere PyMuPDF y Pillow. Evidencias locales: tmp/pagina2.
"""
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp/pagina2"


def main():
    data = json.loads((ROOT / "pagina2/data/data.js").read_text().split("=", 1)[1].strip().rstrip(";"))
    report = []
    for name in ["reporte_filtrado", "reporte_sin_casos", "reporte_completo"]:
        doc = fitz.open(OUT / (name + ".pdf"))
        text = "\n".join(page.get_text() for page in doc)
        assert chr(65533) not in text
        assert "No se registran casos" in text if name == "reporte_sin_casos" else "Casos" in text or "casos" in text
        if name == "reporte_filtrado":
            assert "5,070" in text
            assert "Agosto 2026" in text
        if name == "reporte_completo":
            assert all(f["id"] in text for f in data["fields"])
        for i, page in enumerate(doc):
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        x0, y0, x1, y1 = span["bbox"]
                        assert 35 <= x0 < x1 <= page.rect.width-35, (name, i+1, span)
                        assert 12 <= y0 < y1 <= page.rect.height-12, (name, i+1, span)
        for i in sorted({0, min(2, len(doc)-1), len(doc)-1}):
            doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(OUT / f"{name}_{i+1}.png")
        if name == "reporte_completo":
            for start in range(0, len(doc), 60):
                pages = list(range(start, min(start+60, len(doc))))
                sheet = Image.new("RGB", (954, ((len(pages)+5)//6)*236), "#dfe5e3")
                draw = ImageDraw.Draw(sheet)
                for j, i in enumerate(pages):
                    pix = doc[i].get_pixmap(matrix=fitz.Matrix(.25, .25))
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    x, y = j % 6 * 159, j // 6 * 236
                    sheet.paste(img, (x, y)); draw.text((x+5, y+214), str(i+1), fill="black")
                sheet.save(OUT / f"contact_{start//60+1}.png")
        report.append({"file": name, "pages": len(doc), "text_bounds": "passed", "content": "passed"})
    (OUT / "pdf_checks.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
