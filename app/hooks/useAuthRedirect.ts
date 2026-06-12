import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { getCurrentUserStatus } from '../../services/auth';
import { registerPushToken } from '../../services/notificationService';

export function useAuthRedirect() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (__DEV__) {
        console.log('Auth state changed. user:', user?.uid ?? 'null');
      }

      if (!user) {
        if (__DEV__) {
          console.log('Redirecting to login screen');
        }
        if (active) {
          router.replace('/login');
          setIsReady(true);
        }
        return;
      }

      try {
        const status = await getCurrentUserStatus(user.uid);
        if (__DEV__) {
          console.log('User status:', status);
        }

        if (!active) return;

        if (status === 'verified') {
          void registerPushToken(user.uid).catch((error) => {
            console.warn('Push token registration failed during auth redirect:', error);
          });
          router.replace('/home');
        } else if (status === 'needs_id') {
          router.replace('/id-upload');
        } else {
          router.replace('/pending');
        }
      } catch (err) {
        console.error('Error resolving auth redirect:', err);
        if (active) {
          router.replace('/login');
        }
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  return isReady;
}
