define([
  "../utils/miscellaneous.js",
  "../utils/evalScript_deforestation.js",
  "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.1/proj4.js",
], function (miscellaneous, evalScript_deforestation, proj4) {
  function buildDateWithOffset(dateString, offsetDays = 0) {
    const baseDate = new Date(`${dateString}T00:00:00Z`);

    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    return baseDate.toISOString().slice(0, 10);
  }

  function buildClosestSceneEvalscript(targetDate) {
    return `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "CLM"] }],
    output: { bands: 3, sampleType: "AUTO" },
    mosaicking: "ORBIT"
  };
}

function evaluatePixel(samples, scenes) {
  if (!samples || samples.length === 0) {
    return [0, 0, 0];
  }

  const targetMs = new Date("${targetDate}T00:00:00Z").getTime();
  let closestIndex = -1;
  let minDiff = Number.POSITIVE_INFINITY;

  for (let i = 0; i < scenes.length; i++) {
    const sample = samples[i];
    const isCloudy = sample.CLM === 1;
    if (isCloudy) {
      continue;
    }

    const diff = Math.abs(scenes[i].date.getTime() - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  // fallback: if all candidates are cloudy, use nearest available scene
  if (closestIndex === -1) {
    closestIndex = 0;
    minDiff = Math.abs(scenes[0].date.getTime() - targetMs);
    for (let i = 1; i < scenes.length; i++) {
      const diff = Math.abs(scenes[i].date.getTime() - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
  }

  const sample = samples[closestIndex];
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`;
  }

  function convertAoiToWgs84(aoiGeometry) {
    return aoiGeometry[0].map((coord) =>
      proj4("EPSG:3857", "EPSG:4326", [coord[0], coord[1]])
    );
  }

  async function getClosestSentinelAcquisitionDate(aoiGeometry, targetDate) {
    const fromDate = buildDateWithOffset(targetDate, -45);
    const toDate = buildDateWithOffset(targetDate, 45);

    if (!fromDate || !toDate) {
      return targetDate;
    }

    const coordinates4326 = convertAoiToWgs84(aoiGeometry);
    const catalogBody = JSON.stringify({
      collections: ["sentinel-2-l2a"],
      limit: 50,
      datetime: `${fromDate}T00:00:00Z/${toDate}T23:59:59Z`,
      intersects: {
        type: "Polygon",
        coordinates: [coordinates4326],
      },
      query: {
        "eo:cloud_cover": {
          lt: 30,
        },
      },
    });

    const catalogResponse = await fetch("http://localhost:3000/get-catalog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: catalogBody,
    });

    if (!catalogResponse.ok) {
      return targetDate;
    }

    const catalogData = await catalogResponse.json();
    const features = catalogData?.features || [];

    if (!features.length) {
      return targetDate;
    }

    const targetMs = new Date(`${targetDate}T00:00:00Z`).getTime();
    let closestDate = targetDate;
    let minDiff = Number.POSITIVE_INFINITY;

    features.forEach((feature) => {
      const sceneDateValue =
        feature?.properties?.datetime ||
        feature?.properties?.["start_datetime"] ||
        feature?.properties?.date;

      if (!sceneDateValue) {
        return;
      }

      const sceneDate = new Date(sceneDateValue);
      if (Number.isNaN(sceneDate.getTime())) {
        return;
      }

      const diff = Math.abs(sceneDate.getTime() - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = sceneDate.toISOString().slice(0, 10);
      }
    });

    return closestDate;
  }

  async function addClosestSentinelImage(view, aoiGeometry, targetDate, labelPrefix) {
    const acquisitionDate = await getClosestSentinelAcquisitionDate(
      aoiGeometry,
      targetDate
    );
    const fromDate = buildDateWithOffset(acquisitionDate, -1);
    const toDate = buildDateWithOffset(acquisitionDate, 1);

    const body = JSON.stringify({
      input: {
        bounds: {
          geometry: {
            type: "MultiPolygon",
            coordinates: [aoiGeometry],
          },
          properties: {
            crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
          },
        },
        data: [
          {
            dataFilter: {
              timeRange: {
                from: `${fromDate}T00:00:00Z`,
                to: `${toDate}T23:59:59Z`,
              },
              maxCloudCoverage: 30,
              mosaickingOrder: "mostRecent",
            },
            type: "sentinel-2-l2a",
          },
        ],
      },
      output: {
        width: 1024,
        height: 1024,
        responses: [
          {
            identifier: "default",
            format: {
              type: "image/png",
            },
          },
        ],
      },
      evalscript: buildClosestSceneEvalscript(acquisitionDate),
    });

    const response = await fetch("http://localhost:3000/get-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`Error fetching sentinel image: ${response.status}`);
    }

    await miscellaneous.addMediaLayer(
      view,
      response,
      aoiGeometry,
      `${labelPrefix}: ${acquisitionDate}`
    );
  }

  function processImage(view, aoiGeometry) {

    // show the loader and Inactivate the download button
    const dialog = document.getElementById("DeforestationDialog");
    const dialogHeader = document.getElementById("DeforestationDialogHeader");

    dialog.style.display = "block";
    miscellaneous.makeDialogDraggable(dialog, dialogHeader);

    const downloadButtonDf = document.getElementById("downloadButtonDf");
    downloadButtonDf.onclick = async () => {

      downloadButtonDf.disabled = true;
      const loader = document.getElementById("chartLoaderDf");
      loader.hidden = false;

      try {
        const startDate = document.getElementById("startDateDf").value;
        const endDate = document.getElementById("endDateDf").value;
        const evalScript = evalScript_deforestation["MAP_DEFORESTATION"];


        const isDateRangeValid = miscellaneous.validateDateRange(
          startDate,
          endDate
        );
        if (!isDateRangeValid) {
          return;
        }

        const body = JSON.stringify({
        input: {
          bounds: {
            geometry: {
              type: "MultiPolygon",
              coordinates: [aoiGeometry],
            },
            properties: {
              crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
            },
          },
          data: [
            {
              dataFilter: {
                timeRange: {
                  from: `${startDate}T00:00:00Z`,
                  to: `${endDate}T23:59:59Z`,
                },
              },
              type: "sentinel-2-l2a",
            },
          ],
        },
        output: {
          resx: 30,
          resy: 30,
          responses: [
            {
              identifier: "data",
              format: {
                type: "image/tiff",
              },
            },
          ],
        },
        evalscript: evalScript,
      });

      const response = await fetch("http://localhost:3000/get-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body,
      });

      if (!response.ok)
        throw new Error(`Error fetching image: ${response.status}`);

      var classimage = await miscellaneous.DownloadDeforestation(response)

      // Display Sentinel images closest to initial and final selected dates
      await addClosestSentinelImage(
        view,
        aoiGeometry,
        startDate,
        "Sentinel (fecha de toma inicial)"
      );
      await addClosestSentinelImage(
        view,
        aoiGeometry,
        endDate,
        "Sentinel (fecha de toma final)"
      );

      await miscellaneous.addGeojsonLayer(
        view,
        classimage,
        "Perdida de cobertura vegetal"
      );

      // create blob file from the geojson
      const blob = new Blob([JSON.stringify(classimage)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
          
      // create a link to download the file
      const a = document.createElement("a");
      a.href = url;
      a.download = "VectoresDeforestacion.geojson"; //file download name
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  
      // release the blob file url
      URL.revokeObjectURL(url);
  
      } catch (error) {
        console.error("Error al procesar la imagen:", error);
      } finally {
        loader.hidden = true;
        downloadButtonDf.disabled = false;
      }

    };
    
  }

  let dialog = document.getElementById("DeforestationDialog");
  let element = document.getElementById("closeDialogButtonDf")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });
  
  return { processImage };
});
