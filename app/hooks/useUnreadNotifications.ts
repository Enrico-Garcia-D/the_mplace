import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase";
import { subscribeToConversations } from "../../services/chatService";
import { useAuthUid } from "./useAuthUid";

export function useUnreadNotifications() {
  const uid = useAuthUid();
  const [storedNotifications, setStoredNotifications] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "notifications", uid, "items"),
      where("read", "==", false)
    );

    return onSnapshot(q, (snap) => {
      setStoredNotifications(snap.docs.map((doc) => doc.data()));
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    return subscribeToConversations(uid, (conversations) => {
      const totalUnread = conversations.reduce((total, convo) => {
        return total + (convo.unreadCount?.[uid] ?? 0);
      }, 0);

      setUnreadMessages(totalUnread);
    });
  }, [uid]);

  if (!uid) return 0;

  const unreadStoredMessages = storedNotifications.filter(
    (notification) => notification.type === "new_message",
  ).length;
  const unreadStoredOther = storedNotifications.filter(
    (notification) => notification.type !== "new_message",
  ).length;

  return unreadStoredOther + Math.max(unreadStoredMessages, unreadMessages);
}
