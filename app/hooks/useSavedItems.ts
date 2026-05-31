import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

export function useSavedItems() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        setSavedIds(snapshot.data().savedItems || []);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { savedIds, loading };
}