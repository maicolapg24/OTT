define(function () {
  return {
    NDVI: `//VERSION=3
    function setup() {
      return {
        input: [{
          bands: ["B04", "B08"],
          units: "REFLECTANCE"
        }],
        output: {
          id: "default",
          bands: 1,
          sampleType: SampleType.FLOAT32
        }
      };
    }

    function evaluatePixel(sample) {
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      return [ndvi];
    }`,
    GNDVI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B03", "B08"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let gndvi = (sample.B08 - sample.B03) / (sample.B08 + sample.B03)
      return [ gndvi ]
    }`,
    EVI: 
    `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B02", "B04", "B08",  "dataMask" ],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32
        }
      }
    }

    function evaluatePixel(sample) {
      
      if (sample.dataMask === 0) {
      return [NaN];
      }
  
      let evi = 2.5 * ((sample.B08 - sample.B04) / (sample.B08 + 6 * sample.B04 - 7.5 * sample.B02 + 1));
      return [evi];
}`,
    NDMI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B08", "B11"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11)
      return [ ndmi ]
    }
  `,
    SAVI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B04", "B08", "dataMask"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      
      if (sample.dataMask === 0) {
        return [NaN];
      }

      let L = 0.428
      savi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L) * (1.0 + L);
      return [ savi ]
    }`,
    NDSI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B03", "B11"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let ndsi = (sample.B03 - sample.B11) / (sample.B11 + sample.B03)
      return [ ndsi ]
    }`,
    NDWI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B03", "B08"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08)
      return [ ndwi ]
    }
   `,
    NDBI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B08", "B11"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let ndbi = (sample.B11 - sample.B08) / (sample.B08 + sample.B11)
      return [ ndbi ]
    }`,
    NDCI: `//VERSION=3
    function setup() {
      return{
        input: [{
          bands: ["B05", "B04"],
          units: "REFLECTANCE"
          }],
        output: {
        id: "default",
        bands: 1,
        sampleType: SampleType.FLOAT32}
      }
    }

    function evaluatePixel(sample) {
      let ndci = (sample.B05 - sample.B04) / (sample.B05 + sample.B04)
      return [ ndci ]
      }`,
      NBR: `//VERSION=3
      function setup() {
        return{
          input: [{
            bands: ["B08", "B12"],
            units: "REFLECTANCE"
            }],
          output: {
          id: "default",
          bands: 1,
          sampleType: SampleType.FLOAT32}
        }
      }
  
      function evaluatePixel(sample) {
        let nbr = (sample.B08 - sample.B12) / (sample.B08 + sample.B12)
        return [ nbr ]
        }`,
  };
});
