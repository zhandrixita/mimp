"""Prueba de integración local. Requiere playwright y Edge instalado.

python tests/check_pagina2_browser.py
Las evidencias quedan en tmp/pagina2 (no se publican).
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp/pagina2"


def apply(page, population, months, departments):
    page.click(f'[data-population="{population}"]')
    assert len(months) == 1
    page.select_option("#header-month", str(months[0]))
    page.evaluate("""departments => {
      document.querySelectorAll('#departments-options input').forEach(input => {
        input.checked = departments.includes(Number(input.value));
      });
    }""", departments)
    page.click("#apply-filters")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    errors, external = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda req: external.append(req.url) if req.url.startswith("http") else None)
        page.goto((ROOT / "pagina2/index.html").as_uri())
        page.wait_for_function("window.Dashboard !== undefined")
        assert page.evaluate("Dashboard.getState().result.total") == 15804
        assert page.locator("#header-month").input_value() == "7"
        assert page.locator("#header-month option:checked").inner_text() == "Agosto 2026"
        applied_filters = page.locator("#active-filters").inner_text()
        assert "filtros aplicados:" in applied_filters.lower()
        assert "Población:" in applied_filters and "Mes:" in applied_filters and "Departamento de atención:" in applied_filters
        assert page.locator(".silhouettes svg").count() == 6
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.filter(x=>x.value>0).length") == 25
        page.click("#departments-picker summary")
        page.fill("#dept-search", "lima")
        lima = page.locator("#departments-options .picker-option:not([hidden]) input")
        assert lima.count() == 1
        selected_department = int(lima.get_attribute("value"))
        page.locator(f'[data-department-only="{selected_department}"]').click()
        assert page.evaluate("Dashboard.getState().filters.departments") == [selected_department]
        assert page.evaluate("Dashboard.getState().result.total") > 0
        assert "Departamento aplicado" in page.locator("#filter-hint").inner_text()
        page.click("[data-select='departments'][data-value='all']")
        page.fill("#dept-search", "")
        page.click("#departments-picker summary")
        assert len(page.evaluate("Dashboard.getState().filters.departments")) == 25
        page.click('[data-population="lgtbi"]')
        map_values = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.map(x=>x.value)")
        positive_values = [value for value in map_values if value is not None]
        assert 0 < len(positive_values) < 25
        assert all(value > 0 for value in positive_values)
        assert page.locator("#rank-list .bar-row").count() == len(positive_values)
        page.click('[data-population="total"]')
        page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
        for id in ["ingreso", "perfil", "territorio", "poblaciones", "violencia", "agresor", "riesgo", "atencion", "justicia", "historico", "catalogo"]:
            page.click(f'[data-section="{id}"]')
            assert not page.locator("#error").is_visible()
            assert len(page.locator("#dashboard").inner_text()) > 100
        page.click('[data-section="justicia"]')
        assert page.locator(".binary-donut").count() >= 9
        assert "Sí" in page.locator(".binary-legend").first.inner_text()
        assert "No" in page.locator(".binary-legend").first.inner_text()
        assert page.locator(".binary-donut").first.evaluate("el => getComputedStyle(el).animationName") == "draw-donut"
        assert page.locator(".vertical-bars").count() >= 1
        assert page.locator(".vertical-bar-item").count() >= 3
        assert page.locator(".vertical-track span").first.evaluate("el => getComputedStyle(el).animationName") == "grow-vertical"
        page.screenshot(path=str(OUT / "section.png"), full_page=True)
        page.fill("#indicator-search", "frecuencia")
        page.wait_for_timeout(250)
        assert page.locator(".indicator-card").count() >= 1
        page.click('[data-detail="FRECUENCIA_AGREDE"]')
        assert "11,418" in page.locator("#detail-content").inner_text()
        assert page.locator("#detail-dialog table tbody tr").count() >= 5
        page.screenshot(path=str(OUT / "detail.png"))
        with page.expect_download() as csv_info:
            page.click("#detail-csv")
        csv_info.value.save_as(str(OUT / "indicator.csv"))
        page.keyboard.press("Escape")
        page.click('[data-section="panorama"]')
        apply(page, "total", [7], [13, 14, 16, 18])
        assert page.evaluate("Dashboard.getState().result.total") == 5070
        page.click("#download-report")
        assert "5,070" in page.locator("#report-filter-summary").inner_text()
        with page.expect_download(timeout=120000) as download:
            page.click("#generate-report")
        download.value.save_as(str(OUT / "reporte_filtrado.pdf"))
        page.keyboard.press("Escape")
        apply(page, "lgtbi", [7], [0, 5, 7, 18])
        assert page.evaluate("Dashboard.getState().result.total") == 0
        assert page.locator(".empty-state").is_visible()
        page.click("#download-report")
        with page.expect_download(timeout=30000) as download:
            page.click("#generate-report")
        download.value.save_as(str(OUT / "reporte_sin_casos.pdf"))
        page.keyboard.press("Escape")
        page.click("#reset")
        page.click("#download-report")
        page.select_option("#report-scope", "all")
        with page.expect_download(timeout=180000) as download:
            page.click("#generate-report")
        download.value.save_as(str(OUT / "reporte_completo.pdf"))
        page.keyboard.press("Escape")
        page.click("#method-button")
        assert "390" in page.locator("#method-content").inner_text()
        page.keyboard.press("Escape")
        for width in [390, 768, 1024, 1920]:
            page.set_viewport_size({"width": width, "height": 900})
            page.wait_for_timeout(150)
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
            if width == 390:
                page.screenshot(path=str(OUT / "mobile.png"), full_page=True)
                page.click("#menu-button")
                assert page.locator("body.menu-open").count() == 1
                page.click("#backdrop")
                page.click('[data-population="gestantes"]')
                assert page.evaluate("Dashboard.getState().result.total") == 381
                assert page.locator(".silhouettes svg").count() == 3
                page.evaluate("scrollTo(0, 700)")
                page.wait_for_timeout(100)
                assert abs(page.locator(".topbar").evaluate("el => el.getBoundingClientRect().top")) < 1
                assert abs(page.locator(".population-bar").evaluate("el => el.getBoundingClientRect().top") - 52) < 1
                assert abs(page.locator("#active-filters").evaluate("el => el.getBoundingClientRect().top") - 104) < 1
                page.click("#download-report")
                assert "381" in page.locator("#report-filter-summary").inner_text()
                page.keyboard.press("Escape")
        assert not errors, errors
        assert not external, external
        browser.close()
    summary = {"status": "passed", "browser_errors": errors, "external_requests": external, "viewports": [390, 768, 1024, 1440, 1920], "filtered_total": 5070, "zero_result_test": True, "downloads": ["PDF filtered", "PDF empty", "PDF all", "CSV"], "sections": 12}
    (OUT / "browser_checks.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
