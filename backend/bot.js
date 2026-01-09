const puppeteer = require('puppeteer');

(async () => {
  console.log('🤖 Robot Initializing...');

  // 1. Launch the Browser
  // 'headless: false' means you will physically see the browser open.
  const browser = await puppeteer.launch({ 
    headless: false, 
    slowMo: 50, // Slows down actions by 50ms so you can see what's happening
  });
  
  const page = await browser.newPage();

  // 2. Go to Craigslist (Denver)
  console.log('📍 Navigating to Craigslist Denver...');
  await page.goto('https://denver.craigslist.org/');

  // 3. Find and Click "create a posting"
  // We use the text selector to find the link
  console.log('👆 Clicking "create a posting"...');
  const postButton = await page.waitForSelector('#post');
  await postButton.click();

  // 4. Wait for the new page to load
  await page.waitForNavigation();
  console.log('✅ Arrived at posting page.');

  // 5. Take a Screenshot for verification
  await page.screenshot({ path: 'craigslist_proof.png' });
  console.log('📸 Screenshot saved.');

  // 6. Close up shop
  // await browser.close(); // Commented out so you can inspect the window
})();