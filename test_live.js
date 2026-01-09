const { postToEbay } = require('./ebay_poster');

const liveItem = {
    title: "TEST LIVE LISTING - Do Not Buy (Garage Scholars)",
    description: "This is a live test of the Garage Scholars automated listing system.",
    price: "500.00", // High price so no one buys it by accident
    images: ["https://i.ebayimg.com/images/g/KQEAAOSw7~1g~1~1/s-l1600.jpg"], // Generic image
    brand: "Garage Scholars",
    sku: `TEST-LIVE-${Date.now()}`
};

postToEbay(liveItem);