import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBCTp5zMaVwBWkBpY6sDzZu6KoS2Mk6064",
  authDomain: "daily-dish-b10b4.firebaseapp.com",
  projectId: "daily-dish-b10b4",
  storageBucket: "daily-dish-b10b4.firebasestorage.app",
  messagingSenderId: "381161925926",
  appId: "1:381161925926:web:118832f1b1888b8511a5e7",
};

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const allowedEmail = "mydailydishapp@gmail.com";
