# Gemini AI setup (M-Place)

## 1) Add your key locally (safe for your machine)
Create a local env file in this repo:

- `.env.local` (recommended) or `.env`

Example (copy values from your Gemini provider / Google AI Studio):

```bash
EXPO_PUBLIC_GEMINI_API_KEY=YOUR_KEY_HERE
```

### Important security note
Because the current implementation reads `EXPO_PUBLIC_GEMINI_API_KEY` in the client bundle, **the key is not secret** in production. 
For production, you should proxy Gemini requests through your backend.

## 2) Run the app
```bash
npm start
```

## 3) Test
Open a chat screen and tap the ✨ (sparkles) button.

## 4) Production-secure approach (recommended)
Move Gemini calls into a server endpoint (Cloud Functions / Express / Cloud Run / etc.) that:
- stores the Gemini key in server-side secrets
- receives a user prompt + chat context
- returns the generated reply

Then update the app to call that backend endpoint instead of `generativelanguage.googleapis.com` directly.

