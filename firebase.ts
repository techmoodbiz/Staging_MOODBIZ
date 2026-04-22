import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAa7s0JC9Z6Jz_cMQCD_oBT0ZUzj50tMVA",
  authDomain: "moodbiz---rbac.firebaseapp.com",
  projectId: "moodbiz---rbac",
  storageBucket: "moodbiz---rbac.firebasestorage.app",
  messagingSenderId: "566398793256",
  appId: "1:566398793256:web:500b5f58c5c008984fa71d",
  measurementId: "G-79ZDZ9X8ER"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
export const db = firebase.firestore();
export default firebase;