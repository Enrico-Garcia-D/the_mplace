# TODO - Security/API leak cleanup (local_buynsell_app)

- [ ] Step 1: Remove client-side verihubs API key usage (move to backend/proxy or fail closed) in `services/verificationService.ts`.
- [ ] Step 2: Remove/fix Gemini moderation reliability (avoid fail-open) in `services/moderationService.ts`.
- [ ] Step 3: Remove sensitive push payload fields (minimize messageText / IDs) in `services/notificationService.ts`.
- [x] Step 4: Remove dev logging of notification payload in `app/_layout.tsx`.
- [ ] Step 5: Ensure `.env.example` documents non-EXPO_PUBLIC secrets usage and no secrets committed.
- [ ] Step 6: Run lint/typecheck/tests for the Expo project (if available).


