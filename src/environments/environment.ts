// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const environment = {
  production: true,
  firebaseConfig : {
  apiKey: "AIzaSyBrEBb8px0aA3sTmertjhOlhNn1ZQoNl3s",
  authDomain: "clinica-itlm2.firebaseapp.com",
  projectId: "clinica-itlm2",
  storageBucket: "clinica-itlm2.firebasestorage.app",
  messagingSenderId: "562917297352",
  appId: "1:562917297352:web:a9dad380cf656aebb5e9fd"
  }
};

// Inicializa la app en Firebase
const app = initializeApp(environment.firebaseConfig);

// Exporta instancias firebase para usarlas en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);
