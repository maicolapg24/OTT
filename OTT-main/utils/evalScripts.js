define(function () {
  return {
    NDVI: `//VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const NIR = sample.B08;
      const RED = sample.B04;

      let NDVI = index(NIR, RED)
      var validNDVIMask = 1;

      if (NIR + RED == 0) {
        validNDVIMask = 0;
      }

      var noWaterMask = 1;
      if (sample.SCL == 6) {
        noWaterMask = 0;
      }
      return {
        data: [NDVI],
        // Exclude nodata pixels, pixels where ndvi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validNDVIMask * noWaterMask],
      };
    }`,
    GNDVI: `//VERSION=3
    function setup() {
      return {
        input: ["B03", "B08", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const NIR = sample.B08;
      const GREEN = sample.B03;

      let GNDVI = index(NIR, GREEN)
      var validGNDVIMask = 1;

      if (NIR + GREEN == 0) {
        validGNDVIMask = 0;
      }

      var noWaterMask = 1;
      if (sample.SCL == 6) {
        noWaterMask = 0;
      }
      return {
        data: [GNDVI],
        // Exclude nodata pixels, pixels where ndvi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validGNDVIMask * noWaterMask],
      };
    }`,
    EVI: `//VERSION=3
    function setup() {
      return {
        input: ["B02", "B04", "B08", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 } ],
      };
    };

    function evaluatePixel(sample) {
      const NIR = sample.B08;
      const RED = sample.B04;
      const BLUE = sample.B02;
      
      let EVI = 2.5 * ((NIR - RED) / (NIR + (6 * RED) - (7.5 * BLUE) + 1));
      var validEVIMask = 1;

      if (NIR + 6 * RED - 7.5 * BLUE + 1 == 0) {
        validEVIMask = 0;
      }

      var noWaterMask = 1;
      if (sample.SCL == 6) {
        noWaterMask = 0;
      }

      return {
        data: [EVI],
        // Exclude nodata pixels, pixels where evi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validEVIMask * noWaterMask],
      }
    }`,
    NDMI: `//VERSION=3
  function setup() {
      return {
          input: ["B8A", "B11", "SCL", "dataMask"],
          output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
  }

  function evaluatePixel(sample) {
    const NIR = sample.B8A;
    const SWIR =  sample.B11;

    let NDMI = index(NIR, SWIR)
    var validNDMIMask = 1;

    if (NIR + SWIR == 0) {
      validNDMIMask = 0;
    }


    return {
      data: [NDMI],
      // Exclude nodata pixels, pixels where ndmi is not defined
      dataMask: [sample.dataMask * validNDMIMask],
    };
  }`,
    SAVI: `//VERSION=3
  function setup() {
      return {
          input: ["B08", "B04", "SCL", "dataMask"],
          output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
  }

  function evaluatePixel(sample) {
    const NIR = sample.B08;
    const RED =  sample.B04;
    let L = 0.428; // L = soil brightness correction factor could range from (0 -1)



    let SAVI = (NIR - RED) / (NIR + RED + L) * (1.0 + L);
    var validSAVIMask = 1;

    if (NIR + RED + L == 0) {
      validSAVIMask = 0;
    }

    var noWaterMask = 1;
    if (sample.SCL == 6) {
      noWaterMask = 0;
    }

    return {
      data: [SAVI],
      // Exclude nodata pixels, pixels where ndmi is not defined and water pixels from statistics:
      dataMask: [sample.dataMask * validSAVIMask * noWaterMask],
    };
  }`,
    NDSI: `//VERSION=3
    function setup() {
      return {
        input: ["B03", "B11", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const GREEN = sample.B03;
      const SWIR = sample.B11;

      let NDSI = index(GREEN, SWIR)
      var validNDSIMask = 1;

      if (GREEN + SWIR == 0) {
        validNDSIMask = 0;
      }

      var noWaterMask = 1;
      if (sample.SCL == 6) {
        noWaterMask = 0;
      }
      return {
        data: [NDSI],
        // Exclude nodata pixels, pixels where ndsi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validNDSIMask * noWaterMask],
      };
    }`,
    NDWI: `//VERSION=3
    function setup() {
      return {
        input: ["B03", "B08", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const GREEN = sample.B03;
      const NIR = sample.B08;

      let NDWI = index(GREEN, NIR)
      var validNDWIMask = 1;

      if (GREEN + NIR == 0) {
        validNDWIMask = 0;
      }

      return {
        data: [NDWI],
        // Exclude nodata pixels, pixels where ndsi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validNDWIMask],
      };
    }`,
    NDBI: `//VERSION=3
    function setup() {
      return {
        input: ["B11", "B08", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const SWIR = sample.B11;
      const NIR = sample.B08;

      let NDBI = index(SWIR, NIR)
      var validNDBIMask = 1;

      if (SWIR + NIR == 0) {
        validNDBIMask = 0;
      }
      
      var noWaterMask = 1;
      if (sample.SCL == 6) {
        noWaterMask = 0;
      }

      return {
        data: [NDBI],
        // Exclude nodata pixels, pixels where ndsi is not defined and water pixels from statistics:
        dataMask: [sample.dataMask * validNDBIMask * noWaterMask],
      };
    }`,
    NDCI: `//VERSION=3
    function setup() {
      return {
        input: ["B05", "B04", "SCL", "dataMask"],
        output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
      };
    }

    function evaluatePixel(sample) {
      const RED_EDGE = sample.B05;
      const RED = sample.B04;

      let NDCI = index(RED_EDGE, RED)
      var validNDCIMask = 1;

      if (RED_EDGE + RED == 0) {
        validNDCIMask = 0;
      }

      return {
        data: [NDCI],
        // Exclude nodata pixels, pixels where ndci is not defined from statistics:
        dataMask: [sample.dataMask * validNDCIMask],
      };
    }`,
  };
});
