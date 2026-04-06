define([
  "esri/layers/WMTSLayer",
  "../PL_API_KEY.js",
  "../utils/miscellaneous.js",
  "../utils/evalScript_deforestation.js",
], function (WMTSLayer, PlanetAPIKey, miscellaneous, evalScript_deforestation
) {
  function buildPlanetMosaicId(dateString, monthOffset = 0) {
    const baseDate = new Date(`${dateString}T00:00:00Z`);

    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    baseDate.setUTCDate(1);
    baseDate.setUTCMonth(baseDate.getUTCMonth() + monthOffset);

    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, "0");

    return `global_monthly_${year}_${month}_mosaic`;
  }

  function addPlanetMosaicLayer(map, mosaicId, title) {
    const planetApiKey = PlanetAPIKey.myExtraSecretAPIKey;
    const customParameters = {
      api_key: planetApiKey,
    };

    const wmtsLayer = new WMTSLayer({
      url: "https://api.planet.com/basemaps/v1/mosaics/wmts?",
      activeLayer: {
        id: mosaicId,
      },
      customParameters: customParameters,
      title: title,
      visible: true,
      opacity: 0.9,
    });

    map.add(wmtsLayer, 0);
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

      // Display Planet monthly mosaics: selected final month and one month before
      const finalMonthMosaic = buildPlanetMosaicId(endDate, 0);
      const previousMonthMosaic = buildPlanetMosaicId(endDate, -1);

      if (previousMonthMosaic) {
        addPlanetMosaicLayer(
          view.map,
          previousMonthMosaic,
          "Planet mosaico (mes anterior)"
        );
      }

      if (finalMonthMosaic) {
        addPlanetMosaicLayer(
          view.map,
          finalMonthMosaic,
          "Planet mosaico (mes final)"
        );
      }

      await miscellaneous.addGeojsonLayer(view, classimage);

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
  
  return { processImage };
});
