export type IdQualityAssessment = {
  /** Always true for the prototype if both sides were provided */
  ok: boolean;
  /** For prototype we treat it as best-effort readability/presence, not authenticity */
  quality: "low" | "medium" | "high";
  /** Human-readable reasons to help manual reviewers */
  reasons: string[];
  /** Optional extracted hints (no real OCR yet in this prototype) */
  hints?: {
    possibleIdType?: string;
    issues?: string[];
  };
};

const reasonIf = (condition: boolean, reason: string, reasons: string[]) => {
  if (condition) reasons.push(reason);
};

/**
 * Best-effort "presence/readability" assessment for prototyping.
 *
 * Important: This does NOT verify authenticity and must NOT set users to verified.
 * It only helps decide whether the upload looks complete/usable for review.
 */
export async function assessIdQuality(
  frontImageUri: string,
  backImageUri: string,
): Promise<IdQualityAssessment> {
  const reasons: string[] = [];

  // Minimal checks: in this prototype we only know URIs are present.
  // If you later want real image analysis, move this behind an image-capable backend.
  reasonIf(!frontImageUri || frontImageUri.trim().length === 0, "Front image missing.", reasons);
  reasonIf(!backImageUri || backImageUri.trim().length === 0, "Back image missing.", reasons);

  // Heuristic: some URIs may be extremely short/placeholder-like.
  reasonIf(frontImageUri.length < 8, "Front image URI seems unusually short.", reasons);
  reasonIf(backImageUri.length < 8, "Back image URI seems unusually short.", reasons);

  // Heuristic: if either side contains the word 'content' or 'file', treat as real URI.
  // If it contains neither, it's suspicious.
  reasonIf(
    !/^(file:|content:)/i.test(frontImageUri),
    "Front image URI format is unexpected.",
    reasons,
  );
  reasonIf(
    !/^(file:|content:)/i.test(backImageUri),
    "Back image URI format is unexpected.",
    reasons,
  );

  const missingOrBad = reasons.length > 0;

  // Quality scoring: if we only have format-ish issues, call medium; if missing, call low.
  let quality: IdQualityAssessment["quality"] = "high";
  if (missingOrBad) {
    const isMissing = reasons.some((r) => r.toLowerCase().includes("missing"));
    quality = isMissing ? "low" : "medium";
  }

  // In this prototype, ok means both sides were provided (even if medium/low quality).
  // Manual reviewers still get the reasons.
  const ok = !reasons.some((r) => r.toLowerCase().includes("missing"));

  const issues = quality === "low" ? reasons : reasons.slice(0, 3);

  return {
    ok,
    quality,
    reasons,
    hints: {
      // possibleIdType intentionally omitted in this prototype (no OCR yet)
      issues,
    },
  };
}
