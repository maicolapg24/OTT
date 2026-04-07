define(["../utils/miscellaneous.js"], function (miscellaneous) {

  function startDrawing(params) {
    const { sketchViewModel, graphicsLayer, view, timeSeriesButton, mapDeforestationButton, DownloadPolygonButton, mapBurnsButton, SearchCatalogButton, onAoiChanged } = params;

    return new Promise((resolve, reject) => {

      const dialog = document.getElementById("drawDialog");
      const closeBtn = document.getElementById("closeDialogAOI");
      const btnAOIGeneral = document.getElementById("btnAOIGeneral");
      const btnAOIPlanet = document.getElementById("btnAOIPlanet");

      if (!dialog || !btnAOIGeneral || !btnAOIPlanet) {
        console.error("⚠️ drawDialog o botones no existen en el DOM.");
        reject("Dialog not found");
        return;
      }

      dialog.style.display = "block";

      closeBtn.addEventListener("click", () => dialog.style.display = "none");

      let currentMode = null;

      function startSketch() {
        dialog.style.display = "none";
        graphicsLayer.removeAll();

        sketchViewModel.create("polygon");

        sketchViewModel.on("create", async (event) => {
          if (event.state === "complete") {
            const geometry = event.graphic.geometry;
            let validationValue = currentMode === "general" ? 900 : 9;
            const isValid = miscellaneous.validateAOI(geometry, validationValue);

            if (!isValid) {
              graphicsLayer.removeAll();
              timeSeriesButton.disabled = true;
              mapDeforestationButton.disabled = true;
              DownloadPolygonButton.disabled = true;
              mapBurnsButton.disabled = true;
              SearchCatalogButton.disabled = true;
            } else {
              if (onAoiChanged) {
                onAoiChanged(geometry);
              }

              if (currentMode === "general") {
                timeSeriesButton.disabled = false;
                mapDeforestationButton.disabled = false;
                DownloadPolygonButton.disabled = false;
                mapBurnsButton.disabled = false;
                SearchCatalogButton.disabled = true;
              } else if (currentMode === "planet") {
                timeSeriesButton.disabled = true;
                mapDeforestationButton.disabled = true;
                DownloadPolygonButton.disabled = true;
                mapBurnsButton.disabled = true;
                SearchCatalogButton.disabled = false;
              }
              resolve(geometry.rings);
            }
          }
        });
      }

      btnAOIGeneral.addEventListener("click", () => {
        currentMode = "general";
        startSketch();
      });

      btnAOIPlanet.addEventListener("click", () => {
        currentMode = "planet";
        startSketch();
      });

    });
  }

  return { startDrawing };
});
