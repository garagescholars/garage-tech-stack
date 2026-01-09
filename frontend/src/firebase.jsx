import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <--- NEW: Import Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  // PASTE YOUR KEYS HERE IF THEY ARENT ALREADY HERE
  apiKey: "AIzaSyBPOosKjdOrj1dMLmgs1bH2Z9FoqqrZQI8",
  authDomain: "garage-scholars-v2.firebaseapp.com",
  projectId: "garage-scholars-v2",
  storageBucket: "garage-scholars-v2.firebasestorage.app",
  messagingSenderId: "583159785746",
  appId: "1:583159785746:web:87d8ed8f5634ea79c26bcb"
};

const app = initializeApp(firebaseConfig);

// Export the services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app); // <--- NEW: Export Storage service