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
  Alert,
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
import { generateAiChatReply } from "../../services/aiChatService";
import { getGeminiApiKey } from "../../services/geminiService";
import { moderateUserMessage } from "../../services/moderationService";
import { useThemeMode } from "../theme";

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
  const { theme } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);

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
  const isBuyer =
    Boolean(resolvedSellerUid) && currentUser.uid !== resolvedSellerUid;

  const [conversationId, setConversationId] = useState<string | null>(
    initialConvoId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

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
          convoId = await getOrCreateConversation(
            currentUser.uid,
            otherUidValue,
            {
              id: listingIdValue,
              title: listingTitleValue,
              image: listingImageValue || null,
              price: listingPriceValue || null,
              sellerUid: resolvedSellerUid,
              sellerName: resolvedSellerName,
              buyerName: currentUser.displayName ?? "Buyer",
            },
          );
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
  }, [
    conversationId,
    currentUser.displayName,
    currentUser.uid,
    listingIdValue,
    listingImageValue,
    listingPriceValue,
    listingTitleValue,
    otherUidValue,
    resolvedSellerName,
    resolvedSellerUid,
  ]);

  // ── Mark read on new messages ──────────────────────────────────────────────
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markConversationAsRead(conversationId, currentUser.uid);
    }
  }, [messages, conversationId, currentUser.uid]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages]);

  const appendPendingMessage = useCallback((senderId: string, text: string) => {
    const pending: Message = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId,
      text,
      createdAt: Timestamp.now(),
      read: false,
    };

    setPendingMessages((current) => [...current, pending]);
    return pending.id;
  }, []);

  const clearPendingMessage = useCallback((pendingId: string) => {
    setPendingMessages((current) =>
      current.filter((msg) => msg.id !== pendingId),
    );
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !conversationId) return;

    const pendingId = appendPendingMessage(currentUser.uid, text);
    setInputText("");
    let finalText = text;

    // Moderation / safety layer
    setSending(true);
    try {
      let moderation = {
        allowed: true,
        rewrite: undefined as string | undefined,
      };

      try {
        moderation = await moderateUserMessage({
          userText: text,
          listingContext: {
            listingTitle: listingTitleValue,
            listingPrice: listingPriceValue,
            sellerName: resolvedSellerName,
            buyerName: currentUser.displayName ?? "Buyer",
          },
        });
      } catch (moderationError) {
        console.warn(
          "Moderation unavailable, sending without rewrite:",
          moderationError,
        );
      }

      if (!moderation.allowed) {
        console.warn("Message blocked by moderation:", moderation);
        clearPendingMessage(pendingId);
        setInputText(text);
        Alert.alert(
          "Message blocked",
          moderation.reason || "This message looks invalid or unsafe.",
        );
        return;
      }

      finalText = moderation.rewrite?.trim() ? moderation.rewrite : text;
      await sendMessage(
        conversationId,
        currentUser.uid,
        finalText,
        participants,
      );
      clearPendingMessage(pendingId);
    } catch (err) {
      console.error("Send error:", err);
      setInputText(text);
      clearPendingMessage(pendingId);
      Alert.alert(
        "Send failed",
        err instanceof Error
          ? err.message
          : "We couldn’t send your message right now. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }, [
    inputText,
    sending,
    conversationId,
    participants,
    listingTitleValue,
    listingPriceValue,
    resolvedSellerName,
    currentUser.displayName,
    currentUser.uid,
    appendPendingMessage,
    clearPendingMessage,
  ]);

  const sendQuickReply = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationId) return;

      const pendingId = appendPendingMessage(currentUser.uid, trimmed);

      // Moderation / safety layer
      try {
        let moderation: Awaited<ReturnType<typeof moderateUserMessage>> = {
          allowed: true,
        };

        try {
          moderation = await moderateUserMessage({
            userText: trimmed,
            listingContext: {
              listingTitle: listingTitleValue,
              listingPrice: listingPriceValue,
              sellerName: resolvedSellerName,
              buyerName: currentUser.displayName ?? "Buyer",
            },
          });
        } catch (moderationError) {
          console.warn(
            "Moderation unavailable, sending quick reply anyway:",
            moderationError,
          );
        }

        if (!moderation.allowed) {
          console.warn("Quick reply blocked by moderation:", moderation);
          clearPendingMessage(pendingId);
          Alert.alert(
            "Message blocked",
            moderation.reason || "This message looks invalid or unsafe.",
          );
          return;
        }

        const finalText = moderation.rewrite?.trim()
          ? moderation.rewrite
          : trimmed;
        await sendMessage(
          conversationId,
          currentUser.uid,
          finalText,
          participants,
        );
        clearPendingMessage(pendingId);
      } catch (err) {
        console.error("Quick reply send error:", err);
        clearPendingMessage(pendingId);
        Alert.alert(
          "Send failed",
          err instanceof Error
            ? err.message
            : "We couldn’t send your message right now. Please try again.",
        );
      }
    },
    [
      conversationId,
      currentUser.uid,
      participants,
      listingTitleValue,
      listingPriceValue,
      resolvedSellerName,
      currentUser.displayName,
      appendPendingMessage,
      clearPendingMessage,
    ],
  );

  const handleAiReply = useCallback(async () => {
    if (!conversationId) return;
    if (aiThinking) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn(
        "Gemini API key missing. Set EXPO_PUBLIC_GEMINI_API_KEY in your environment.",
      );
      return;
    }

    // Use the last user message in this conversation as the AI input.

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.senderId !== currentUser.uid && m.text?.trim());

    const userText = lastUserMessage?.text?.trim();
    if (!userText) {
      return;
    }

    // Moderation / safety layer (avoid generating replies to unsafe content)
    const moderation = await moderateUserMessage({
      userText,
      listingContext: {
        listingTitle: listingTitleValue,
        listingPrice: listingPriceValue,
        sellerName: resolvedSellerName,
        buyerName: currentUser.displayName ?? "Buyer",
      },
    });

    if (!moderation.allowed) {
      console.warn("AI reply blocked by moderation:", moderation);
      return;
    }

    setAiThinking(true);
    try {
      const reply = await generateAiChatReply({
        apiKey,
        userText,
        listingContext: {
          listingTitle: listingTitleValue,
          listingPrice: listingPriceValue,
          sellerName: resolvedSellerName,
          buyerName: currentUser.displayName ?? "Buyer",
        },
        chatHistory: messages
          .filter((m) => m.text?.trim())
          .slice(-12)
          .map((m) => ({
            role: m.senderId === currentUser.uid ? "user" : "model",
            text: m.text,
          })),
      });

      if (reply) {
        await sendMessage(conversationId, currentUser.uid, reply, participants);
      }
    } catch (err) {
      console.error("AI reply error:", err);
    } finally {
      setAiThinking(false);
    }
  }, [
    aiThinking,
    conversationId,
    messages,
    currentUser.uid,
    currentUser.displayName,
    listingTitleValue,
    listingPriceValue,
    resolvedSellerName,
    participants,
  ]);

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
    for (const msg of [...messages, ...pendingMessages]) {
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
  }, [messages, pendingMessages]);

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
    [currentUser.uid, styles],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color={theme.primary} />
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
            <Ionicons name="star" size={14} color={theme.primary} />
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
          <Image
            source={{ uri: listingImageValue }}
            style={styles.listingImg}
          />
        ) : (
          <View style={styles.listingImgPlaceholder}>
            <Ionicons name="image-outline" size={20} color={theme.secondary} />
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
        <Ionicons name="chevron-forward" size={16} color={theme.secondary} />
      </TouchableOpacity>

      {/* Messages + input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={theme.primary} />
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
                  color={theme.secondary}
                />
                <Text style={styles.emptyChatText}>
                  Say hi to start the conversation!
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.quickRepliesOverlayWrap}>
          <View style={styles.quickRepliesOverlay}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => sendQuickReply("Hi! Is this available?")}
            >
              <Text style={styles.quickChipText}>Available?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() =>
                sendQuickReply("Yes, I can meet today. Where are you located?")
              }
            >
              <Text style={styles.quickChipText}>Meet today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => sendQuickReply("Is there any discount?")}
            >
              <Text style={styles.quickChipText}>Discount?</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={theme.placeholder}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={[
              styles.aiBtn,
              (!messages.length || aiThinking) && styles.sendBtnOff,
            ]}
            onPress={handleAiReply}
            disabled={aiThinking || !messages.length}
            activeOpacity={0.8}
          >
            {aiThinking ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <Ionicons name="sparkles" size={18} color={theme.primaryText} />
            )}
          </TouchableOpacity>

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
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <Ionicons name="send" size={18} color={theme.primaryText} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: "transparent" },
    flex: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: theme.background === '#061224' ? "rgba(11,29,54,0.92)" : "rgba(255,255,255,0.68)",
      borderBottomWidth: 1,
      borderBottomColor: theme.background === '#061224' ? "rgba(91,183,255,0.16)" : "rgba(255,255,255,0.72)",
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
      backgroundColor: theme.background === '#061224' ? "rgba(91,183,255,0.14)" : "#ccfbf1",
      alignItems: "center",
      justifyContent: "center",
    },
    headerName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
      maxWidth: 170,
    },
    headerSub: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: "600",
      maxWidth: 170,
    },
    reviewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.background === '#061224' ? "rgba(91,183,255,0.10)" : "rgba(15,118,110,0.12)",
      borderWidth: 0,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    reviewBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
    },
    listingCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 12,
      backgroundColor: theme.background === '#061224' ? "rgba(11,29,54,0.90)" : "rgba(255,255,255,0.64)",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.background === '#061224' ? "rgba(91,183,255,0.16)" : "rgba(255,255,255,0.74)",
      shadowColor: "#071a33",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 0,
      gap: 10,
    },
    listingImg: { width: 44, height: 44, borderRadius: 12 },
    listingImgPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
    },
    listingInfo: { flex: 1 },
    listingTitle: { fontSize: 13, fontWeight: "600", color: theme.text },
    listingPrice: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.primary,
      marginTop: 2,
    },
    msgList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyChat: { alignItems: "center", marginTop: 60, gap: 10 },
    emptyChatText: { fontSize: 14, color: theme.secondary, textAlign: "center" },
    separator: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 12,
      gap: 8,
    },
    separatorLine: { flex: 1, height: 1, backgroundColor: theme.border },
    separatorText: {
      fontSize: 11,
      color: theme.secondary,
      fontWeight: "600",
      paddingHorizontal: 6,
    },
    bubbleWrapper: { marginBottom: 4, maxWidth: "78%" },
    myWrapper: { alignSelf: "flex-end", alignItems: "flex-end" },
    theirWrapper: { alignSelf: "flex-start", alignItems: "flex-start" },
    bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
    myBubble: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 18,
      shadowOpacity: 0.06,
    },
    theirBubble: {
      backgroundColor: theme.background === '#061224' ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.80)",
      borderBottomLeftRadius: 18,
      shadowOpacity: 0.06,
    },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    myText: { color: theme.primaryText },
    theirText: { color: theme.text },
    bubbleTime: {
      fontSize: 10,
      color: theme.secondary,
      marginTop: 2,
      marginHorizontal: 4,
    },
    timeRight: { textAlign: "right" },
    timeLeft: { textAlign: "left" },
    receipt: { color: theme.primary },
    quickRepliesOverlayWrap: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 0,
      zIndex: 20,
      paddingBottom: 72,
      pointerEvents: "box-none",
    },
    quickRepliesOverlay: {
      backgroundColor: theme.background === '#061224' ? "rgba(11,29,54,0.92)" : "rgba(255,255,255,0.66)",
      borderWidth: 0,
      borderRadius: 22,
      paddingVertical: 8,
      paddingHorizontal: 8,
      flexDirection: "row",
      gap: 4,
      justifyContent: "flex-start",
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 0,
      backgroundColor: theme.background === '#061224' ? "rgba(11,29,54,0.94)" : "rgba(255,255,255,0.68)",
      gap: 10,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 100,
      backgroundColor: theme.background === '#061224' ? "rgba(255,255,255,0.06)" : "rgba(248,250,252,0.9)",
      borderRadius: 24,
      borderWidth: 0,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    quickRepliesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 8,
    },
    quickChip: {
      backgroundColor: theme.background === '#061224' ? "rgba(91,183,255,0.10)" : "rgba(15,118,110,0.12)",
      borderWidth: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    quickChipText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "800",
    },
    aiBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnOff: { backgroundColor: theme.secondary },
  });
