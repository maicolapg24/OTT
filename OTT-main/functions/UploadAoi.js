define([
  "esri/geometry/Polygon",
  "esri/geometry/support/webMercatorUtils",
  "esri/Graphic",
  "../utils/miscellaneous.js",
], function (Polygon, webMercatorUtils, Graphic, miscellaneous) {
  browseGeoJson = (event, graphicsLayer, timeSeriesButton, onAoiChanged) => {
    return new Promise((resolve) => {
      var file = event.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var geojson = JSON.parse(e.target.result);
          geojson.features.forEach(function (feature) {
            var featureGeometry = new Polygon({
              //rings: feature.featureGeometry.coordinates,
              rings: feature.geometry.coordinates[0],
            });

            // Convert from 4326 to 3857
            var mapGeometry =
              webMercatorUtils.geographicToWebMercator(featureGeometry);

            var graphic = new Graphic({
              geometry: mapGeometry,
              symbol: miscellaneous.graphicsSymbol,
            });

            graphicsLayer.add(graphic);
            const geometry = mapGeometry.rings;
            aioIsValid = miscellaneous.validateAOI(mapGeometry);
            timeSeriesButton.disabled = false;
            if (!aioIsValid) {
              geometry = null;
              graphicsLayer.removeAll();
              timeSeriesButton.disabled = true;
            } else {
              if (onAoiChanged) {
                onAoiChanged(mapGeometry);
              }
              resolve(geometry)
            }
          });
        };
        reader.readAsText(file);
      }
    });
  };
  return { browseGeoJson };
});
