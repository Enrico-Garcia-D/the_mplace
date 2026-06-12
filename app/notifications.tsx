// app/notifications.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  Conversation,
  markConversationAsRead,
  subscribeToConversations,
} from "../services/chatService";
import { useTheme } from "./theme";
import { useAuthUid } from "./hooks/useAuthUid";

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  data?: Record<string, any>;
}

function timeAgo(ts: any): string {
  if (!ts) return "Just now";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = useAuthUid();

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "notifications", uid, "items"),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedNotifs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AppNotification[];

        setNotifications(fetchedNotifs);
        setLoading(false);
      },
      (error) => {
        console.error("Notification listener error:", error);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    return subscribeToConversations(uid, (convos) => {
      setConversations(convos);
      setLoading(false);
    });
  }, [uid]);

  const visibleNotifications = useMemo(() => {
    if (!uid) return [];

    const storedNotifications = notifications;
    const storedMessageConversationIds = new Set(
      storedNotifications
        .filter(
          (notification) =>
            notification.type === "new_message" && !notification.read,
        )
        .map((notification) => notification.data?.conversationId)
        .filter(Boolean),
    );

    const conversationNotifications = conversations
      .filter((conversation) => (conversation.unreadCount?.[uid] ?? 0) > 0)
      .filter((conversation) => !storedMessageConversationIds.has(conversation.id))
      .map((conversation) => {
        const otherUid = conversation.participants.find((participant) => participant !== uid) ?? "";
        const unread = conversation.unreadCount?.[uid] ?? 0;

        return {
          id: `message-${conversation.id}`,
          type: "new_message",
          title: conversation.participantNames?.[otherUid] ?? "New message",
          body:
            unread > 1
              ? `${unread} unread messages`
              : conversation.lastMessage || "You have a new message",
          read: false,
          createdAt: conversation.lastMessageTime,
          data: {
            conversationId: conversation.id,
            listingId: conversation.listingId,
            listingTitle: conversation.listingTitle,
            listingImage: conversation.listingImage ?? "",
            listingPrice:
              conversation.listingPrice != null
                ? String(conversation.listingPrice)
                : "",
            otherUid,
          },
        } satisfies AppNotification;
      });

    return [...conversationNotifications, ...storedNotifications].sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, notifications, uid]);

  const isLoading = uid ? loading : false;
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!uid) return;
    const batch = writeBatch(db);
    visibleNotifications
      .filter((n) => !n.read)
      .forEach((n) => {
        if (n.id.startsWith("message-")) return;
        batch.update(doc(db, "notifications", uid, "items", n.id), {
          read: true,
        });
      });

    await Promise.all([
      batch.commit(),
      ...conversations
        .filter((conversation) => (conversation.unreadCount?.[uid] ?? 0) > 0)
        .map((conversation) => markConversationAsRead(conversation.id, uid)),
    ]);
  };

   const handlePress = async (notif: AppNotification) => {
    if (!uid) return;

    if (!notif.read) {
      try {
        if (notif.id.startsWith("message-") && notif.data?.conversationId) {
          await markConversationAsRead(notif.data.conversationId, uid);
        } else {
          await updateDoc(doc(db, "notifications", uid, "items", notif.id), {
            read: true,
          });
        }
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    }

    //
    if (notif.type === "new_message" && notif.data?.conversationId) {
      const conversation = conversations.find(
        (item) => item.id === notif.data?.conversationId,
      );
      const otherUid =
        notif.data.otherUid ||
        conversation?.participants.find((participant) => participant !== uid) ||
        "";

      router.push({
        pathname: "/chat",
        params: { 
          conversationId: notif.data.conversationId,
          listingId: notif.data.listingId || conversation?.listingId || "",
          otherName: notif.title,        
          listingTitle: notif.data.listingTitle || conversation?.listingTitle || "",
          listingImage: notif.data.listingImage || conversation?.listingImage || "",
          listingPrice:
            notif.data.listingPrice ||
            (conversation?.listingPrice != null
              ? String(conversation.listingPrice)
              : ""),
          otherUid,
        }
      } as any);
    } else if (notif.type === "new_review") {
      router.push("/reviews" as any);
    }
  };

  const iconForType = (type: string) => {
    switch (type) {
      case "new_message":
        return "chatbubble-ellipses";
      case "new_review":
        return "star";
      default:
        return "notifications";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : visibleNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="notifications-outline"
            size={52}
            color={theme.subtext}
          />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            You will see message alerts here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.read && styles.notifCardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              <View
                style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}
              >
                <Ionicons
                  name={iconForType(item.type) as any}
                  size={20}
                  color={!item.read ? "#0f766e" : theme.subtext}
                />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifTop}>
                  <Text style={styles.notifTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.notifTime}>
                    {timeAgo(item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {item.body}
                </Text>
                {item.data?.listingTitle && (
                  <Text style={styles.notifMeta} numberOfLines={1}>
                    Re: {item.data.listingTitle}
                  </Text>
                )}
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: "800", color: theme.text },
    markAllText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#0f766e",
      width: 80,
      textAlign: "right",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 40,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
    emptySubtitle: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      lineHeight: 20,
    },
    listContent: { padding: 16, gap: 10 },
    notifCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 12,
    },
    notifCardUnread: {
      borderColor: "#0f766e",
      backgroundColor: "#f0fdf9",
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapUnread: { backgroundColor: "#ccfbf1" },
    notifContent: { flex: 1, gap: 3 },
    notifTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    notifTitle: { fontSize: 14, fontWeight: "700", color: theme.text, flex: 1 },
    notifTime: { fontSize: 11, color: theme.subtext, marginLeft: 8 },
    notifBody: { fontSize: 13, color: theme.subtext, lineHeight: 18 },
    notifMeta: {
      fontSize: 11,
      color: "#0f766e",
      fontWeight: "600",
      marginTop: 2,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#0f766e",
      marginTop: 4,
    },
  });
