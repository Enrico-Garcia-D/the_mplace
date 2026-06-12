import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../services/firebase";

export function useSavedItems() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeDoc?.();
      unsubscribeDoc = undefined;
      setSavedIds([]);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeDoc = onSnapshot(
        doc(db, "users", currentUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setSavedIds(snapshot.data().savedItems || []);
          } else {
            setSavedIds([]);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error loading saved items:", error);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeDoc?.();
      unsubscribeAuth();
    };
  }, []);

  return { savedIds, loading };
}
