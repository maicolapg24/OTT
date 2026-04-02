define([
  "esri/layers/GeoJSONLayer",
  "esri/core/reactiveUtils",
  "esri/layers/WMTSLayer",
  "esri/widgets/Swipe",
  "../PL_API_KEY.js", // this file is, of course, ignored by git
  "../utils/miscellaneous.js",
], function (
  GeoJSONLayer,
  reactiveUtils,
  WMTSLayer,
  Swipe,
  PlanetAPIKey,
  miscellaneous
) {
  function normalizeDateValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      // Normalize timestamps in seconds/milliseconds/microseconds/nanoseconds to milliseconds.
      if (value > 1e14) {
        return new Date(Math.floor(value / 1e6));
      }

      if (value > 1e11) {
        return new Date(value);
      }

      if (value > 1e9) {
        return new Date(value * 1000);
      }
    }

    if (typeof value === "string") {
      const yyyyMmDdMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);

      if (yyyyMmDdMatch) {
        return new Date(
          Date.UTC(
            Number(yyyyMmDdMatch[1]),
            Number(yyyyMmDdMatch[2]) - 1,
            Number(yyyyMmDdMatch[3])
          )
        );
      }

      const yyyyMmMatch = value.match(/(\d{4})-(\d{2})/);

      if (yyyyMmMatch) {
        return new Date(
          Date.UTC(Number(yyyyMmMatch[1]), Number(yyyyMmMatch[2]) - 1, 1)
        );
      }

      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return null;
  }

  function getObservedDateFromFeature(feature) {
    const properties = feature?.properties || {};
    const candidateDates = [
      properties.observed,
      properties.date,
      properties.observed_at,
      properties.observation_date,
      properties.published,
    ];

    for (const value of candidateDates) {
      if (!value) {
        continue;
      }

      const parsedDate = normalizeDateValue(value);

      if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    if (typeof properties.source_mosaic_name === "string") {
      const sourceMosaicMatch = properties.source_mosaic_name.match(
        /(\d{4})[_-](\d{2})/
      );

      if (sourceMosaicMatch) {
        const parsedDate = new Date(
          Date.UTC(Number(sourceMosaicMatch[1]), Number(sourceMosaicMatch[2]) - 1, 1)
        );

        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    return null;
  }

  async function getSubscriptionsData(map, view) {
    const dialog = document.getElementById("analyticsDialog");
    const dialogHeader = document.getElementById("analytycsDialogHeader");
    try {
      const planetResponse = await fetch(
        "http://localhost:3000/get-analytics-subscriptions",
        {
          method: "GET",
        }
      );
      const response = await planetResponse.json();
      const data = response.data;

      const selectElement = document.getElementById("subscriptionsSelect");

      // Clear existing options in the select element
      selectElement.innerHTML = "";

      // Populate the select element with options
      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.description;
        selectElement.appendChild(option);
      });

      const periodSelectElement = document.getElementById("observedPeriodSelect");
      periodSelectElement.innerHTML =
        '<option value="all">Todos los períodos</option>';
      const startYear = 2021;
      const startMonth = 1;
      const endYear = 2026;
      const endMonth = 2;
      const monthNames = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      for (let year = endYear; year >= startYear; year--) {
        const maxMonth = year === endYear ? endMonth : 12;
        const minMonth = year === startYear ? startMonth : 1;

        for (let month = maxMonth; month >= minMonth; month--) {
          const periodOption = document.createElement("option");
          const periodValue = `${year}-${String(month).padStart(2, "0")}`;
          periodOption.value = periodValue;
          periodOption.textContent = `${monthNames[month - 1]} ${year}`;
          periodSelectElement.appendChild(periodOption);
        }
      }

      // Display the dialog
      dialog.style.display = "block";
      miscellaneous.makeDialogDraggable(dialog, dialogHeader);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    }
    document
      .getElementById("closeDialogButtonPL")
      .addEventListener("click", () => {
        dialog.style.display = "none";
      });
    // Query Collections button event listener
    document
      .getElementById("queryCollectionsButton")
      .addEventListener("click", async () => {
        const selectElement = document.getElementById("subscriptionsSelect");
        const periodSelectElement = document.getElementById("observedPeriodSelect");
        const queryCollectionsButton = document.getElementById(
          "queryCollectionsButton"
        );
        const subscription_id = selectElement.value;
        const subscription_name =
          selectElement.options[selectElement.selectedIndex].text;
        const selectedPeriod = periodSelectElement.value;
        const requestId = `analytics-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

        const monthNames = {
          1: "enero",
          2: "febrero",
          3: "marzo",
          4: "abril",
          5: "mayo",
          6: "junio",
          7: "julio",
          8: "agosto",
          9: "septiembre",
          10: "octubre",
          11: "noviembre",
          12: "diciembre",
        };
        let progressPoller = null;

        try {
          queryCollectionsButton.disabled = true;
          queryCollectionsButton.textContent = "Consultando resultados...";
          resultsMessage.textContent =
            "Consultando Planet Analytics, este proceso puede tardar unos minutos...";
          zoomToButton.style.display = "none";

          progressPoller = setInterval(async () => {
            try {
              const progressResponse = await fetch(
                `http://localhost:3000/get-analytics-progress?request_id=${requestId}`
              );

              if (!progressResponse.ok) {
                return;
              }

              const progressData = await progressResponse.json();

              if (progressData.status === "running") {
                resultsMessage.textContent = `Procesando páginas: ${progressData.pagesProcessed}. Detecciones acumuladas: ${progressData.featuresProcessed}.`;
              }
            } catch (pollError) {
              console.warn("Unable to poll analytics progress:", pollError);
            }
          }, 2000);

          const requestController = new AbortController();
          const timeoutId = setTimeout(() => {
            requestController.abort();
          }, 600000);

          const response = await fetch(
            `http://localhost:3000/get-analytics-results?subscription_id=${subscription_id}&request_id=${requestId}`,
            { signal: requestController.signal }
          );
          clearTimeout(timeoutId);
          clearInterval(progressPoller);

          if (!response.ok) {
            throw new Error(`Error de consulta: ${response.status}`);
          }

          const geojson = await response.json();

          const filteredFeatures = geojson.features.filter((feature) => {
            const observedDate = getObservedDateFromFeature(feature);

            if (!observedDate) {
              return false;
            }

            if (selectedPeriod === "all") {
              return true;
            }

            const observedPeriod = `${observedDate.getUTCFullYear()}-${String(
              observedDate.getUTCMonth() + 1
            ).padStart(2, "0")}`;

            return observedPeriod === selectedPeriod;
          });

          const filteredGeojson = {
            ...geojson,
            features: filteredFeatures,
          };

          // create a new blob from geojson featurecollection
          const blob = new Blob([JSON.stringify(filteredGeojson)], {
            type: "application/json",
          });

          // URL reference to the blob
          const url = URL.createObjectURL(blob);
          // create new geojson layer using the blob url and popup template

          function addDetectionBasemap() {
            const observed_date = new Date(
              view.popup.selectedFeature.attributes.observed
            );
            const basemapOffsetMonths = Number(
              document.getElementById("basemapOffsetSelect").value
            );
            const year = observed_date.getFullYear();
            const month = String(observed_date.getMonth() + 1).padStart(2, "0"); // two digits month
            const detectionBasemapId = `global_monthly_${year}_${month}_mosaic`;

            // Calculate past date (selected months prior)
            const pastDate = new Date(observed_date);
            pastDate.setMonth(pastDate.getMonth() - basemapOffsetMonths);

            const pastYear = pastDate.getFullYear();
            const pastMonth = String(pastDate.getMonth() + 1).padStart(2, "0"); // two digits month

            const pastBasemapId = `global_monthly_${pastYear}_${pastMonth}_mosaic`;

            // NEVER USE THIS APPROACH without a reverse proxy, the key will be exposed in wmts requests
            const planetApiKey = PlanetAPIKey.myExtraSecretAPIKey;
            const custom_params = {
              api_key: planetApiKey,
            };
            const wmtsLayer = new WMTSLayer({
              url: `https://api.planet.com/basemaps/v1/mosaics/wmts?`, // url to the service
              activeLayer: {
                id: detectionBasemapId,
              },
              customParameters: custom_params,
            });

            const wmtsLayerPast = new WMTSLayer({
              url: `https://api.planet.com/basemaps/v1/mosaics/wmts?`, // url to the service
              activeLayer: {
                id: pastBasemapId,
              },
              customParameters: custom_params,
            });

            // Add the layer to the map at index zero
            map.add(wmtsLayer, 0);
            map.add(wmtsLayerPast, 0);

            let swipe = new Swipe({
              view: view,
              leadingLayers: [wmtsLayer],
              trailingLayers: [wmtsLayerPast],
              direction: "vertical", // swipe widget will move from top to bottom of view
              position: 50, // position set to middle of the view (50%)
            });
            view.ui.add(swipe);
          }

          const addBaseMapAction = {
            title: "Detección a través del tiempo",
            id: "addDetectionBasemap",
            className: "esri-icon-basemap",
          };

          const popupTemplate = {
            title: `${subscription_name}`,
            content: [
              {
                type: "fields",
                fieldInfos: [
                  { fieldName: "change_direction", label: "Dirección" },
                  { fieldName: "date", label: "Fecha" },
                  { fieldName: "class_label", label: "Clase" },
                  { fieldName: "score", label: "Score" },
                  { fieldName: "observed", label: "Fecha Observación" },
                  { fieldName: "source_mosaic_name", label: "Mosaico fuente" },
                ],
              },
            ],
            actions: [addBaseMapAction],
          };

          const geojsonLayer = new GeoJSONLayer({
            url: url,
            title: `Planet analytics results`,
            popupTemplate: popupTemplate,
            renderer: {
              type: "simple",
              symbol: miscellaneous.analyticsSymbol,
            },
          });

          map.add(geojsonLayer);
          view.popup.actionsMenuEnabled = false;

          // Event handler that fires each time an action is clicked.
          reactiveUtils.on(
            () => view.popup,
            "trigger-action",
            (event) => {
              if (event.action.id === "addDetectionBasemap") {
                addDetectionBasemap();
              }
            }
          );

          // Display the number of features in the resultsMessage
          const featureCount = filteredFeatures.length;
          const periodMessage =
            selectedPeriod === "all"
              ? "todos los períodos"
              : `${monthNames[Number(selectedPeriod.split("-")[1])]} de ${selectedPeriod.split("-")[0]}`;

          resultsMessage.textContent = `${featureCount} detecciones fueron añadidas al mapa para ${periodMessage}. Total recibido: ${geojson.features.length}`;

          // Show the ZoomTo button only if features are available
          zoomToButton.style.display = featureCount > 0 ? "inline-block" : "none";

          document
            .getElementById("zoomToButton")
            .addEventListener("click", () => {
              if (geojsonLayer) {
                geojsonLayer.queryExtent().then((response) => {
                  view.goTo(response.extent).catch((error) => {
                    console.error("Error zooming to layer extent:", error);
                  });
                });
              } else {
                console.error("No GeoJSON layer available to zoom to.");
              }
            });
        } catch (error) {
          if (progressPoller) {
            clearInterval(progressPoller);
          }

          if (error.name === "AbortError") {
            resultsMessage.textContent =
              "La consulta tardó demasiado. Intente de nuevo con un filtro de mes/año más específico.";
          } else {
            resultsMessage.textContent =
              "No fue posible obtener resultados de Planet Analytics. Revise el proxy y vuelva a intentar.";
          }
          console.error("Error fetching collections:", error);
        } finally {
          if (progressPoller) {
            clearInterval(progressPoller);
          }

          queryCollectionsButton.disabled = false;
          queryCollectionsButton.textContent = "Obtener resultados";
        }
      });
  }
  return { getSubscriptionsData };
});
