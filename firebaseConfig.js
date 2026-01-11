// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCd67Evln3URwY62jgEwB63Hl-DFqNRvsk",
    authDomain: "finance-manager-aee8e.firebaseapp.com",
    projectId: "finance-manager-aee8e",
    storageBucket: "finance-manager-aee8e.firebasestorage.app",
    messagingSenderId: "376118302434",
    appId: "1:376118302434:web:9468b0be95f90613c670bb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;