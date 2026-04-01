define(function () {
  return {
    ECSDW:`//VERSION=3

        function setup() {
            return {
                input: [ "coastal_blue","blue", "green","green_i", "yellow", "red","rededge","nir", "dataMask"],
                output: { bands: 9 }
            };
        }

        function evaluatePixel(sample) {
            return [
                sample.coastal_blue / 3000,   // 1
                sample.blue / 3000,           // 2
                sample.green / 3000,          // 3
                sample.green_i / 3000,        // 4
                sample.yellow / 3000,         // 5
                sample.red / 3000,            // 6
                sample.rededge / 3000,        // 7
                sample.nir / 3000,            // 8
                sample.dataMask               // 9
            ];
        }
    `,
    ECSDW1:`//VERSION=3
    function setup() {
        return {
            input: ["blue", "green", "red", "dataMask"],
            output: { bands: 4}
        };
    }

    function evaluatePixel(sample) {
        return [ sample.red / 3000,  sample.green / 3000, sample.blue / 3000, sample.dataMask ];
    }
    `
};
});