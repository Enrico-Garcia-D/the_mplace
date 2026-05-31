// services/chatService.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { notifyNewMessage } from "./notificationService";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatListing {
  id: string;
  title: string;
  image?: string | null;
  price?: string | number | null;
  sellerUid?: string;
  sellerName?: string;
  buyerName?: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  listingPrice: string | number | null;
  lastMessage: string;
  lastMessageTime: Timestamp | null;
  unreadCount: Record<string, number>;
  createdAt: Timestamp | null;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp | null;
  read: boolean;
}

// ── Functions ─────────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  buyerUid: string,
  sellerUid: string,
  listing: ChatListing,
): Promise<string> {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", buyerUid),
    where("listingId", "==", listing.id),
  );

  const snap = await getDocs(q);
  const existing = snap.docs.find((d) =>
    (d.data() as Conversation).participants.includes(sellerUid),
  );
  if (existing) return existing.id;

  const convoRef = await addDoc(collection(db, "conversations"), {
    participants: [buyerUid, sellerUid],
    participantNames: {
      [buyerUid]: listing.buyerName ?? "Buyer",
      [sellerUid]: listing.sellerName ?? "Seller",
    },
    listingId: listing.id,
    listingTitle: listing.title,
    listingImage: listing.image ?? null,
    listingPrice: listing.price ?? null,
    lastMessage: "",
    lastMessageTime: serverTimestamp(),
    unreadCount: { [buyerUid]: 0, [sellerUid]: 0 },
    createdAt: serverTimestamp(),
  });

  return convoRef.id;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  participants: string[],
): Promise<void> {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  // 1. Save the actual message
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    text: trimmedText,
    createdAt: serverTimestamp(),
    read: false,
  });

  const otherId = participants.find((id) => id !== senderId);
  if (!otherId) return;

  // 2. Update the conversation preview and unread count
  const convoRef = doc(db, "conversations", conversationId);
  await updateDoc(convoRef, {
    lastMessage: trimmedText,
    lastMessageTime: serverTimestamp(),
    [`unreadCount.${otherId}`]: increment(1),
  });

  // 3. Trigger the Notification (The Bell + Push)
  try {
    const convoSnap = await getDoc(convoRef);
    const convoData = convoSnap.data() as Conversation;

    // We use the Master Service here
    await notifyNewMessage({
      recipientUid: otherId,
      senderName: convoData.participantNames?.[senderId] || "Someone",
      messageText: trimmedText,
      conversationId: conversationId,
      listingId: convoData.listingId,
      listingTitle: convoData.listingTitle ?? "Listing",
      listingImage: convoData.listingImage ?? "",
      listingPrice:
        convoData.listingPrice != null ? String(convoData.listingPrice) : "",
      otherUid: senderId,
    });

    console.log("Notification sent successfully to:", otherId);
  } catch (err) {
    console.warn("Notification failed, but message was sent:", err);
  }
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
      })),
    );
  });
}

export function subscribeToConversations(
  uid: string,
  callback: (conversations: Conversation[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    orderBy("lastMessageTime", "desc"),
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, "id">),
      })),
    );
  });
}

export async function markConversationAsRead(
  conversationId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), {
    [`unreadCount.${uid}`]: 0,
  });
}
