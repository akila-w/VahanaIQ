// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// AI vehicle search goes through a serverless proxy (see /serverless) that
// holds the Gemini API key and model choice, so no key is ever in the browser.
export const APP_VERSION = "2.8.1";

export const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app"
};
