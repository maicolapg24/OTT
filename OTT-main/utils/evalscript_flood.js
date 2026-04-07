define(function () {
  return {
    // Máscara binaria de inundación por MNDWI
    FLOOD_MASK_MNDWI: (threshold = 0.15) => `//VERSION=3
function setup() {
  return {
    input: ["B03", "B11", "SCL", "CLM", "dataMask"],
    output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
  };
}

function isValid(sample) {
  // CLM: 1 nube
  if (sample.CLM === 1) return false;

  // SCL no válidos (nube/sombra/cirrus/snow/nodata)
  // 0: No data, 3: Cloud shadows, 8/9/10: Clouds/Cirrus, 11: Snow/Ice
  if ([0, 3, 8, 9, 10, 11].includes(sample.SCL)) return false;

  return true;
}

function evaluatePixel(sample) {
  if (!isValid(sample)) {
    return { data: [0], dataMask: [0] };
  }

  const mndwi = index(sample.B03, sample.B11);
  const flood = mndwi > ${threshold} ? 1 : 0;

  return {
    data: [flood],
    dataMask: [sample.dataMask]
  };
}`,

    // Máscara binaria por NDWI clásico (opcional)
    FLOOD_MASK_NDWI: (threshold = 0.10) => `//VERSION=3
function setup() {
  return {
    input: ["B03", "B08", "SCL", "CLM", "dataMask"],
    output: [{ id: "data", bands: 1 }, { id: "dataMask", bands: 1 }]
  };
}

function isValid(sample) {
  if (sample.CLM === 1) return false;
  if ([0, 3, 8, 9, 10, 11].includes(sample.SCL)) return false;
  return true;
}

function evaluatePixel(sample) {
  if (!isValid(sample)) {
    return { data: [0], dataMask: [0] };
  }

  const ndwi = index(sample.B03, sample.B08);
  const flood = ndwi > ${threshold} ? 1 : 0;

  return {
    data: [flood],
    dataMask: [sample.dataMask]
  };
}`,

    // Visualización RGB para mapa rápido
    FLOOD_VIS_RGB: (threshold = 0.15) => `//VERSION=3
function setup() {
  return {
    input: ["B03", "B11", "SCL", "CLM", "dataMask"],
    output: { bands: 3, sampleType: "AUTO" }
  };
}

function isValid(sample) {
  if (sample.CLM === 1) return false;
  if ([0, 3, 8, 9, 10, 11].includes(sample.SCL)) return false;
  return true;
}

function evaluatePixel(sample) {
  if (!isValid(sample)) return [0, 0, 0];

  const mndwi = index(sample.B03, sample.B11);
  const flood = mndwi > ${threshold};

  // Azul intenso para inundación, gris oscuro resto
  if (flood) return [0.1, 0.45, 1.0];
  return [0.15, 0.15, 0.15];
}`
  };
});