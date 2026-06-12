import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Timestamp, doc, getDoc } from "firebase/firestore"; // Added doc, getDoc
import { db } from "../../services/firebase";
import {
  subscribeToConversations,
  Conversation,
} from "../../services/chatService";
import { useThemeMode } from "../theme";
import { useAuthUid } from "../hooks/useAuthUid";

// ── Components ────────────────────────────────────────────────────────────────

function VerificationOverlay({ status, theme, router }: { status: string, theme: any, router: any }) {
  const isPending = status === 'pending';
  const glassBg = theme.background === '#061224' ? "rgba(11,29,54,0.92)" : "rgba(255,255,255,0.80)";
  const glassBorder = theme.background === '#061224' ? "rgba(91,183,255,0.18)" : "rgba(203,213,225,0.92)";
  
  return (
    <View style={[StyleSheet.absoluteFill, { 
      backgroundColor: 'rgba(7,26,51,0.22)', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 10,
      padding: 24
    }]}>
      <View style={{ 
        backgroundColor: glassBg, 
        padding: 24, 
        borderRadius: 24, 
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: glassBorder,
        shadowColor: '#071a33',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.10,
        shadowRadius: 18,
        elevation: 3,
      }}>
        <View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: theme.primarySoft, 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: 16 
        }}>
          <Ionicons name={isPending ? "hourglass" : "alert-circle-outline"} size={32} color={theme.primary} />
        </View>
        
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          {isPending ? "Verification in Progress" : "Verification Required"}
        </Text>
        
        <Text style={{ fontSize: 14, color: theme.subtext, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          {isPending 
            ? "Your account is being reviewed. Messaging will be available once your ID is approved." 
            : "You need to verify your ID before you can message sellers or buyers."}
        </Text>

        <TouchableOpacity 
          style={{ 
            backgroundColor: theme.primary, 
            paddingVertical: 14, 
            paddingHorizontal: 24, 
            borderRadius: 12, 
            width: '100%',
            alignItems: 'center' 
          }}
          onPress={() => isPending ? router.push('/profile') : router.push('/id-upload')}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {isPending ? "Check Profile Status" : "Verify Now"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts as unknown as number);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesTab() {
  const { theme } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const uid = useAuthUid();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<string | null>(null);

  //  Fixed the unclosed fetchStatus useEffect
  useEffect(() => {
    const fetchStatus = async () => {
      if (!uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          setUserStatus(userDoc.data().status || 'unverified');
        }
      } catch (e) {
        console.error("Status fetch error:", e);
      }
    };
    fetchStatus();
  }, [uid]); 

  useEffect(() => {
    if (!uid) return;

    const unsub = subscribeToConversations(uid, (convos) => {
      setConversations(convos);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const openChat = (convo: Conversation) => {
    const otherUid = convo.participants.find((p) => p !== uid) ?? "";
    const otherName = convo.participantNames?.[otherUid] ?? "User";

    const qs = new URLSearchParams({
      conversationId: convo.id,
      listingId: convo.listingId,
      listingTitle: convo.listingTitle ?? "",
      listingImage: convo.listingImage ?? "",
      listingPrice: convo.listingPrice != null ? String(convo.listingPrice) : "",
      otherUid: otherUid ?? "",
      otherName: otherName ?? "",
    }).toString();

    router.push(`/chat?${qs}`);
  };

  const getUnread = (convo: Conversation): number => {
    return uid ? (convo.unreadCount?.[uid] ?? 0) : 0;
  };

  const visibleConversations = uid ? conversations : [];
  const isLoading = uid ? loading : false;
  const totalUnread = visibleConversations.reduce((total, convo) => {
    return total + getUnread(convo);
  }, 0);

  const renderItem = ({ item }: ListRenderItemInfo<Conversation>) => {
    const otherUid = item.participants.find((p) => p !== uid) ?? "";
    const otherName = item.participantNames?.[otherUid] ?? "Unknown";
    const unread = getUnread(item);

    return (
      <TouchableOpacity
        style={[styles.convoItem, unread > 0 && styles.unreadConversation]}
        activeOpacity={0.8}
        onPress={() => openChat(item)}
      >
        <View style={styles.convoAvatar}>
          <Text style={styles.avatarText}>
            {otherName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.convoBody}>
          <View style={styles.convoTop}>
            <Text style={styles.convoName}>{otherName}</Text>
            <Text style={styles.convoTime}>
              {formatTime(item.lastMessageTime)}
            </Text>
          </View>
          <Text style={styles.convoItem2} numberOfLines={1}>
            {item.listingTitle}
          </Text>
          <Text
            style={[styles.convoMsg, unread > 0 && styles.convoMsgUnread]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Verification Overlay logic */}
      {userStatus !== 'verified' && userStatus !== null && (
        <VerificationOverlay status={userStatus} theme={theme} router={router} />
      )}

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalUnread > 99 ? "99+" : totalUnread}
            </Text>
          </View>
        </View>
      </View>

      {!isLoading && visibleConversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={52} color={theme.secondary} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyText}>When buyers contact you, their messages will appear here.</Text>
        </View>
      ) : (
        <FlatList<Conversation>
          data={visibleConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
    headerTitle: { fontSize: 26, fontWeight: "800", color: theme.text },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    convoItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      marginBottom: 6,
      backgroundColor: theme.background === '#061224' ? "rgba(11,29,54,0.90)" : "rgba(255,255,255,0.60)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.background === '#061224' ? "rgba(91,183,255,0.16)" : "rgba(255,255,255,0.76)",
      gap: 12,
      shadowColor: "#071a33",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
    convoAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    convoBody: { flex: 1, gap: 2 },
    convoTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    convoName: { fontSize: 15, fontWeight: "700", color: theme.text },
    convoTime: { fontSize: 12, color: theme.secondary },
    convoItem2: { fontSize: 12, color: theme.primary, fontWeight: "600" },
    convoMsg: { fontSize: 13, color: theme.subtext },
    convoMsgUnread: { fontWeight: "700", color: theme.text },
    badge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { fontSize: 11, fontWeight: "800", color: theme.primaryText },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
    emptyText: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      lineHeight: 21,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerBadge: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    headerBadgeText: {
      color: theme.primaryText,
      fontWeight: "700",
      fontSize: 13,
    },
    unreadConversation: {
      borderLeftWidth: 4,
      backgroundColor: theme.background === '#061224' ? "rgba(91,183,255,0.10)" : "rgba(15,118,110,0.10)",
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.primary,
    },
  });
