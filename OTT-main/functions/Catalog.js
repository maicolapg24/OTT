define([
    "esri/TimeExtent",
    "../utils/miscellaneous.js",
    "../utils/EvalscriptCatalogDw.js",
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
            const resultsContainer = document.getElementById("resultsContainer")

            try {
                // define interest parameters
                const selectedYears = Array.from(
                    document.querySelectorAll('input[name="catalogYear"]:checked')
                ).map((checkbox) => checkbox.value);
                const evalScript = EvalscriptCatalogDw["ECSDW"];
                const evalScript1 = EvalscriptCatalogDw["ECSDW1"];

        
            if (selectedYears.length === 0) {
                    resultsContainer.innerHTML =
                        "<p>Seleccione al menos un año (2023, 2024 o 2025).</p>";
                    return;
                }
              
            var collection = "byoc-7c1511e7-42fd-41ee-925a-bedb3c24cc44"

            const coords4326 = [
                aoiGeometry[0].map((c) => {
                    const [lon, lat] = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
                    return [lon, lat];
                }),
            ];

            const catalogResponses = await Promise.all(
                selectedYears.map(async (year) => {
                    const data = {
                        collections: [collection],
                        datetime: `${year}-01-01T00:00:00Z/${year}-12-31T23:59:59Z`,
                        intersects: {
                            type: "Polygon",
                            coordinates: coords4326
                        },
                        limit: 50,
                    };

                    const response = await fetch("http://localhost:3000/get-catalog", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(data),
                    });

                    if (!response.ok) {
                        throw new Error(`Error fetching image: ${response.status}`);
                    }

                    return response.json();
                })
            );

                const allFeatures = catalogResponses.flatMap((catalogResult) => catalogResult.features || []);
                const uniqueFeatures = Array.from(
                    new Map(
                        allFeatures.map((feature) => [
                            `${feature.id || ""}_${feature.properties?.datetime || ""}`,
                            feature
                        ])
                    ).values()
                );

                resultsContainer.innerHTML = "";


                if (uniqueFeatures.length > 0) {
                uniqueFeatures.forEach((feature, index) => {
                const id = feature.id || "Sin ID";
                const date = feature.properties?.datetime || "Sin fecha";
                const dateOnly = date !== "Sin fecha" ? date.split("T")[0] : date;

                const itemDiv = document.createElement("div");
                itemDiv.classList.add("feature-item");
                itemDiv.innerHTML = `
                    <div style="background:#f8f8f8;padding:10px;margin-bottom:8px;border-radius:8px;">
                    <p><strong>${index + 1}. Fecha:</strong> ${dateOnly}</p>
                    <button class="downloadFeature" data-id="${id}" data-date="${date}">Descargar</button>
                    <button class="visualizeFeature" data-id="${id}" data-date="${date}">Visualizar</button>
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
                                await miscellaneous.addMediaLayer(view, response, aoiGeometry, `Imagen ${featureDate.split("T")[0]}`)
        
                                // hide the loader and activate the download button
                                loader.hidden = true;
                                downloadButtonCs.disabled = false;
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
                        downloadButtonCs.disabled = false;
                    })
                    .catch((error) => {
                        console.error("Error al procesar la imagen:", error);
                    });

                });
                });
            } else {
                resultsContainer.innerHTML = "<p>No se encontraron resultados.</p>";
            }
            
            } catch (error) {
                console.error("Error al procesar la imagen:", error);
            } finally {
                
                // hide the loader and activate the download button
                loader.hidden = true;
                    downloadButtonCs.disabled = false;
            }

        });
        
}

    let dialog = document.getElementById("CatalogDialog");
    let element = document.getElementById("closeDialogButtonCs")

    element.addEventListener("click", function() {
        dialog.style.display = "none"
  });

    return { SearchCatalog };
  });
