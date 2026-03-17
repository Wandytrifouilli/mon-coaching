import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrhd9TagXrEQo8GD8Lc1rJlod0nN-T7xA",
  authDomain: "mon-coaching-6399e.firebaseapp.com",
  projectId: "mon-coaching-6399e",
  storageBucket: "mon-coaching-6399e.firebasestorage.app",
  messagingSenderId: "885029359700",
  appId: "1:885029359700:web:366b943ddabf1126f69dc1",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch };
