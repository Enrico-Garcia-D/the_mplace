import { useEffect, useState } from "react";
import { subscribeToConversations } from "../../services/chatService";
import { useAuthUid } from "./useAuthUid";

export function useUnreadMessages() {
  const uid = useAuthUid();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;

    return subscribeToConversations(uid, (conversations) => {
      const totalUnread = conversations.reduce((total, convo) => {
        return total + (convo.unreadCount?.[uid] ?? 0);
      }, 0);

      setCount(totalUnread);
    });
  }, [uid]);

  return uid ? count : 0;
}
