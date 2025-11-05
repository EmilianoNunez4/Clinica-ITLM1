// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const environment = {
  production: true,
  firebaseConfig : {
    apiKey: "AIzaSyBtWF3UxOnOyqLG_FjiABMHz1rRH6xM6-k",
    authDomain: "clinicaitlm1.firebaseapp.com",
    projectId: "clinicaitlm1",
    storageBucket: "clinicaitlm1.firebasestorage.app",
    messagingSenderId: "846141022569",
    appId: "1:846141022569:web:a23181239953fd23aa1df8"
  }
};

// Inicializa la app en Firebase
const app = initializeApp(environment.firebaseConfig);

// Exporta instancias firebase para usarlas en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);
