define([
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js",
  "esri/layers/WMTSLayer",
  "esri/layers/GeoJSONLayer",
  "esri/TimeExtent",
  "esri/widgets/TimeSlider",
  "esri/geometry/geometryEngine",
  "esri/layers/MediaLayer",
  "esri/layers/support/ImageElement",
  "esri/geometry/Extent",
  "esri/geometry/Polygon",
  "esri/layers/support/ExtentAndRotationGeoreference",
  "https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js",
  "https://cdn.jsdelivr.net/npm/geotiff/dist/geotiff.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.1/proj4.js"


], function (Chart, WMTSLayer, GeoJSONLayer, TimeExtent, TimeSlider, geometryEngine,MediaLayer, ImageElement, Extent,Polygon,ExtentAndRotationGeoreference, turf, GeoTIFF, proj4) {
  function generateChart(labels, meanData, p10Data, p90Data) {

    const { fromUrl, fromArrayBuffer, fromBlob } = GeoTIFF;
    
    // Destroy current chart if it exists
    if (window.myChart) {
      window.myChart.destroy();
    }

    // Process labels to remove time and 'Z'
    const processedLabels = labels.map((label) => label.split("T")[0]);

    const ctx = document.getElementById("timeSeriesChart").getContext("2d");
    ctx.hidden = false;
    window.myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: processedLabels,
        datasets: [
          {
            label: "P10",
            data: p10Data,
            borderColor: "rgba(211, 211, 211, 1)",
            borderWidth: 1,
            fill: "+2", // Fill the area to the next dataset (P90)
            pointStyle: false,
          },
          {
            label: "Mean",
            data: meanData,
            borderColor: "rgba(0,121,193,255)",
          },
          {
            label: "P90",
            data: p90Data,
            borderColor: "rgba(211, 211, 211, 1)",
            borderWidth: 1,
            pointStyle: false,
          },
        ],
      },
    });
  }

  function proccessStatisticsData(stats) {
    const labels = [];
    const p10Data = [];
    const meanData = [];
    const p90Data = [];

    stats.data.forEach((interval) => {
      labels.push(interval.interval.from); //
      p10Data.push(interval.outputs.data.bands.B0.stats.percentiles["10.0"]);
      meanData.push(interval.outputs.data.bands.B0.stats.mean); //
      p90Data.push(interval.outputs.data.bands.B0.stats.percentiles["90.0"]);
    });

    return [labels, p10Data, meanData, p90Data];
  }

  function makeDialogDraggable(dialog, dialogHeader) {
    let isDragging = false;
    let offsetX, offsetY;

    dialogHeader.addEventListener("mousedown", (e) => {
      isDragging = true;
      // Calculate the offset from the dialog's top-left corner to the mouse position
      offsetX = e.clientX - dialog.getBoundingClientRect().left;
      offsetY = e.clientY - dialog.getBoundingClientRect().top;
      // Add event listeners for mousemove and mouseup on the document
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
      if (isDragging) {
        // Update the dialog position based on the mouse position minus the offset
        dialog.style.left = `${e.clientX - offsetX}px`;
        dialog.style.top = `${e.clientY - offsetY}px`;
      }
    }

    function onMouseUp() {
      isDragging = false;
      // Remove the event listeners when dragging stops
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  }

  async function addWmtsLayer(view, subLayerName, timeRange, geometry) {                      
    const customParameters = {
      TIME: timeRange,
      FORMAT: "image/png",
      srsName: "EPSG:3857",
    };

    if (geometry && geometry.length > 0) {
      const aoi = arrayToWktPolygon(geometry);
      customParameters["GEOMETRY"] = aoi;
      customParameters["TRANSPARENT"] = true;
    }
    let [startDate, endDate] = timeRange.split("/");
    const timeExtent = new TimeExtent({
      start: new Date(startDate),
      end: new Date(endDate),
    });

    const createAndAddLayer = async (layerId, customParams) => {

      const layer = new WMTSLayer({
        // url to the service
        url: "https://services.sentinel-hub.com/ogc/wmts/51c0dcb6-d62f-415a-ba96-d9f5b321bc2d",
        activeLayer: {
          id: layerId,
        },
        customParameters: customParams,
        visible: true,
        title: `${subLayerName}: ${timeRange}`,
        visibilityTimeExtent: timeExtent,
      });

      await layer.load();
      view.map.add(layer, 0); // add the layer at index 0, i.e., on top of basemap
      layer.id = `${layerId}_${timeRange}`; // Setting a unique id for the layer

      return layer;
    };

    await createAndAddLayer(subLayerName, customParameters);
  }


  async function addMediaLayer(view, response, aoiGeometry, layerTitle = "Imagen PNG") {

    const blob = await response.blob();

    

    // creamos URL temporal
    const url = URL.createObjectURL(blob);

    var coords4326 = aoiGeometry[0].map(function (c) {
    var latLon = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
    return [latLon[0], latLon[1]]; // [lon, lat]
    });

    const polygon = new Polygon({
      rings: [coords4326],   // tu array viene envuelto en otro array
      spatialReference: { wkid: 4326 }
    });

    const imageElement = new ImageElement({
      image: url,
      georeference: new ExtentAndRotationGeoreference({
        extent: new Extent({
          xmin:  polygon.extent.xmin,
          ymin:  polygon.extent.ymin,
          xmax:  polygon.extent.xmax,
          ymax:  polygon.extent.ymax
        })
      })
    })

    const mediaLayer = new MediaLayer({
      source: imageElement,
      opacity:0.9,
      title: layerTitle,
      blendMode:"normal",
    })

    view.map.add(mediaLayer);

    
  }

  async function addGeojsonLayer(view,classimage, layerTitle = "Zonas Quemadas"){

    const blob = new Blob([JSON.stringify(classimage)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const template = {
        title: "Información",
        content: "Tipo de zona: {state} ",
        fieldInfos: [
          {
            fieldName: "state",
            format: {
              dateFormat: "short-date",
            },
          },
        ],
      };
    
    const renderer = {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [255, 0, 0, 0.4], // rojo transparente
        outline: {
          color: [255, 0, 0],
          width: 1
        }
      }
    }
       
    const geojsonLayer = new GeoJSONLayer({
      url: url,
      title: layerTitle,
      popupTemplate: template,
      renderer: renderer
    });

    view.map.add(geojsonLayer); // add the layer at index 0, i.e., on top of basemap
    
  }
  
  function arrayToWktPolygon(coordinates) {
    // Map the array of coordinate pairs to a string with x and y separated by a space
    const formattedCoords = coordinates[0]
      .map((pair) => pair.join(" "))
      .join(", ");
    // Format the string as a WKT polygon
    const wktPolygon = `POLYGON ((${formattedCoords}))`;
    return wktPolygon;
  }

  const analyticsSymbol = {
    type: "simple-fill",
    color: [0, 0, 0, 0], // No fill
    outline: {
      color: [255, 0, 150, 1],
      width: 2,
    },
  };

  const graphicsSymbol = {
    type: "simple-fill",
    color: [0, 0, 0, 0], // No fill
    style: "solid",
    outline: {
      color: "red",
      width: 1,
    },
  };

  function validateAOI(polygon, validationValue) {
    const planarArea = geometryEngine.planarArea(polygon, "square-meters");
    const numberOfPixels = planarArea / validationValue; // 30x30 m square pixels
    const maxPixels = 2400 * 2400; // Maximum number of pixels

    if (numberOfPixels >= maxPixels) {
      alert("Area excede el máximo permitido");
      return false;
    } else {
      return true;
    }
  }

  function generateDateIntervals(startDate, endDate) {
    // Helper function to add a month to a date
    function addMonth(date) {
      const newDate = new Date(date);
      newDate.setMonth(newDate.getMonth() + 1);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    }

    // Helper function to format a date as 'YYYY-MM-DD'
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Convert input dates to Date objects
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1);

    const finalDate = new Date(endDate);

    // Initialize the result array
    const intervals = [];

    // Generate date intervals
    while (currentDate < finalDate) {
      const nextDate = addMonth(currentDate);

      if (nextDate > finalDate) {
        intervals.push(`${formatDate(currentDate)}/${formatDate(finalDate)}`);
      } else {
        intervals.push(`${formatDate(currentDate)}/${formatDate(nextDate)}`);
      }
      currentDate = new Date(nextDate);
      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day to start new interval
    }

    return intervals;
  }

  function addTimeSlider(timeExtent, view) {

    const timeSlider = new TimeSlider({
      container: "timeSliderDiv",
      view: view,
      mode: "time-window",
      fullTimeExtent: timeExtent,
      timeExtent: timeExtent,
      container: "timeExtent-container",
    });
  }

  function switchTab(showTabId, hideTabId, activeButton) {
    document.getElementById(showTabId).style.display = "block";
    document.getElementById(hideTabId).style.display = "none";

    // Remove the active class from all tab buttons
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.remove("active");
    }

    // Add the active class to the clicked button
    activeButton.classList.add("active");
  }

 // ---------------------------------------------------------------------------------------------------------------------

 const combined_state = {
  ndvi: {
    1: ["Ausencia de vegetación o cobertura vegetal muy escasa", "< 0"],
    2: ["Vegetación escasa o estresada",  "0 - 0.2", 0],
    3: ["Vegetación en condiciones moderadas", "0.2 - 0.5"],
    4: ["Vegetación densa y saludable", "0.5 - 0.8"],
    5: ["Vegetación extremadamente densa y saludable", "0.8 - 1"],
  },
  gndvi: {
    1: ["Áreas con baja o nula vegetación, suelos desnudos, agua o superficies construidas", "< 0"],
    2: ["Vegetación en condiciones saludables, pero no particularmente densa", "0 - 0.5"],
    3: ["Vegetación densa y saludable", "0.5 - 0.8"],
    4: ["Vegetación extremadamente densa y saludable", "0.8 - 1"]
  },
  evi: {
    1: ["Zonas con muy poca o ninguna vegetacion", "< 0"],
    2: ["Presencia creciente de vegetacion", "0 - 0.5"],
    3: ["Vegetacion mas densa y saludable que las areas verdes", "0.5 - 0.8"],
    4: ["Vegetacion con la maxima densidad y salud de la vegetación", "0.8 - 1"],
  },
  savi: {
    1: ["Muy baja vegetacion o suelo expuesto", "< 0"], 
    2: ["Vegetación escasa", "0 - 0.5"],
    3: ["Vegetación moderada", "0.5 - 0.8"],
    4: ["Vegetación extremadamente densa", "0.8 - 1"]
  },
  ndci: {
    1: ["Vegetacion con baja concentacion de clorofila", "< 0"], 
    2: ["Vegetación con concentracion de clorofila moderada", "0 - 0.2"],
    3: ["Vegetacion con alta concentacion de clorofila", "0.2 - 1"],
  },
  ndmi: {
    1: ["Baja humedad en la vegetación", "< 0"],
    2: ["Moderada humedad en la vegetacion", "0 - 0.5"],
    3: ["Alta humedad en la vegetación", "0.5 0.8"],
    4: ["Muy alta humedad en la vegetación", "0.8 - 1"],
  },
  ndsi: {
    1: ["Zonas Ausencia de Nieve", "< 0"],      
    2: ["Zonas con poca nieve", "0 - 0.4"],     
    3: ["Zonas con nieve densa", "0.4 - 1"]    
  },
  ndwi: {
    1: ["Zonas sin presencia de agua", "< 0"],   
    2: ["Zonas inundadas", " 0 - 1"],       

  },
  ndbi: {
    1: ["baja presencia de superficies construidas o una alta presencia de vegetación y áreas naturales", "< -0.05"], 
    2: ["Zonas construidas con vegetación", "-0.05 - 0.05"],   
    3: ["Zonas con alta construccion", "0.05 - 1"],     
  },
  nbr: {
    1: ["Zonas no quemadas", "< 0.1"],                   
    2: ["Zonas quemadas con gravedad moderada baja", "0.1 - 0.44"],     
    3: ["Zonas quemadas con gravedad moderada alta", "0.44 - 0.66"],
    4: ["Zonas gravemente quemadas", "0.66 - 1"]             
  }
  };

  function getClassification(index) {
    if (index === "NDVI") {
      return combined_state.ndvi;
    } else if (index === "GNDVI") {
      return combined_state.gndvi;
    } else if (index === "EVI") {
      return combined_state.evi;
    } else if (index === "SAVI") {
      return combined_state.savi;
    } else if (index === "NDCI") {
      return combined_state.ndci;
    } else if (index === "NDMI") {
      return combined_state.ndmi;
    } else if (index === "NDSI") {
      return combined_state.ndsi;
    } else if (index === "NDWI") {
      return combined_state.ndwi;
    } else if (index === "NDBI") {
      return combined_state.ndbi;
    } else {
      return combined_state.nbr;
    }
  }

  //--------------------------------------------------------------------------------------------------------------------
 
  async function clasifyIndex(image, indice) {

    const imageBuffer = await image.arrayBuffer();
    const geotiff = await GeoTIFF.fromArrayBuffer(imageBuffer);
    //get image in geotiff format
    const image1 = await geotiff.getImage();

    // waiting for raster data be resolved
    const rasterData = await image1.readRasters();
    const width = image1.getWidth(); 
    const height = image1.getHeight();
    const bbox = image1.getBoundingBox();
    const reclasificado = new Uint8Array(width * height);


    // define reclasifitacion methods
    const reclasificationMethods = {
      ndvi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.2) ? 2 : (x <= 0.5) ? 3 : (x <= 0.8) ? 4 : 5,
      gndvi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4,
      evi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4,
      savi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4,
      ndci: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.2) ? 2 : 3,
      ndmi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4,
      ndsi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : (x <= 0.45) ? 2 : 3,
      ndwi: (x) => (x == null || Number.isNaN(x)) ? x : (x < 0) ? 1 : 2,
      ndbi: (x) => (x == null || Number.isNaN(x)) ? x : (x <= -0.05) ? 1 : (x <= 0.05) ? 2 : 3,
      nbr: (x) => (x == null || Number.isNaN(x)) ? x : (x <= 0.1) ? 1 : (x <= 0.44) ? 2 : (x <= 0.66) ? 3 : 4
    };
      

    //create objects to save mean data index

    const IndexGroups = {
      ndvi: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      gndvi: { 1: [], 2: [], 3: [], 4: [] },
      evi: { 1: [], 2: [], 3: [], 4: [] },
      savi: { 1: [], 2: [], 3: [], 4: [] },
      ndci: { 1: [], 2: [], 3: [] },
      ndmi: { 1: [], 2: [], 3: [], 4: [] },
      ndsi: { 1: [], 2: [], 3: [] },
      ndwi: { 1: [], 2: [] },
      ndbi: { 1: [], 2: [], 3: [] },
      nbr:  { 1: [], 2: [], 3: [], 4: [] },
    };
    
    const sumMethods = {
      ndvi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.2) ? 2 : (x <= 0.5) ? 3 : (x <= 0.8) ? 4 : 5;
        IndexGroups.ndvi[group].push(x);
      },
      gndvi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4;
        IndexGroups.gndvi[group].push(x);
      },
      evi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4;
        IndexGroups.evi[group].push(x);
      },
      savi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4;
        IndexGroups.savi[group].push(x);
      },
      ndci: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.2) ? 2 : 3;
        IndexGroups.ndci[group].push(x);
      },
      ndmi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.5) ? 2 : (x <= 0.8) ? 3 : 4;
        IndexGroups.ndmi[group].push(x);
      },
      ndsi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : (x <= 0.45) ? 2 : 3;
        IndexGroups.ndsi[group].push(x);
      },
      ndwi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x < 0) ? 1 : 2;
        IndexGroups.ndwi[group].push(x);
      },
      ndbi: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x <= -0.05) ? 1 : (x <= 0.05) ? 2 : 3;
        IndexGroups.ndbi[group].push(x);
      },
      nbr: (x) => {
        if (x == null || Number.isNaN(x)) return;
        const group = (x <= 0.1) ? 1 : (x <= 0.44) ? 2 : (x <= 0.66) ? 3 : 4;
        IndexGroups.nbr[group].push(x);
      }
    };

    const reclasify = reclasificationMethods[indice.toLowerCase()];

    //starting to reclasify raster data
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const index = row * width + col; //calculate lineal postion
            reclasificado[index] = reclasify(rasterData[0][index]);
            sumMethods[indice.toLowerCase()](rasterData[0][index]);  
        }
    }

    const [minX, minY, maxX, maxY] = bbox;
    const resX = (maxX - minX) / width; // Resolución en X
    const resY = (maxY - minY) / height; // Resolución en Y
      
    const pixelPolygons = [];
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const value = reclasificado[row * width + col];
            if (value === null || Number.isNaN(value)) continue; // skip invalid values

            const xMin = Math.trunc(  (minX + col * resX)*1e6)/1e6;
            const yMax = Math.trunc(  (maxY - row * resY)*1e6)/1e6;
            const xMax = Math.trunc(  (xMin + resX)*1e6)/1e6;
            const yMin = Math.trunc(  (yMax - resY)*1e6)/1e6;
      
            //create polygon by each pixel  using turf library
            const coords = [
                [[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]],
            ];
            pixelPolygons.push(
                turf.polygon(coords, { value: value })
            );  
        }
    }

    //define a feature collection polygons
    const geojson = {
      type: 'FeatureCollection',
      features: pixelPolygons,
    }
    //the polygons are filtered to eliminate the no 
    geojson.features = geojson.features.filter(feature => Number(feature.properties.value) !== 0);

    // disolve pixel polygons in each category using value field
    const polygons = turf.dissolve(geojson,{propertyName : "value"})
    const stateClasification = getClassification(indice)

    // for each polygon you define the classification status and convert coordinates to wgs84
    polygons.features.forEach(function(feature){

      val = Number(feature.properties.value)
      feature.properties.IndexState = stateClasification[val][0] || "Sin clasificacion"
      feature.properties.IndexRange = stateClasification[val][1] || "Sin clasificacion"
      feature.properties.IndexRangeMean = +(IndexGroups[indice.toLowerCase()][val].reduce((sum, vals) => sum + vals, 0) / IndexGroups[indice.toLowerCase()][val].length).toFixed(4);
      
      feature.geometry.coordinates = feature.geometry.coordinates.map(
        (coord) => {
          return coord.map(function (c) {
            var latLon = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
            return [latLon[0], latLon[1]];
          });
        }
      );

    });
  
    return polygons; //return the polygons feature collection
}


