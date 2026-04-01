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
        const subscription_id = selectElement.value;
        const subscription_name =
          selectElement.options[selectElement.selectedIndex].text;

        try {
          const response = await fetch(
            `http://localhost:3000/get-analytics-results?subscription_id=${subscription_id}`
          );
          const geojson = await response.json();
          // create a new blob from geojson featurecollection
          const blob = new Blob([JSON.stringify(geojson)], {
            type: "application/json",
          });

          // URL reference to the blob
          const url = URL.createObjectURL(blob);
          // create new geojson layer using the blob url and popup template

          function addDetectionBasemap() {
            const observed_date = new Date(
              view.popup.selectedFeature.attributes.observed
            );
            const year = observed_date.getFullYear();
            const month = String(observed_date.getMonth() + 1).padStart(2, "0"); // two digits month
            const detectionBasemapId = `global_monthly_${year}_${month}_mosaic`;

            // Calculate past date (6 months prior)
            const pastDate = new Date(observed_date);
            pastDate.setMonth(pastDate.getMonth() - 6);

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
          const featureCount = geojson.features.length;
          resultsMessage.textContent = `${featureCount} detecciones fueron añadidas al mapa`;
          // Show the ZoomTo button
          zoomToButton.style.display = "inline-block";

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
          console.error("Error fetching collections:", error);
        }
      });
  }
  return { getSubscriptionsData };
});
