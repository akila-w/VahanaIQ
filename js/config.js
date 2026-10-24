// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// AI vehicle search goes through a serverless proxy (see /serverless) that
// holds the Gemini API key and model choice, so no key is ever in the browser.
export const APP_VERSION = "2.11.5";

export const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app"
};

// Google sign-in and sync (js/account.js). This web config is public by design: Firebase
// identifies the project with it, and firestore.rules decide who can read or write what.
export const firebaseConfig = {
  apiKey: "AIzaSyB7y80tXqmjxVf_jy9SOTo2x_yXWYhVquU",
  authDomain: "vahanaiq-sign-in.firebaseapp.com",
  projectId: "vahanaiq-sign-in",
  storageBucket: "vahanaiq-sign-in.firebasestorage.app",
  messagingSenderId: "376324722920",
  appId: "1:376324722920:web:c20f16fe322420ecfaf95d"
};

// Google's own sign-in button (Google Identity Services) for the project's web OAuth client.
// Firebase's sign-in pop-up stalls in Safari, which blocks the cross-site storage it relies on;
// this button hands an ID token straight to the page, and Firebase signs in with it.
export const GOOGLE_CLIENT_ID = "376324722920-0btrupeuvlepdl7rtsckljq8g3fftpq8.apps.googleusercontent.com";
export const GOOGLE_SIGN_IN_SRC = "https://accounts.google.com/gsi/client?hl=en";

// Firebase's modular SDK, loaded from Google's CDN only when someone signs in
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/12.19.0";
