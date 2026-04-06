define([
  "esri/geometry/Extent",
  "esri/layers/support/ImageElement",
  "esri/layers/support/ExtentAndRotationGeoreference",
  "esri/layers/MediaLayer",
  "../utils/miscellaneous.js",
  "../utils/evalScript_deforestation.js",
], function ( Extent, ImageElement, ExtentAndRotationGeoreference, MediaLayer, miscellaneous, evalScript_deforestation
) {
  function processImage(map, aoiGeometry) {

    // show the loader and Inactivate the download button
    const dialog = document.getElementById("DeforestationDialog");
    const dialogHeader = document.getElementById("DeforestationDialogHeader");

    dialog.style.display = "block";
    miscellaneous.makeDialogDraggable(dialog, dialogHeader);

    document.getElementById("downloadButtonDf")
    .addEventListener("click", async ()=> {

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

    });
    
  }

  let dialog = document.getElementById("DeforestationDialog");
  let element = document.getElementById("closeDialogButtonDf")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });
  
  return { processImage };
});
