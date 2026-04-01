define(function () {
  return {
    MAP_DEFORESTATION:`//VERSION=3
    
  // Thresholds and constants
  const NDVI_THRESHOLD = 0.3; // Minimum NDVI difference between periods
  const NDWI_THRESHOLD = 0.5; // Threshold to classify water using NDWI
  const BRIGHTNESS_THRESHOLD = 0.18; // Reflectance threshold for Blue band
  const WINDOW_DAYS = 10; // Time window for averaging NDVI
  const CLOUD_PROBABILITY_THRESHOLD = 0.5;

  function setup() {
  return {
    input: [
      {
        bands: ["B02", "B03", "B04", "B08", "CLD"],
      },
    ],
    output: [
      {
        id: "data",
        bands: 1,
        sampleType: "UINT8"
      }
    ],
    mosaicking: "ORBIT",
  };
  }

  function evaluatePixel(samples, scenes) {
    // Sort scenes to find the most recent and oldest
    const sortedScenes = scenes.sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
    const recentDate = sortedScenes[0].date;
    const oldestDate = sortedScenes[sortedScenes.length - 1].date;

    // Filter scenes within the n-day window for recent and oldest periods
    const recentWindowScenes = sortedScenes.filter(
      (scene) =>
        recentDate.getTime() - scene.date.getTime() <=
        WINDOW_DAYS * 24 * 3600 * 1000
    );
    const oldestWindowScenes = sortedScenes.filter(
      (scene) =>
        scene.date.getTime() - oldestDate.getTime() <=
        WINDOW_DAYS * 24 * 3600 * 1000
    );

    // Calculate mean NDVI for the recent and oldest windows
    function calculateMeanNDVI(scenesArray) {
      let sumNDVI = 0;
      let count = 0;
      scenesArray.forEach((scene) => {
        const sample = samples[scenes.indexOf(scene)];
        if (sample && !isCloudOrWater(sample)) {
          const ndvi = index(sample.B08, sample.B04);
          sumNDVI += ndvi;
          count += 1;
        }
      });
      // if the ndvi was not calculated because of cloud or water the function return null
      return count > 0 ? sumNDVI / count : null;
    }

    // Helper function to detect clouds using Blue and CLD
    function isCloudOrWater(sample) {
      const brightness = sample.B02; // Blue band reflectance
      const cloudProb = sample.CLD; // Cloud probability, based on Sen2Cor processor
      const NDWI = index(sample.B03, sample.B08);

      // Clouds: High reflectance in Blue or high CLD
      const isCloud =
        brightness > BRIGHTNESS_THRESHOLD || cloudProb > CLOUD_PROBABILITY_THRESHOLD;

      // Water: NDWI above threshold
      const isWater = NDWI >= NDWI_THRESHOLD;

      return isCloud || isWater;
    }

    const recentMeanNDVI = calculateMeanNDVI(recentWindowScenes);
    const oldestMeanNDVI = calculateMeanNDVI(oldestWindowScenes);

    const ndviDifference =
      recentMeanNDVI !== null && oldestMeanNDVI !== null
        ? oldestMeanNDVI - recentMeanNDVI
        : 0;

    // Initialize result values
    let deforestation = 0;


    if (ndviDifference >= NDVI_THRESHOLD) {
      deforestation = 1; // Deforestation detected
    }

    // Return values with water and cloud masking
    if (deforestation === 1) {
      return {
        data: [1], // Deforestation detected
      };
    } else {
      return {
        data: [0], // No significant change 
      };
    }
  }
      `
};
});