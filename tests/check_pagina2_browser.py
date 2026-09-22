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
      const inputs = [...document.querySelectorAll('#departments-options input')];
      inputs.forEach(input => {
        input.checked = departments.includes(Number(input.value));
      });
      const target = inputs.find(input => input.checked);
      if (target) target.dispatchEvent(new Event('change', {bubbles: true}));
    }""", departments)


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
        trend_option = page.evaluate("echarts.getInstanceByDom(document.getElementById('trend-chart')).getOption()")
        assert len(trend_option["xAxis"][0]["data"]) == 8
        assert len(trend_option["series"][0]["data"]) == 8
        assert trend_option["series"][0]["data"][7]["symbolSize"] == 11
        applied_filters = page.locator("#active-filters").inner_text()
        assert "filtros aplicados:" in applied_filters.lower()
        assert "Población:" in applied_filters and "Mes:" in applied_filters and "Departamento de atención:" in applied_filters
        assert page.locator(".age-sex-silhouette svg").count() == 6
        assert page.locator(".age-sex-person").count() == 6
        assert page.locator(".age-sex-progress").count() == 6
        assert page.locator(".age-sex-progress > span").first.evaluate("el => getComputedStyle(el).animationName") == "age-sex-load"
        assert page.locator(".age-sex-progress > span").nth(0).evaluate("el => getComputedStyle(el).backgroundColor") != page.locator(".age-sex-progress > span").nth(1).evaluate("el => getComputedStyle(el).backgroundColor")
        assert page.locator(".age-band").count() == 3
        assert page.locator(".age-group-total").count() == 3
        page.locator("[data-age-sex-detail]").click()
        assert page.locator("#detail-dialog tbody tr").count() == 6
        assert page.locator("#detail-dialog th[data-sort-table]").count() == 5
        page.keyboard.press("Escape")
        page.locator("#population-buttons").evaluate("el => { el.scrollLeft = 0; el.scrollBy({left:180, behavior:'instant'}); }")
        page.wait_for_timeout(600)
        assert page.locator("#population-buttons").evaluate("el => el.scrollWidth <= el.clientWidth || el.scrollLeft > 0")
        base_theme = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()")
        assert base_theme == "#147d77"
        page.select_option("#theme-mode", "dark")
        assert page.evaluate("document.documentElement.dataset.mode") == "dark"
        page.click("#palette-button")
        assert page.locator("#palette-grid .palette-option").count() == 8
        page.click('[data-palette="oceanico"]')
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()") == "#147d77"
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--chart-color-1').trim()") == "#2774cf"
        assert page.locator(".panel").first.evaluate("el => getComputedStyle(el).borderTopColor") != "rgb(225, 233, 233)"
        ocean_total = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()")
        page.click('[data-population="mujeres"]')
        ocean_women = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()")
        assert ocean_women != ocean_total
        assert ocean_women == "#a13f6b"
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--chart-color-1').trim()") == "#2774cf"
        page.click('[data-population="total"]')
        page.click("#palette-button")
        page.click('[data-palette="coral"]')
        page.click('[data-population="mujeres"]')
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()") == "#a13f6b"
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--chart-color-1').trim()") == "#f54262"
        assert page.locator('[data-population="mujeres"]').evaluate("el => getComputedStyle(el).getPropertyValue('--population-color').trim()") == "#a13f6b"
        page.click('[data-population="hombres"]')
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()") == "#286da8"
        assert page.locator('[data-population="hombres"]').evaluate("el => getComputedStyle(el).getPropertyValue('--population-color').trim()") == "#286da8"
        page.click('[data-population="total"]')
        page.select_option("#theme-mode", "light")
        page.click("#palette-button")
        page.click('[data-palette="default"]')
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.filter(x=>x.value>0).length") == 25
        assert page.locator(".risk-vertical .vertical-bar-item").count() == 3
        assert page.locator(".kpi-value[data-count]").count() == 4
        assert page.locator(".kpi.kpi-gradient").count() == 4
        kpi_gradients = page.locator(".kpi.kpi-gradient").evaluate_all("els => els.map(el => getComputedStyle(el).backgroundImage)")
        assert all("linear-gradient" in gradient and "50%" in gradient for gradient in kpi_gradients)
        assert len(set(kpi_gradients)) == 4
        assert page.locator(".kpi.kpi-gradient .kpi-value").evaluate_all("els => els.every(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)')")
        assert page.locator("#dashboard [data-stat-tooltip]").count() >= 10
        page.locator(".risk-vertical .vertical-bar-item").first.hover()
        assert page.locator("#stat-tooltip").is_visible()
        stat_text = page.locator("#stat-tooltip").inner_text()
        assert "Casos" in stat_text and "Porcentaje" in stat_text and "Base:" in stat_text
        assert page.locator("#stat-tooltip .related-mini").count() == 1
        assert page.locator("#stat-tooltip .related-mini > span").count() >= 2
        violence_tooltip = page.evaluate("""() => { const chart = echarts.getInstanceByDom(document.getElementById('violence-chart')); const option = chart.getOption(); const item = option.series[0].data[0]; return option.tooltip[0].formatter({name:item.name,value:item.value,color:option.color[0]}); }""")
        assert "related-mini" in violence_tooltip and "Niveles de riesgo" in violence_tooltip and "Base:" in violence_tooltip
        trend_tooltip = page.evaluate("""() => { const chart = echarts.getInstanceByDom(document.getElementById('trend-chart')); const option = chart.getOption(); return option.tooltip[0].formatter([{dataIndex:0,value:option.series[0].data[0].value}]); }""")
        assert "related-mini" in trend_tooltip and "Tipos de violencia durante el mes" in trend_tooltip
        page.mouse.move(1, 1)
        assert page.locator(".panorama-extra-grid .panorama-extra").count() == 3
        assert page.locator("#dashboard .panel-expand").count() >= 7
        map_width = page.locator(".map-panel").evaluate("el => el.getBoundingClientRect().width")
        page.locator(".map-panel .panel-expand").click()
        assert page.locator(".map-panel.fullscreen-panel").count() == 1
        assert page.locator(".map-panel").evaluate("el => el.getBoundingClientRect().width") > map_width
        page.wait_for_timeout(250)
        assert page.locator("main").evaluate("el => getComputedStyle(el).marginLeft") == "0px"
        assert page.locator(".sidebar").evaluate("el => getComputedStyle(el).transform") != "none"
        assert page.locator(".topbar").evaluate("el => getComputedStyle(el).display") == "none"
        assert page.locator(".population-bar").evaluate("el => getComputedStyle(el).position") == "fixed"
        assert page.locator("#active-filters").evaluate("el => getComputedStyle(el).position") == "fixed"
        assert abs(page.locator(".population-bar").evaluate("el => el.getBoundingClientRect().top")) < 1
        assert abs(page.locator("#active-filters").evaluate("el => el.getBoundingClientRect().top") - 55) < 1
        assert page.locator(".population-bar").is_visible()
        assert page.locator("#active-filters").is_visible()
        assert page.evaluate("document.elementFromPoint(innerWidth / 2, 25).closest('.population-bar') !== null")
        page.click('[data-population="mujeres"]')
        assert page.locator(".map-panel.fullscreen-panel").count() == 1
        assert page.evaluate("Dashboard.getState().filters.population") == "mujeres"
        page.click('[data-population="total"]')
        assert page.locator(".map-panel.fullscreen-panel").count() == 1
        page.keyboard.press("Escape")
        assert page.locator(".fullscreen-panel").count() == 0
        assert page.locator(".panorama-extra-grid .vertical-bars").count() == 1
        assert page.locator(".panorama-extra-grid > .panorama-extra:first-child .vertical-label").evaluate_all("els => els.every(el => getComputedStyle(el).whiteSpace === 'nowrap')")
        assert page.locator(".panorama-extra-grid > .panorama-extra:first-child .vertical-label").evaluate_all("els => els.every(el => el.getClientRects().length === 1)")
        assert page.locator(".relationship-panel .relationship-group").count() == 3
        assert page.locator(".relationship-panel").evaluate("el => el.getBoundingClientRect().width") > page.locator(".panorama-extra").first.evaluate("el => el.getBoundingClientRect().width") * 1.7
        assert page.locator(".relationship-panel .relationship-detail span").count() > 20
        assert page.locator(".relationship-panel .relationship-groups").evaluate("el => getComputedStyle(el).overflowY") == "visible"
        assert page.locator(".relationship-panel .relationship-groups").evaluate("el => el.scrollHeight <= el.clientHeight + 1")
        assert page.locator(".relationship-toggle").inner_text() == "Desagrupar"
        page.locator(".relationship-toggle").click()
        assert page.locator(".relationship-panel .relational-list .bar-row").count() > 20
        assert page.locator(".relationship-toggle").inner_text() == "Agrupar"
        page.locator(".relationship-toggle").click()
        assert page.locator(".relationship-panel .relationship-group").count() == 3
        page.locator(".relationship-panel .panel-expand").click()
        assert page.locator(".relationship-panel.fullscreen-panel").count() == 1
        assert page.locator(".relationship-panel .relationship-groups").evaluate("el => el.getBoundingClientRect().width") > 1100
        assert page.locator(".relationship-panel .relationship-groups").evaluate("el => el.getBoundingClientRect().height") >= 620
        assert page.locator(".relationship-panel .relationship-detail").first.evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 4
        page.keyboard.press("Escape")
        assert page.locator(".modalities-panel .bar-row").count() == 4
        modality_percentages = page.locator(".modalities-panel .bar-label em").all_inner_texts()
        assert abs(sum(float(value.replace("%", "").replace(",", ".")) for value in modality_percentages) - 100) < 0.01
        assert page.locator(".modalities-panel [data-modalities-detail]").count() == 1
        page.locator(".modalities-panel [data-modalities-detail]").click()
        assert page.locator("#detail-dialog table tbody tr").count() == 5
        assert "100,0%" in page.locator("#detail-dialog table tbody tr").last.inner_text()
        assert "% de casos" in page.locator("#detail-dialog table thead").inner_text()
        page.locator("#detail-dialog th[data-sort-table='integer']").click()
        sorted_counts = [int(value.replace(".", "").replace(",", "")) for value in page.locator("#detail-dialog tbody tr:not([data-summary]) td:nth-child(2)").all_inner_texts()]
        assert sorted_counts == sorted(sorted_counts)
        assert page.locator("#detail-dialog th[data-sort-table='integer']").get_attribute("aria-sort") == "ascending"
        page.locator("#detail-dialog th[data-sort-table='integer']").click()
        descending_counts = [int(value.replace(".", "").replace(",", "")) for value in page.locator("#detail-dialog tbody tr:not([data-summary]) td:nth-child(2)").all_inner_texts()]
        assert descending_counts == sorted(descending_counts, reverse=True)
        assert "Total" in page.locator("#detail-dialog table tbody tr").last.inner_text()
        page.keyboard.press("Escape")
        assert page.locator(".kpi.featured .kpi-value").evaluate("el => getComputedStyle(el).animationName") == "kpi-heartbeat"
        assert page.locator(".kpi.featured").evaluate("el => getComputedStyle(el).textAlign") == "center"
        initial_ranges = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().visualMap[0].pieces.map(x => [x.min, x.max])")
        initial_map_colors = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().visualMap[0].pieces.map(x => x.color)")
        assert len(initial_ranges) == 5
        assert initial_map_colors == ["#5f9f78cc", "#a8c69acc", "#e2d59acc", "#d9a17fcc", "#c87470cc"]
        assert page.locator(".map-panel").evaluate("el => el.getBoundingClientRect().width") < page.locator(".age-panel").evaluate("el => el.getBoundingClientRect().width")
        map_to_right_ratio = page.locator(".map-panel").evaluate("el => el.getBoundingClientRect().width") / page.locator(".age-panel").evaluate("el => el.getBoundingClientRect().width")
        assert 0.65 < map_to_right_ratio < 0.8
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).__pulseRegions.length") == 3
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].itemStyle.borderWidth") == 1.8
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].layoutSize") == "101%"
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series.length") == 1
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).__topIntenseColors.length") == 3
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).__topIntenseColors.every(color => ['#3f9f68','#82c36d','#e8cd48','#e6864f','#d94f4b'].includes(color))")
        assert page.evaluate("['#c87470cc','#d94f4b'].includes([...echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data].sort((a,b)=>b.value-a.value)[0].itemStyle.areaColor)")
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().visualMap[0].seriesIndex.length") == 0
        assert page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.filter(x => x.value > 0).every(x => ['#218c50','#69b84e','#ddb916','#d96a2f','#c72f32'].includes(x.emphasis.itemStyle.areaColor))")
        map_tooltip = page.evaluate("""() => { const chart = echarts.getInstanceByDom(document.getElementById('map-chart')); const option = chart.getOption(); const item = option.series[0].data.filter(x => x.value > 0)[0]; return option.tooltip[0].formatter({name:item.name,value:item.value,data:item}); }""")
        assert "Casos atendidos" in map_tooltip and "Posici" in map_tooltip and "territorial" in map_tooltip and "Intervalo" in map_tooltip and "Promedio" in map_tooltip
        assert "map-tooltip-mini" in map_tooltip and "Comparaci" in map_tooltip and "Promedio territorial" in map_tooltip
        assert ">Depto.<" not in map_tooltip and "Nivel " not in map_tooltip
        assert "font-size:7px" not in map_tooltip and "font-size:8px" not in map_tooltip and "font-size:11px" not in map_tooltip
        assert page.locator("#map-legend span").count() == 5
        assert "casos" in page.locator("#map-legend span").first.inner_text().lower()
        assert page.locator("#map-top").count() == 0
        map_department = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data[0].name")
        map_department_color = page.evaluate("name => echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.find(item => item.name === name).itemStyle.areaColor", map_department)
        page.evaluate("name => echarts.getInstanceByDom(document.getElementById('map-chart')).trigger('click', {name})", map_department)
        assert len(page.evaluate("Dashboard.getState().filters.departments")) == 1
        selected_map = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption()")
        assert len([item for item in selected_map["series"][0]["data"] if item.get("value", 0) > 0]) == 1
        assert [piece["color"] for piece in selected_map["visualMap"][0]["pieces"]] == initial_map_colors
        selected_item = next(item for item in selected_map["series"][0]["data"] if item.get("value", 0) > 0)
        assert selected_item["itemStyle"]["areaColor"] == map_department_color
        assert page.locator("#map-reset").is_visible()
        page.click("#map-reset")
        assert len(page.evaluate("Dashboard.getState().filters.departments")) == 25
        assert page.locator("#map-reset").is_hidden()
        assert "restablecido" in page.locator("#filter-hint").inner_text().lower()
        apply(page, "total", [7], list(range(25)))
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
        assert page.evaluate("document.documentElement.dataset.theme") == "lgtbi"
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--viz-primary').trim()") == "#7551a6"
        filtered_ranges = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().visualMap[0].pieces.map(x => [x.min, x.max])")
        filtered_colors = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().visualMap[0].pieces.map(x => x.color)")
        assert filtered_ranges != initial_ranges
        assert filtered_colors[0] == "#5f9f78cc" and filtered_colors[-1] == "#c87470cc"
        assert set(filtered_colors).issubset({"#5f9f78cc", "#a8c69acc", "#e2d59acc", "#d9a17fcc", "#c87470cc"})
        map_values = page.evaluate("echarts.getInstanceByDom(document.getElementById('map-chart')).getOption().series[0].data.map(x=>x.value)")
        positive_values = [value for value in map_values if value is not None]
        assert 0 < len(positive_values) < 25
        assert all(value > 0 for value in positive_values)
        assert page.locator("#rank-list .bar-row").count() == len(positive_values)
        page.click('[data-population="total"]')
        page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
        assert page.locator('[data-section="historico"]').count() == 0
        assert page.locator('[data-section="catalogo"]').count() == 0
        for id in ["ingreso", "perfil", "territorio", "poblaciones", "violencia", "agresor", "riesgo", "atencion", "justicia"]:
            page.click(f'[data-section="{id}"]')
            assert not page.locator("#error").is_visible()
            assert len(page.locator("#dashboard").inner_text()) > 100
        page.click('[data-section="justicia"]')
        assert page.locator(".binary-donut").count() >= 9
        assert "Sí" in page.locator(".binary-legend").first.inner_text()
        assert "No" in page.locator(".binary-legend").first.inner_text()
        assert page.locator(".binary-donut").first.evaluate("el => getComputedStyle(el).animationName") == "draw-donut"
        assert page.locator(".indicator-card h3").first.evaluate("el => getComputedStyle(el).fontSize") == "12px"
        assert page.locator(".binary-legend span").first.evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 11
        assert page.locator(".indicator-card h3").first.evaluate("el => getComputedStyle(el).fontSize") == "12px"
        assert page.locator(".binary-legend span").first.evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 11
        assert page.locator(".vertical-bars").count() >= 1
        assert page.locator(".vertical-bar-item").count() >= 3
        assert page.locator(".vertical-track span").first.evaluate("el => getComputedStyle(el).animationName") == "grow-vertical"
        assert page.locator(".vertical-track").first.evaluate("el => el.getBoundingClientRect().height") >= 130
        assert page.locator(".vertical-track").first.evaluate("el => el.getBoundingClientRect().width") >= 42
        page.screenshot(path=str(OUT / "section.png"), full_page=True)
        page.fill("#indicator-search", "frecuencia")
        page.wait_for_timeout(250)
        assert page.locator(".indicator-card").count() >= 1
        page.click('[data-detail="FRECUENCIA_AGREDE"]')
        assert "11,418" in page.locator("#detail-content").inner_text()
        assert page.locator("#detail-dialog table tbody tr").count() >= 5
        assert page.locator("#detail-dialog th[data-sort-table]").count() == 4
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
        if not page.locator("#reset").is_visible():
            page.click("#departments-picker summary")
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
                assert page.locator(".age-sex-silhouette svg").count() == 6
                assert page.locator(".age-sex-person.is-zero").count() == 4
                page.evaluate("scrollTo(0, 700)")
                page.wait_for_timeout(100)
                assert abs(page.locator(".topbar").evaluate("el => el.getBoundingClientRect().top")) < 1
                assert abs(page.locator(".population-bar").evaluate("el => el.getBoundingClientRect().top") - 76) < 1
                assert abs(page.locator("#active-filters").evaluate("el => el.getBoundingClientRect().top") - 172) < 1
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
