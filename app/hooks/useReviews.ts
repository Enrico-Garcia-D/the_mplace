import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../../services/firebase";

export interface SellerReview {
  id: string;
  sellerId: string;
  buyerId: string;
  listingId: string;
  listingTitle?: string;
  rating: number;
  comment: string;
  buyerName: string;
  createdAt: any;
}

interface SubmitReviewParams {
  sellerId: string;
  buyerId: string;
  listingId: string;
  listingTitle?: string;
  rating: number;
  comment: string;
  buyerName: string;
}

function reviewIdFor(listingId: string, buyerId: string) {
  return `${encodeURIComponent(listingId)}_${encodeURIComponent(buyerId)}`;
}

function normalizeReviews(reviews: SellerReview[]) {
  return [...reviews].sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });
}

export function getReviewSummary(reviews: SellerReview[]) {
  const reviewCount = reviews.length;
  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);
  const average = reviewCount > 0 ? ratingSum / reviewCount : null;

  return {
    average,
    averageLabel: average != null ? average.toFixed(1) : null,
    reviewCount,
    ratingSum,
  };
}

export async function submitReview({
  sellerId,
  buyerId,
  listingId,
  listingTitle,
  rating,
  comment,
  buyerName,
}: SubmitReviewParams) {
  const safeSellerId = typeof sellerId === "string" ? sellerId.trim() : "";
  const safeBuyerId = typeof buyerId === "string" ? buyerId.trim() : "";
  const safeListingId = typeof listingId === "string" ? listingId.trim() : "";
  const safeRating = Number(rating);
  if (
    !safeSellerId ||
    !safeBuyerId ||
    !safeListingId ||
    safeSellerId === "undefined" ||
    safeBuyerId === "undefined" ||
    safeListingId === "undefined"
  ) {
    throw new Error("Missing review details.");
  }
  if (safeSellerId === safeBuyerId) {
    throw new Error("You cannot review your own listing.");
  }
  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    throw new Error("Please choose a rating from 1 to 5 stars.");
  }

  const legacyDuplicate = await getDocs(
    query(
      collection(db, "reviews"),
      where("buyerId", "==", safeBuyerId),
      where("listingId", "==", safeListingId),
    ),
  );
  if (!legacyDuplicate.empty) {
    throw new Error("You already reviewed this transaction.");
  }

  const reviewRef = doc(db, "reviews", reviewIdFor(safeListingId, safeBuyerId));
  const sellerRef = doc(db, "users", safeSellerId);
  const trimmedComment = comment.trim().slice(0, 500);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reviewRef);
    if (existing.exists()) {
      throw new Error("You already reviewed this transaction.");
    }

    const sellerSnap = await transaction.get(sellerRef);
    const currentReviewCount = sellerSnap.data()?.reviewCount ?? 0;
    const currentRatingSum = sellerSnap.data()?.ratingSum ?? 0;
    const nextReviewCount = currentReviewCount + 1;
    const nextRatingSum = currentRatingSum + safeRating;

    transaction.set(reviewRef, {
      sellerId: safeSellerId,
      buyerId: safeBuyerId,
      listingId: safeListingId,
      listingTitle: listingTitle ?? "",
      rating: safeRating,
      comment: trimmedComment,
      buyerName: buyerName || "Buyer",
      createdAt: serverTimestamp(),
    });

    transaction.set(
      sellerRef,
      {
        reviewCount: increment(1),
        ratingSum: increment(safeRating),
        ratingAverage: nextRatingSum / nextReviewCount,
      },
      { merge: true },
    );
  });
}

export async function getSellerReviews(sellerId: string, max = 20) {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("sellerId", "==", sellerId)),
  );

  return normalizeReviews(
    snap.docs.map((reviewDoc) => ({
      id: reviewDoc.id,
      ...(reviewDoc.data() as Omit<SellerReview, "id">),
    })),
  ).slice(0, max);
}

export function subscribeToSellerReviews(
  sellerId: string,
  callback: (reviews: SellerReview[]) => void,
): Unsubscribe {
  const reviewsQuery = query(
    collection(db, "reviews"),
    where("sellerId", "==", sellerId),
  );

  return onSnapshot(reviewsQuery, (snap) => {
    callback(
      normalizeReviews(
        snap.docs.map((reviewDoc) => ({
          id: reviewDoc.id,
          ...(reviewDoc.data() as Omit<SellerReview, "id">),
        })),
      ),
    );
  });
}

export async function syncSellerReviewAggregate(sellerId: string) {
  const reviews = await getSellerReviews(sellerId, Number.MAX_SAFE_INTEGER);
  const summary = getReviewSummary(reviews);

  await setDoc(
    doc(db, "users", sellerId),
    {
      reviewCount: summary.reviewCount,
      ratingSum: summary.ratingSum,
      ratingAverage: summary.average ?? 0,
    },
    { merge: true },
  );
}
