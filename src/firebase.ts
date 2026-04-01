import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use default database if firestoreDatabaseId is missing or invalid
const firestoreDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" 
  ? firebaseConfig.firestoreDatabaseId 
  : "(default)";

console.log(`Initializing Firestore with database ID: ${firestoreDbId}`);
export const db = getFirestore(app, firestoreDbId);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signInAnon = () => signInAnonymously(auth);
export const signOut = () => auth.signOut();

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