async function DownloadDeforestation(image) {

  const imageBuffer = await image.arrayBuffer();
  const geotiff = await GeoTIFF.fromArrayBuffer(imageBuffer);
  //get image in geotiff format
  const image1 = await geotiff.getImage();

  // waiting for raster data be resolved
  const rasterData = await image1.readRasters();
  const width = image1.getWidth(); 
  const height = image1.getHeight();
  const bbox = image1.getBoundingBox();
  const reclasificado = new Uint8Array(width * height);

  const reclassify = (x) => 
    (x == null || Number.isNaN(x)) ? x : 
    (x === 0) ? 0 : 1;

  const [minX, minY, maxX, maxY] = bbox;
  const resX = (maxX - minX) / width; // Resolution  X
  const resY = (maxY - minY) / height; // Resolution  Y

    //starting to reclasify raster data
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = row * width + col; //calculate lineal postion
      reclasificado[index] = reclassify(rasterData[0][index]);
      }
  }
    
  const pixelPolygons = [];
  for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
          const value = reclasificado[row * width + col];
          if (value === null || Number.isNaN(value)) continue; // skip invalid values

          const xMin = Math.trunc(  (minX + col * resX)*1e6)/1e6;
          const yMax = Math.trunc(  (maxY - row * resY)*1e6)/1e6;
          const xMax = Math.trunc(  (xMin + resX)*1e6)/1e6;
          const yMin = Math.trunc(  (yMax - resY)*1e6)/1e6;
    
          //create polygon by each pixel  using turf library
          const coords = [
              [[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]],
          ];
          pixelPolygons.push(
              turf.polygon(coords, { value: value })
          );
          
      }
  }
     
  //define a feature collection polygons
  const geojson = {
    type: 'FeatureCollection',
    features: pixelPolygons,
  }
  //the polygons are filtered to eliminate the useles data
  geojson.features = geojson.features.filter(feature => Number(feature.properties.value) !== 0);

  // disolve pixel polygons in each category using value field
  const polygons = turf.dissolve(geojson,{propertyName : "value"})

  // for each polygon you define the classification status and convert coordinates to wgs84
  polygons.features.forEach(function(feature){

    var state ={1: "deforestado"}

    val = Number(feature.properties.value)
    feature.properties.state = state[val] || "Sin clasificacion"

    feature.geometry.coordinates = feature.geometry.coordinates.map(
      (coord) => {
        return coord.map(function (c) {
          var latLon = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
          return [latLon[0], latLon[1]];
        });
      }
    );
  });
  
  return polygons; //return the polygons feature collection
}

