define([
    "esri/TimeExtent",
    "../utils/miscellaneous.js",
    "./utils/EvalscriptCatalogDw.js",
    "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.1/proj4.js"

  
  ], function (TimeExtent, miscellaneous, EvalscriptCatalogDw ,proj4) {

    function SearchCatalog(view, aoiGeometry) {
        const dialog = document.getElementById("CatalogDialog");
        const dialogHeader = document.getElementById("CatalogDialogHeader");

        dialog.style.display = "block";
        miscellaneous.makeDialogDraggable(dialog, dialogHeader);

        document
        .getElementById("downloadButtonCs")
        .addEventListener("click", async () => {

            // show the loader and Inactivate the download button
            downloadButtonCs.disabled = true;
            const loader = document.getElementById("chartLoaderCs");
            loader.hidden = false;

            // define interest parameters
            const startDate = document.getElementById("startDateCs").value;
            const endDate = document.getElementById("endDateCs").value;
            const evalScript = EvalscriptCatalogDw["ECSDW"];
            const evalScript1 = EvalscriptCatalogDw["ECSDW1"];

        
            // validate date range
            const isDateRangeValid = miscellaneous.validateDateRange(
                startDate,
                endDate
              );
              if (!isDateRangeValid) {
                return;
              }
              
            var collection = "byoc-7c1511e7-42fd-41ee-925a-bedb3c24cc44"

            // define the body request 
            const timeRange = {
                from: `${startDate}T00:00:00Z`,
                to: `${endDate}T23:59:59Z`
            };

            const coords4326 = [
                aoiGeometry[0].map((c) => {
                    const [lon, lat] = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
                    return [lon, lat];
                }),
            ];

            const data = {
                collections: [collection],
                datetime: `${timeRange.from}/${timeRange.to}`,
                intersects: {
                    type: "Polygon",
                    coordinates: coords4326
                },
                limit: 50,

            };

            //create request to obtain the index image
            
            fetch("http://localhost:3000/get-catalog", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
            })
            .then(async (response) => {
                if (!response.ok) {
                throw new Error(`Error fetching image: ${response.status}`);
                }

                const result = await response.json();
                //console.log(result.features);

                resultsContainer.innerHTML = "";


                if (result.features && result.features.length > 0) {
                result.features.forEach((feature, index) => {
                const id = feature.id || "Sin ID";
                const date = feature.properties?.datetime || "Sin fecha";
                const collection = feature.collection || "Desconocida";

                const itemDiv = document.createElement("div");
                itemDiv.classList.add("feature-item");
                itemDiv.innerHTML = `
                    <div style="background:#f8f8f8;padding:10px;margin-bottom:8px;border-radius:8px;">
                    <p><strong>${index + 1}. ID:</strong> ${id}</p>
                    <p><strong>Fecha:</strong> ${date}</p>
                    <p><strong>Colección:</strong> ${collection}</p>
                    <button class="downloadFeature" data-id="${id}" data-date="${date}" data-collection="${collection}">Descargar</button>
                    <button class="visualizeFeature" data-id="${id}" data-date="${date}" data-collection="${collection}">Visualizar</button>
                    </div>
                `;
                resultsContainer.appendChild(itemDiv);
                });

                document.querySelectorAll(".visualizeFeature").forEach((btn) =>{
                    btn.addEventListener("click", async (e) =>{
                        const featureId = e.target.getAttribute("data-id");
                        const featureDate = e.target.getAttribute("data-date")
                        console.log(`Visualizando feature: ${featureId}`);
                        
                        const bodyDw1 = JSON.stringify({
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
                                        "dataFilter": {
                                            "timeRange": {
                                                "from": `${featureDate.split("T")[0]}T00:00:00Z`,
                                                "to": `${featureDate.split("T")[0]}T23:59:59Z`
                                            },
                                            "mosaickingOrder": "mostRecent"
                                        },
                                        "type": "byoc-7c1511e7-42fd-41ee-925a-bedb3c24cc44",
                                    },
                                ],
                            },
                            output: {
                                resx: 3,
                                resy: 3,
                                responses: [
                                    {
                                        identifier: "default",
                                        format: {
                                            type: "image/png",
                                        },
                                    },
                                ],
                            },
                            implementation: "US-WEST",
                            evalscript: evalScript1,
                        });

                        fetch("http://localhost:3000/get-image", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: bodyDw1,
                            })
                            .then(async (response) => {
                                if (!response.ok) {
                                throw new Error(`Error fetching image: ${response.status}`);
                                }
                                await miscellaneous.addMediaLayer(view,response, aoiGeometry)
        
                                // hide the loader and activate the download button
                                loader.hidden = true;
                                downloadButtonDw.disabled = false;
                            })
                            .catch((error) => {
                                console.error("Error al procesar la imagen:", error);
                            });
                    })

                });
                
                    // Evento para los botones "Descargar"
                document.querySelectorAll(".downloadFeature").forEach((btn) => {
                btn.addEventListener("click", async (e) => {
                    const featureId = e.target.getAttribute("data-id");
                    const featureDate = e.target.getAttribute("data-date")
                    console.log(`Descargando feature: ${featureId}`);

                    const bodyDw = JSON.stringify({
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
                                "dataFilter": {
                                    "timeRange": {
                                        "from": `${featureDate.split("T")[0]}T00:00:00Z`,
                                        "to": `${featureDate.split("T")[0]}T23:59:59Z`
                                    },
                                    "mosaickingOrder": "mostRecent"
                                    },
                                    "type": "byoc-7c1511e7-42fd-41ee-925a-bedb3c24cc44",                                
                            },
                        ],
                    },
                    output: {
                        resx: 3,
                        resy: 3,
                        responses: [
                        {
                            identifier: "default",
                            format: {
                            type: "image/tiff",
                            },
                        },
                        ],
                    },
                    implementation: "US-WEST",
                    evalscript: evalScript,
                    });

                    fetch("http://localhost:3000/get-image", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: bodyDw,
                    })
                    .then(async (response) => {
                        if (!response.ok) {
                        throw new Error(`Error fetching image: ${response.status}`);
                        }

                        const blob = await response.blob();
                        const link = Object.assign(document.createElement('a'), {
                            href: URL.createObjectURL(blob),
                            download: 'imagen.tif'
                        });
                        link.click();

                        // hide the loader and activate the download button
                        loader.hidden = true;
                        downloadButtonDw.disabled = false;
                    })
                    .catch((error) => {
                        console.error("Error al procesar la imagen:", error);
                    });

                });
                });
            } else {
                resultsContainer.innerHTML = "<p>No se encontraron resultados.</p>";
            }
                
                // hide the loader and activate the download button
                loader.hidden = true;
                downloadButtonCs.disabled = false; 
            })
            .catch((error) => {
                console.error("Error al procesar la imagen:", error);
            });

        });
        
}

    let dialog = document.getElementById("CatalogDialog");
    let element = document.getElementById("closeDialogButtonCs")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });

    return { SearchCatalog };
  });