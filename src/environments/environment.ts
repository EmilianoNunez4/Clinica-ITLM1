// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const environment = {
  production: true,
  firebaseConfig : {
  apiKey: "AIzaSyBLY1eHRxF3MXCplFyAXsC2mBqgXyty_Ko",
  authDomain: "clinica-itlm.firebaseapp.com",
  projectId: "clinica-itlm",
  storageBucket: "clinica-itlm.firebasestorage.app",
  messagingSenderId: "523850466619",
  appId: "1:523850466619:web:1c39969b8471b290dea31e"
  }
};

// Inicializa la app en Firebase
const app = initializeApp(environment.firebaseConfig);

// Exporta instancias firebase para usarlas en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);
