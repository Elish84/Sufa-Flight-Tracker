// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBtf_w7snO_7hyJhv_Z_eFbgzh43FmR2SU",
  authDomain: "sufa-73c50.firebaseapp.com",
  projectId: "sufa-73c50",
  storageBucket: "sufa-73c50.firebasestorage.app",
  messagingSenderId: "627835144004",
  appId: "1:627835144004:web:6ea1c1370f4ca37b5d7911",
  measurementId: "G-NLYG09HGLQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence (Firestore's native one as a backup)
db.enablePersistence().catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
        console.warn('The current browser doesn\'t support all of the features required to enable persistence');
    }
});
