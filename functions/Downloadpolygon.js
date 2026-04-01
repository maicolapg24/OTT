define([
    "esri/TimeExtent",
    "../utils/miscellaneous.js",
    "./utils/evalScripts_download.js",

  
  ], function (TimeExtent, miscellaneous, evalScripts_download) {

    function DownloadPolygon(view, aoiGeometry) {
        const dialog = document.getElementById("DownloadDialog");
        const dialogHeader = document.getElementById("DownloadDialogHeader");

        dialog.style.display = "block";
        miscellaneous.makeDialogDraggable(dialog, dialogHeader);

        const spectralIndicesTab = document.getElementById("spectralIndicesTabDW");

        spectralIndicesTab.addEventListener("click", function () {
            miscellaneous.switchTab("espectrales", "bandas", this);
          });

        document
        .getElementById("downloadButtonDw")
        .addEventListener("click", async () => {

            // show the loader and Inactivate the download button
            downloadButtonDw.disabled = true;
            const loader = document.getElementById("chartLoaderDw");
            loader.hidden = false;

            // define interest parameters
            const startDate = document.getElementById("startDateDw").value;
            const endDate = document.getElementById("endDateDw").value;
            const indexSelect = document.getElementById('indexSelectDw').value;
            const evalScript = evalScripts_download[indexSelect];

             
            // validate date range
            const isDateRangeValid = miscellaneous.validateDateRange(
                startDate,
                endDate
              );
              if (!isDateRangeValid) {
                return;
              }  

            console.log(aoiGeometry);
            
            // define the body request 
            const body = JSON.stringify({
            input: {
                bounds: {
                geometry: {
                    type: "MultiPolygon",
                    coordinates: [aoiGeometry],},
                properties: {
                    crs: "http://www.opengis.net/def/crs/EPSG/0/3857",
                },
                },
                data: [
                {
                    dataFilter: {
                    timeRange: {
                        from: `${startDate}T00:00:00Z`,
                        to: `${endDate}T00:00:00Z`,
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
                    identifier: "default",
                    format: {
                    type: "image/tiff",
                    },
                },
                ],
            },
            evalscript: evalScript,
            });

            //create request to obtain the index image
            
            fetch("http://localhost:3000/get-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: body,
            })
            .then(async (response) => {
                if (!response.ok) {
                throw new Error(`Error fetching image: ${response.status}`);
                }

                //reclassify image response using index define by user
                var reclasss = await miscellaneous.clasifyIndex(response,indexSelect)
                
                if(reclasss.features.length===0){
                    alert("No hay imagenes disponibles para las fechas seleccionadas");
                    loader.hidden = true;
                    downloadButtonDw.disabled = false;
                    return
                };
                
            
                // create blob file from the geojson
                const blob = new Blob([JSON.stringify(reclasss)], { type: "application/json" });
            
                // create a URL to blob file
                const url = URL.createObjectURL(blob);
            
                // create a link to download the file
                const a = document.createElement("a");
                a.href = url;
                a.download = indexSelect+"_reclasificado.geojson"; //file download name
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            
                // release the blob file url
                URL.revokeObjectURL(url);

                // hide the loader and activate the download button
                loader.hidden = true;
                downloadButtonDw.disabled = false;
            })
            .catch((error) => {
                console.error("Error al procesar la imagen:", error);
            });

        });
        
}

    let dialog = document.getElementById("DownloadDialog");
    let element = document.getElementById("closeDialogButtonDw")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });

    return { DownloadPolygon };
  });