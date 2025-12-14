// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const environment = {
  production: true,
  firebaseConfig : {
  apiKey: "AIzaSyCDceUm91JC7aDQ4HJ4cinRwN5ZiQwa9Ao",
  authDomain: "clinicaitlm-a88a7.firebaseapp.com",
  projectId: "clinicaitlm-a88a7",
  storageBucket: "clinicaitlm-a88a7.firebasestorage.app",
  messagingSenderId: "618058524214",
  appId: "1:618058524214:web:399c75a2cd948e9cc21a97"
  }
};

// Inicializa la app en Firebase
const app = initializeApp(environment.firebaseConfig);

// Exporta instancias firebase para usarlas en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);
