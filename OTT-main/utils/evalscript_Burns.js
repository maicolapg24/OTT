define(function () {
  return {
    NBR:`//VERSION=3
    function setup( ){
      return{
        input: [{
          bands: ["B02", "B03", "B04", "B08", "B11", "B12"],
            }],
            output: [{
              id: "default", bands: 1, sampleType: SampleType.FLOAT32},
            ]
            }
    }
      
    function evaluatePixel(sample) {

      let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      let indice = ((sample.B11 - sample.B12) /(sample.B11 + sample.B12))+(sample.B08);

      var burn;

      if (
        (indice > {{THRESHOLD}}) ||
        (sample.B02 > 0.1) ||
        (sample.B11 < 0.1) ||
        (ndvi > 0.3) ||
        (ndwi > 0.8)
      ) {
        burn = [0];
      } else {
        burn = [1];
      }

    return {
      default:[burn]
    }
    }
    `,
    NBR2:`
    //VERSION=3
    function setup() {
      return {
        input: [{
          bands: ["B02", "B03", "B04", "B08", "B11", "B12"],
        }],
        output: [
          { id: "default", bands: 3, sampleType: SampleType.AUTO }
        ]
      }
    }

    function evaluatePixel(sample) {

      let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      let indice = ((sample.B11 - sample.B12) / (sample.B11 + sample.B12)) + (sample.B08);

      var image;

      if (
        (indice > {{THRESHOLD}}) ||
        (sample.B02 > 0.1) ||
        (sample.B11 < 0.1) ||
        (ndvi > 0.3) ||
        (ndwi > 0.8)
      ) {
        image = [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
      } else {
        image = [1, 0, 0];
      }
      return {
        default: image,   
      }
    }
    

    
    `


};
});