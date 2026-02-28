const { postToEbay } = require('./ebay_poster');

const testItem = {
    title: "TEST LISTING - Garage Scholars Robot",
    description: "This is a test from the new inventory system. Do not buy.",
    price: "100.00",
    images: ["https://via.placeholder.com/300"], // Fake image
    brand: "GarageScholars",
    sku: "TEST-001"
};

postToEbay(testItem).then(result => {
    console.log("\nFINAL RESULT:", result);
});