//----------------------------------------------------------------------------------------------------

async function DownloadBurns(image) {

  const imageBuffer = await image.arrayBuffer();
  const geotiff = await GeoTIFF.fromArrayBuffer(imageBuffer);
  //get image in geotiff format
  const image1 = await geotiff.getImage();

  // waiting for raster data be resolved
  const rasterData = await image1.readRasters();
  const width = image1.getWidth(); 
  const height = image1.getHeight();
  const bbox = image1.getBoundingBox();
  const reclasificado = new Uint8Array(width * height);

  const reclassify = (x) => 
    (x == null || Number.isNaN(x)) ? x : 
    (x === 0) ? 0 : 1;

  const [minX, minY, maxX, maxY] = bbox;
  const resX = (maxX - minX) / width; // Resolution  X
  const resY = (maxY - minY) / height; // Resolution  Y

    //starting to reclasify raster data
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = row * width + col; //calculate lineal postion
      reclasificado[index] = reclassify(rasterData[0][index]);
      }
  }
    
  const pixelPolygons = [];
  for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
          const value = reclasificado[row * width + col];
          if (value === null || Number.isNaN(value)) continue; // skip invalid values

          const xMin = Math.trunc(  (minX + col * resX)*1e6)/1e6;
          const yMax = Math.trunc(  (maxY - row * resY)*1e6)/1e6;
          const xMax = Math.trunc(  (xMin + resX)*1e6)/1e6;
          const yMin = Math.trunc(  (yMax - resY)*1e6)/1e6;
    
          //create polygon by each pixel  using turf library
          const coords = [
              [[xMin, yMin], [xMin, yMax], [xMax, yMax], [xMax, yMin], [xMin, yMin]],
          ];
          pixelPolygons.push(
              turf.polygon(coords, { value: value })
          );
          
      }
  }
     
  //define a feature collection polygons
  const geojson = {
    type: 'FeatureCollection',
    features: pixelPolygons,
  }
  //the polygons are filtered to eliminate the useles data
  geojson.features = geojson.features.filter(feature => Number(feature.properties.value) !== 0);

  // disolve pixel polygons in each category using value field
  const polygons = turf.dissolve(geojson,{propertyName : "value"})

  // for each polygon you define the classification status and convert coordinates to wgs84
  polygons.features.forEach(function(feature){

    var state ={1: "zona quemada"}

    val = Number(feature.properties.value)
    feature.properties.state = state[val] || "Sin clasificacion"

    feature.geometry.coordinates = feature.geometry.coordinates.map(
      (coord) => {
        return coord.map(function (c) {
          var latLon = proj4("EPSG:3857", "EPSG:4326", [c[0], c[1]]);
          return [latLon[0], latLon[1]];
        });
      }
    );
  });

  
  return polygons; //return the polygons feature collection

  
}


//----------------------------------------------------------------------------------------------------





  function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      alert("Please select a valid date range.");
      return false;
    } else {
      return true;
    }
  }
  return {
    generateChart,
    proccessStatisticsData,
    makeDialogDraggable,
    addWmtsLayer,
    addMediaLayer,
    addGeojsonLayer,
    analyticsSymbol: analyticsSymbol,
    graphicsSymbol: graphicsSymbol,
    generateDateIntervals,
    addTimeSlider,
    validateAOI,
    switchTab,
    validateDateRange,
    clasifyIndex,
    getClassification,
    DownloadDeforestation,
    DownloadBurns
  };
});
