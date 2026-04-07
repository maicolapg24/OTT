require([
  "esri/layers/GraphicsLayer",
  "esri/widgets/Sketch/SketchViewModel",
  "utils/miscellaneous.js",
  "functions/CreateMap.js",
  "functions/DrawAoi.js",
  "functions/UploadAoi.js",
  "functions/MapDeforestation.js",
  "functions/TimeSeries.js",
  "functions/ChangeDetection.js",
  "functions/Downloadpolygon.js",
  "functions/DownloadBurnsZones.js",
  "functions/FloodMonitor.js",
  "functions/Catalog.js"
], function (
  GraphicsLayer,
  SketchViewModel,
  miscellaneous,
  CreateMap,
  DrawAoi,
  UploadAoi,
  MapDeforestation,
  TimeSeries,
  ChageDetection,
  DownloadPolygon,
  DownloadBurnsZones,
  FloodMonitor,
  SearchCatalog
) {
  const [map, view] = CreateMap.createMap();
  let aoiGeometry;
  const graphicsLayer = new GraphicsLayer({ listMode: "hide" });
  map.add(graphicsLayer);

  const sketchViewModel = new SketchViewModel({
    view: view,
    layer: graphicsLayer,
    polygonSymbol: miscellaneous.graphicsSymbol,
  });

  const drawAoiButton = document.getElementById("drawButton");
  const timeSeriesButton = document.getElementById("timeSeriesButton");
  const subsButton = document.getElementById("planetSubsButton");
  const uploadGeoJsonButton = document.getElementById("uploadGeoJsonButton");
  const mapDeforestationButton = document.getElementById("deforestationButton");
  const DownloadPolygonButton = document.getElementById("downloadpolButton");
  const mapBurnsButton = document.getElementById("downloadpolBurnsButton");
  const SearchCatalogButton = document.getElementById("CatalogButton");
  const floodMonitorButton = document.getElementById("floodMonitorButton");
  const aoiAreaInfo = document.getElementById("aoiAreaInfo");

  function updateAoiArea(geometry) {
    if (!aoiAreaInfo) {
      return;
    }

    const areaLabel = miscellaneous.formatAOIArea(geometry);
    aoiAreaInfo.textContent = `Tamaño AOI: ${areaLabel}`;
    aoiAreaInfo.hidden = false;
  }

view.ui.add(
  [
    drawAoiButton,
    uploadGeoJsonButton,
    timeSeriesButton,
    mapDeforestationButton,
    subsButton,
    DownloadPolygonButton,
    mapBurnsButton,
    SearchCatalogButton,
    floodMonitorButton
  ],
  "top-right"
);

  drawAoiButton.addEventListener("click", () => {
    DrawAoi.startDrawing({
      sketchViewModel: sketchViewModel,
      graphicsLayer: graphicsLayer,
      view: view,
      timeSeriesButton: timeSeriesButton,
      mapDeforestationButton: mapDeforestationButton,
      DownloadPolygonButton: DownloadPolygonButton,
      mapBurnsButton: mapBurnsButton,
      floodMonitorButton: floodMonitorButton,
      SearchCatalogButton: SearchCatalogButton,
      onAoiChanged: updateAoiArea
    })
      .then((geometry) => {
        aoiGeometry = geometry;
      })
      .catch((error) => {
        console.error("Error drawing AOI:", error);
      });
  });

  uploadGeoJsonButton.addEventListener("click", () => {
    document.getElementById("browseGeoJson").click();
  });

  document.getElementById("browseGeoJson").addEventListener("change", (event) =>
    UploadAoi.browseGeoJson(event, graphicsLayer, timeSeriesButton, updateAoiArea)
      .then((geometry) => {
        aoiGeometry = geometry;
        timeSeriesButton.disabled = false;
        DownloadPolygonButton.disabled = false;
        DownloadBurnsZones.disabled = false;
        mapBurnsButton.disabled = false;
        floodMonitorButton.disabled = false;
        mapDeforestationButton.disabled = false;
      })
      .catch((error) => {
        console.error("Error uploading AOI:", error);
      })
  );

  mapDeforestationButton.addEventListener("click", async () =>
    MapDeforestation.processImage(view, aoiGeometry)
  );

  timeSeriesButton.addEventListener("click", () =>
    TimeSeries.createTimeSeries(view, aoiGeometry)
  );

  subsButton.addEventListener("click", async () =>
    ChageDetection.getSubscriptionsData(map, view)
  );

  DownloadPolygonButton.addEventListener("click", async () =>{
    DownloadPolygon.DownloadPolygon(view, aoiGeometry)
  });

  mapBurnsButton.addEventListener("click", async () =>{
    DownloadBurnsZones.processImage(view, aoiGeometry)
  });

  SearchCatalogButton.addEventListener("click", async () =>{
    SearchCatalog.SearchCatalog(view, aoiGeometry)
  });

  floodMonitorButton.addEventListener("click", () =>
    FloodMonitor.openFloodDialog(view, aoiGeometry)
  );
});
