// app/screens/chat.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItemInfo,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import {
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
  markConversationAsRead,
  Message,
} from "../../services/chatService";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateSeparator {
  id: string;
  type: "separator";
  label: string;
}

type ListItem = Message | DateSeparator;

function isSeparator(item: ListItem): item is DateSeparator {
  return (item as DateSeparator).type === "separator";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts as unknown as number);
}

function formatTime(ts: Timestamp | null | undefined): string {
  const d = toDate(ts);
  return d
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
}

function formatDateLabel(ts: Timestamp | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();

  const {
    conversationId: initialConvoId,
    listingId,
    listingTitle,
    listingImage,
    listingPrice,
    sellerUid,
    sellerName,
    otherUid,
    otherName,
  } = useLocalSearchParams<{
    conversationId?: string;
    listingId: string;
    listingTitle: string;
    listingImage?: string;
    listingPrice?: string;
    sellerUid: string;
    sellerName: string;
    otherUid: string;
    otherName: string;
  }>();

  const currentUser = auth.currentUser!;
  const listingIdValue = firstParam(listingId) ?? "";
  const listingTitleValue = firstParam(listingTitle) ?? "";
  const listingImageValue = firstParam(listingImage) ?? "";
  const listingPriceValue = firstParam(listingPrice) ?? "";
  const otherUidValue = firstParam(otherUid) ?? "";
  const otherNameValue = firstParam(otherName) ?? "User";
  const sellerUidParam = firstParam(sellerUid) ?? "";
  const sellerNameParam = firstParam(sellerName) ?? "";
  const [resolvedSellerUid, setResolvedSellerUid] = useState(sellerUidParam);
  const [resolvedSellerName, setResolvedSellerName] = useState(sellerNameParam);

  const participants = [currentUser.uid, otherUidValue].filter(Boolean);

  // true = current user is the buyer
  const isBuyer = Boolean(resolvedSellerUid) && currentUser.uid !== resolvedSellerUid;

  const [conversationId, setConversationId] = useState<string | null>(
    initialConvoId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList<ListItem>>(null);

  useEffect(() => {
    if (resolvedSellerUid || !listingIdValue) return;

    const resolveSeller = async () => {
      try {
        const listingSnap = await getDoc(doc(db, "listings", listingIdValue));
        const listingData = listingSnap.data();
        setResolvedSellerUid(listingData?.sellerUID ?? "");
        setResolvedSellerName(listingData?.sellerName ?? "Seller");
      } catch (err) {
        console.warn("Could not resolve listing seller for review:", err);
      }
    };

    resolveSeller();
  }, [listingIdValue, resolvedSellerUid]);

  // ── Init conversation + subscribe ──────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        let convoId = conversationId;

        if (!convoId) {
          convoId = await getOrCreateConversation(currentUser.uid, otherUidValue, {
            id: listingIdValue,
            title: listingTitleValue,
            image: listingImageValue || null,
            price: listingPriceValue || null,
            sellerUid: resolvedSellerUid,
            sellerName: resolvedSellerName,
            buyerName: currentUser.displayName ?? "Buyer",
          });
          setConversationId(convoId);
        }

        unsub = subscribeToMessages(convoId, (msgs) => {
          setMessages(msgs);
          setLoading(false);
        });

        await markConversationAsRead(convoId, currentUser.uid);
      } catch (err) {
        console.error("Chat init error:", err);
        setLoading(false);
      }
    };

    init();
    return () => unsub?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark read on new messages ──────────────────────────────────────────────
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markConversationAsRead(conversationId, currentUser.uid);
    }
  }, [messages, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !conversationId) return;
    setSending(true);
    setInputText("");
    try {
      await sendMessage(conversationId, currentUser.uid, text, participants);
    } catch (err) {
      console.error("Send error:", err);
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Leave review ───────────────────────────────────────────────────────────
  const handleLeaveReview = useCallback(() => {
    if (!resolvedSellerUid) {
      return;
    }

    router.push({
      pathname: "/listing/leave-review",
      params: {
        listingId: listingIdValue,
        listingTitle: listingTitleValue,
        sellerId: resolvedSellerUid,
        sellerName: resolvedSellerName || "Seller",
      },
    } as any);
  }, [
    listingIdValue,
    listingTitleValue,
    resolvedSellerUid,
    resolvedSellerName,
    router,
  ]);

  // ── Inject date separators ─────────────────────────────────────────────────
  const listItems = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let lastDateStr: string | null = null;
    for (const msg of messages) {
      const d = toDate(msg.createdAt);
      if (d) {
        const ds = d.toDateString();
        if (ds !== lastDateStr) {
          result.push({
            id: `sep-${ds}`,
            type: "separator",
            label: formatDateLabel(msg.createdAt),
          });
          lastDateStr = ds;
        }
      }
      result.push(msg);
    }
    return result;
  }, [messages]);

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      if (isSeparator(item)) {
        return (
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{item.label}</Text>
            <View style={styles.separatorLine} />
          </View>
        );
      }
      const isMine = item.senderId === currentUser.uid;
      return (
        <View
          style={[
            styles.bubbleWrapper,
            isMine ? styles.myWrapper : styles.theirWrapper,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMine ? styles.myBubble : styles.theirBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                isMine ? styles.myText : styles.theirText,
              ]}
            >
              {item.text}
            </Text>
          </View>
          <Text
            style={[
              styles.bubbleTime,
              isMine ? styles.timeRight : styles.timeLeft,
            ]}
          >
            {formatTime(item.createdAt)}
            {isMine && (
              <Text style={styles.receipt}>{item.read ? " ✓✓" : " ✓"}</Text>
            )}
          </Text>
        </View>
      );
    },
    [currentUser.uid],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color="#0f766e" />
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherNameValue}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {listingTitleValue}
            </Text>
          </View>
        </View>

        {/* Leave a Review button — only for buyers */}
        {isBuyer && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={handleLeaveReview}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={14} color="#0f766e" />
            <Text style={styles.reviewBtnText}>Review</Text>
          </TouchableOpacity>
        )}
        {!isBuyer && <View style={{ width: 32 }} />}
      </View>

      {/* Listing card */}
      <TouchableOpacity
        style={styles.listingCard}
        activeOpacity={0.85}
        onPress={() =>
          router.navigate({
            pathname: "/listing/[id]",
            params: { id: listingIdValue },
          })
        }
      >
        {listingImageValue ? (
          <Image source={{ uri: listingImageValue }} style={styles.listingImg} />
        ) : (
          <View style={styles.listingImgPlaceholder}>
            <Ionicons name="image-outline" size={20} color="#94a3b8" />
          </View>
        )}
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {listingTitleValue}
          </Text>
          {listingPriceValue ? (
            <Text style={styles.listingPrice}>
              ₱{Number(listingPriceValue).toLocaleString()}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
      </TouchableOpacity>

      {/* Messages + input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        ) : (
          <FlatList<ListItem>
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.msgList,
              { flexGrow: 1, paddingBottom: 12 },
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={40}
                  color="#cbd5e1"
                />
                <Text style={styles.emptyChatText}>
                  Say hi to start the conversation!
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || sending) && styles.sendBtnOff,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    maxWidth: 170,
  },
  headerSub: {
    fontSize: 12,
    color: "#0f766e",
    fontWeight: "600",
    maxWidth: 170,
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf9",
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
  },
  listingCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.12)",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    gap: 10,
  },
  listingImg: { width: 44, height: 44, borderRadius: 8 },
  listingImgPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  listingInfo: { flex: 1 },
  listingTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  listingPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f766e",
    marginTop: 2,
  },
  msgList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyChat: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyChatText: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  separatorText: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  bubbleWrapper: { marginBottom: 4, maxWidth: "78%" },
  myWrapper: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirWrapper: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  myBubble: { backgroundColor: "#0f766e", borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: "#f1f5f9", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  myText: { color: "#fff" },
  theirText: { color: "#111827" },
  bubbleTime: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
    marginHorizontal: 4,
  },
  timeRight: { textAlign: "right" },
  timeLeft: { textAlign: "left" },
  receipt: { color: "#0f766e" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#fff",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#f8fafc",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { backgroundColor: "#94a3b8" },
});
