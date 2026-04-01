define([
  "../utils/miscellaneous.js",
  "../utils/evalscript_Burns.js",
], function ( miscellaneous, evalscript_Burns
) {
  function processImage(view, aoiGeometry) {

    // show the loader and Inactivate the download button
    const dialog = document.getElementById("BurnsDialog");
    const dialogHeader = document.getElementById("BurnsDialogHeader");

    dialog.style.display = "block";
    miscellaneous.makeDialogDraggable(dialog, dialogHeader);

    const slider = document.getElementById("burnsThreshold");
    const valueLabel = document.getElementById("burnsThresholdValue");

    if (slider && valueLabel) {
      valueLabel.textContent = slider.value; // inicializar con valor por defecto
      slider.addEventListener("input", function () {
        valueLabel.textContent = slider.value;
      });
    }

    const indexInput = document.getElementById("burnsThresholdInput"); 
    if (indexInput) { 
      indexInput.addEventListener("input", function () { 
        let v = parseFloat(indexInput.value); 
        if (isNaN(v)) return; 
        if (v < 0.1) v = 0.1; 
        if (v > 0.22) v = 0.22; 
        indexInput.value = v.toFixed(2); 
      }); 
    }

    document.getElementById("downloadButtonBs")
    .addEventListener("click", async ()=> {

      downloadButtonBs.disabled = true;
      const loader = document.getElementById("chartLoaderBs");
      loader.hidden = false;

      const startDate = document.getElementById("startDateBs").value;
      const endDate = document.getElementById("endDateBs").value;
      const indiceValue = parseFloat(indexInput.value);

      const evalScriptBurn = evalscript_Burns["NBR"].replace(/{{THRESHOLD}}/g, indiceValue.toFixed(2));
      const evalScriptImage = evalscript_Burns["NBR2"].replace(/{{THRESHOLD}}/g, indiceValue.toFixed(2));
      const threshold = parseFloat(slider.value);
      
      const isDateRangeValid = miscellaneous.validateDateRange(
        startDate,
        endDate
      );
      if (!isDateRangeValid) {
        return;
      }

      const bodyburn = JSON.stringify({
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
                "maxCloudCoverage": threshold,
                "mosaickingOrder": "leastCC"
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
              identifier: "default",
              format: {
                type: "image/tiff",
              },
            }
          ],

        },
        evalscript: evalScriptBurn,
      });

      const bodyImage = JSON.stringify({
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
                "maxCloudCoverage": threshold,
                "mosaickingOrder": "leastCC"
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
              identifier: "default",
              format: {
                type: "image/png",
              },
            }
          ],

        },
        evalscript: evalScriptImage,
      });

      fetch("http://localhost:3000/get-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: bodyburn,
      })
        .then(async (response) => {
  
          if (!response.ok)
            throw new Error(`Error fetching image: ${response.status}`);

          var classimage = await miscellaneous.DownloadBurns(response)

          await miscellaneous.addGeojsonLayer(view,classimage);
  
          // create blob file from the geojson
          const blob = new Blob([JSON.stringify(classimage)], { type: "application/json" });
          const url = URL.createObjectURL(blob);

          // create a link to download the file
          const a = document.createElement("a");
          a.href = url;
          a.download = "VectoresQuema.geojson"; //file download name
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      
          // release the blob file url
          URL.revokeObjectURL(url);
  
          // hide the loader and activate the download button
          loader.hidden = true;
          downloadButtonBs.disabled = false;
        })
        .catch((error) => {
          console.error("Error al procesar la imagen:", error);
      });


      fetch("http://localhost:3000/get-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: bodyImage,
      })
        .then(async (response) => {
  
          if (!response.ok)
            throw new Error(`Error fetching image: ${response.status}`);

          await miscellaneous.addMediaLayer(view,response, aoiGeometry)
  
          // hide the loader and activate the download button
          loader.hidden = true;
          downloadButtonBs.disabled = false;
        })
        .catch((error) => {
          console.error("Error al procesar la imagen:", error);
      });

    });
    
  }

  let dialog = document.getElementById("BurnsDialog");
  let element = document.getElementById("closeDialogButtonBs")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });
  
  return { processImage };
});


