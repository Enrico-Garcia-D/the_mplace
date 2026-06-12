import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserStatus } from '../types';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();

    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }

    const userInfo = await GoogleSignin.signIn();

    if (userInfo.type !== 'success') {
      const error = new Error('Sign in was cancelled');
      (error as any).code = statusCodes.SIGN_IN_CANCELLED;
      throw error;
    }

    const idToken = userInfo.data.idToken;

    if (!idToken) throw new Error('No ID token found');

    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, googleCredential);
    const user = result.user;

    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        status: 'needs_id',
        idPhotoURL: null,
        createdAt: new Date().toISOString(),
      });

      return { user, isNewUser: true };
    }

    return { user, isNewUser: false };
  } catch (error) {
    if (__DEV__) {
      console.log('SIGN IN ERROR:', JSON.stringify(error));
    }
    throw error;
  }
};

export const getGoogleSignInErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  if (code === statusCodes.SIGN_IN_CANCELLED) {
    return 'Sign in was cancelled.';
  }

  if (code === statusCodes.IN_PROGRESS) {
    return 'A sign-in attempt is already in progress.';
  }

  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services is not available or needs to be updated.';
  }

  if (code === '10') {
    return 'Google sign-in is not configured for this Android app yet. Check the Android OAuth client package name and SHA-1 in Firebase/Google Cloud.';
  }

  return 'Something went wrong. Please try again.';
};

export const signOut = async () => {
  if (__DEV__) {
    console.log('signOut(): starting sign-out');
  }
  let googleSignOutError: unknown;

  try {
    await GoogleSignin.signOut();
    if (__DEV__) {
      console.log('signOut(): Google sign-out succeeded');
    }
  } catch (error) {
    googleSignOutError = error;
    console.warn('signOut(): Google sign-out failed:', error);
  }

  try {
    await firebaseSignOut(auth);
    if (__DEV__) {
      console.log('signOut(): Firebase sign-out succeeded');
    }
  } catch (error) {
    console.error('signOut(): Firebase sign-out failed:', error);
    if (googleSignOutError) {
      throw new Error(
        `Firebase sign-out failed after Google sign-out failed: ${String(error)}`,
      );
    }
    throw error;
  }
};

export const getCurrentUserStatus = async (uid: string): Promise<UserStatus> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));

    if (!userDoc.exists()) {
      return 'needs_id';
    }

    const userData = userDoc.data();
    const status = userData.status as UserStatus | undefined;

    if (!userData.idPhotoURL && status !== 'verified') {
      return 'needs_id';
    }

    return status ?? 'needs_id';
  } catch (error) {
    throw error;
  }
};
