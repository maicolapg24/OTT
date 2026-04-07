define([
  "../utils/miscellaneous.js",
  "../utils/evalscript_flood.js",
  "https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js"
], function (miscellaneous, evalscriptFlood, turf) {
  function openFloodDialog(view, aoiGeometry) {
    const dialog = document.getElementById("FloodDialog");
    const dialogHeader = document.getElementById("FloodDialogHeader");
    dialog.style.display = "block";
    miscellaneous.makeDialogDraggable(dialog, dialogHeader);

    const runButton = document.getElementById("runFloodButton");
    const downloadButton = document.getElementById("downloadFloodGeojsonButton");
    const loader = document.getElementById("chartLoaderFlood");

    let lastGeoJSON = null;

    runButton.onclick = async () => {
      runButton.disabled = true;
      loader.hidden = false;

      try {
        if (!aoiGeometry || !aoiGeometry.length) {
          alert("Debe definir un AOI");
          return;
        }

        const startDate = document.getElementById("startDateFlood").value;
        const endDate = document.getElementById("endDateFlood").value;
        const mode = document.getElementById("floodMode").value; // snapshot|change|timeseries
        const indexName = document.getElementById("waterIndex").value; // MNDWI|NDWI
        const cloudThreshold = Number(document.getElementById("cloudThreshold").value || 30);
        const waterThreshold = Number(document.getElementById("waterThreshold").value || 0.15);

        const okRange = miscellaneous.validateDateRange(startDate, endDate);
        if (!okRange) return;

        if (mode === "snapshot") {
          await runSnapshot({
            view, aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold
          });
          lastGeoJSON = null;
        } else if (mode === "change") {
          lastGeoJSON = await runChange({
            view, aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold
          });
        } else if (mode === "timeseries") {
          await runTimeSeries({
            view, aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold
          });
          lastGeoJSON = null;
        }
      } catch (err) {
        console.error("FloodMonitor error:", err);
        alert("No fue posible ejecutar el monitoreo hídrico.");
      } finally {
        loader.hidden = true;
        runButton.disabled = false;
      }
    };

    downloadButton.onclick = () => {
      if (!lastGeoJSON) {
        alert("Ejecute primero el modo cambio para generar polígonos.");
        return;
      }
      const blob = new Blob([JSON.stringify(lastGeoJSON)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flood_change_${new Date().toISOString().slice(0,10)}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    };

    document.getElementById("closeDialogButtonFlood").onclick = () => {
      dialog.style.display = "none";
    };
  }

  function buildEvalscript(indexName, threshold, forVisualization = false) {
    if (forVisualization) {
      return evalscriptFlood.FLOOD_VIS_RGB(threshold);
    }
    if (indexName === "NDWI") return evalscriptFlood.FLOOD_MASK_NDWI(threshold);
    return evalscriptFlood.FLOOD_MASK_MNDWI(threshold); // default MNDWI
  }

  async function postImageProcess({ aoiGeometry, fromISO, toISO, cloudThreshold, evalscript }) {
    const body = JSON.stringify({
      input: {
        bounds: {
          geometry: {
            type: "MultiPolygon",
            coordinates: [aoiGeometry]
          },
          properties: {
            crs: "http://www.opengis.net/def/crs/EPSG/0/3857"
          }
        },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: { from: fromISO, to: toISO },
            maxCloudCoverage: cloudThreshold,
            mosaickingOrder: "mostRecent"
          }
        }]
      },
      output: {
        width: 1024,
        height: 1024,
        responses: [{ identifier: "default", format: { type: "image/png" } }]
      },
      evalscript
    });

    const response = await fetch("http://localhost:3000/get-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (!response.ok) throw new Error(`get-image failed: ${response.status}`);
    return response;
  }

  async function runSnapshot(params) {
    const { view, aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold } = params;
    const evalscript = buildEvalscript(indexName, waterThreshold, true);

    const response = await postImageProcess({
      aoiGeometry,
      fromISO: `${startDate}T00:00:00Z`,
      toISO: `${endDate}T23:59:59Z`,
      cloudThreshold,
      evalscript
    });

    await miscellaneous.addMediaLayer(
      view,
      response,
      aoiGeometry,
      `Inundación (${indexName}) ${startDate} / ${endDate}`
    );
  }

  async function runChange(params) {
    const { view, aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold } = params;
    const evalMask = buildEvalscript(indexName, waterThreshold, false);

    // 1) before = ventana corta al inicio
    const beforeResp = await postImageProcess({
      aoiGeometry,
      fromISO: `${startDate}T00:00:00Z`,
      toISO: `${startDate}T23:59:59Z`,
      cloudThreshold,
      evalscript: evalMask
    });

    // 2) after = ventana corta al final
    const afterResp = await postImageProcess({
      aoiGeometry,
      fromISO: `${endDate}T00:00:00Z`,
      toISO: `${endDate}T23:59:59Z`,
      cloudThreshold,
      evalscript: evalMask
    });

    // TODO real: convertir máscaras before/after a polígonos y clasificar
    // new_flood, stable_water, receded
    const geojson = {
      type: "FeatureCollection",
      features: []
    };

    // Visual auxiliar (after)
    await miscellaneous.addMediaLayer(
      view,
      afterResp,
      aoiGeometry,
      `Cambio hídrico (${indexName}) AFTER ${endDate}`
    );

    // Capa vector (vacía por ahora, para completar en implementación final)
    await miscellaneous.addGeojsonLayer(view, geojson, "Inundación - Cambio (MVP)");

    return geojson;
  }

  async function runTimeSeries(params) {
    const { aoiGeometry, startDate, endDate, indexName, cloudThreshold, waterThreshold } = params;
    const evalMask = buildEvalscript(indexName, waterThreshold, false);

    const body = JSON.stringify({
      input: {
        bounds: {
          geometry: { type: "Polygon", coordinates: aoiGeometry },
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" }
        },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: cloudThreshold }
        }]
      },
      aggregation: {
        timeRange: {
          from: `${startDate}T00:00:00Z`,
          to: `${endDate}T23:59:59Z`
        },
        aggregationInterval: {
          of: "P7D",
          lastIntervalBehavior: "SHORTEN"
        },
        resx: 30,
        resy: 30,
        evalscript: evalMask
      },
      calculations: {
        default: {
          statistics: {
            default: {
              percentiles: { k: [10, 50, 90], interpolation: "higher" }
            }
          }
        }
      }
    });

    const response = await fetch("http://localhost:3000/get-statistics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (!response.ok) throw new Error(`get-statistics failed: ${response.status}`);
    const stats = await response.json();

    // Reutiliza el pipeline de chart existente
    const [labels, p10, mean, p90] = miscellaneous.proccessStatisticsData(stats);
    miscellaneous.generateChart(labels, mean, p10, p90);
  }

  return { openFloodDialog };
});