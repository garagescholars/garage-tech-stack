require('dotenv').config();
console.log({
  env: process.env.EBAY_ENV,
  hasId: !!process.env.EBAY_CLIENT_ID,
  redirect: process.env.EBAY_REDIRECT_URI,
  publish: process.env.EBAY_PUBLISH_ENABLED,
  tokenPath: process.env.EBAY_TOKEN_DOC_PATH,
  setupPath: process.env.EBAY_SETUP_DOC_PATH
});
