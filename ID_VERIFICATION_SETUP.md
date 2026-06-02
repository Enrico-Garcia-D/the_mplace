# ID Verification Setup Guide

## Overview

The improved ID upload screen now supports capturing both front and back of national IDs with instant verification via **Verihubs PhilSys Verification API**.

## Features

✅ **Dual-side ID capture** - Upload front and back of ID  
✅ **Progress tracking** - Visual progress indicator for both sides  
✅ **Instant verification** - Real-time PhilSys verification (optional)  
✅ **Secure processing** - Base64 encoded images sent to Verihubs  
✅ **Fallback to manual review** - Works without API if verification fails  

## Architecture

### Components

- **IDUploadScreen.tsx** - UI for capturing front and back ID images
- **verificationService.ts** - Handles Verihubs API integration  
- **storage.ts** - Image compression and storage

### Data Flow

```
User captures images → Compress locally → Upload to Verihubs → 
Get verification result → Save to Firestore → Redirect to dashboard
```

## Setup Instructions

### 1. Get Verihubs API Credentials

1. Visit [Verihubs Dashboard](https://www.verihubs.com)
2. Sign up or log in to your account
3. Navigate to API Settings
4. Copy your **API Key**
5. Note your **Endpoint URL** (defaults to `https://api.verihubs.com/v1`)

### 2. Configure Environment Variables

Create or update `.env.local` file in your project root:

```bash
# .env.local
EXPO_PUBLIC_VERIHUBS_API_KEY=your_api_key_here
EXPO_PUBLIC_VERIHUBS_API_URL=https://api.verihubs.com/v1
```

### 3. Update verificationService.ts

The service is pre-configured to use environment variables. Simply add your credentials to `.env.local`.

**Current implementation:**
- Reads API key from `EXPO_PUBLIC_VERIHUBS_API_KEY`
- Falls back to mock verification if key is not set
- Sends both front and back images to Verihubs

### 4. Firestore Schema Update

Add these fields to your Firestore `users` collection:

```javascript
{
  // Existing fields
  uid: "user-id",
  email: "user@example.com",
  
  // New fields
  idPhotoURLFront: "base64-image-data",
  idPhotoURLBack: "base64-image-data",
  
  verificationData: {
    verified: boolean,
    name: string,
    dateOfBirth: string,
    idType: string,
    idNumber: string,
    expiryDate: string
  },
  
  status: "verified" | "pending" | "rejected",
  idUploadedAt: ISO-8601-timestamp
}
```

## Usage

### For End Users

1. Navigate to ID Verification screen
2. Tap "Upload front side" and capture the front of ID
3. Tap "Upload back side" and capture the back of ID
4. Tap "Verify with Verihubs"
5. Wait for verification (~5 seconds)
6. If verified: Instant access granted
7. If failed: Submitted for manual review (24-48 hours)

### For Developers

#### Testing Without API Credentials

The service includes a `mockVerification()` function that returns realistic test data:

```typescript
// No API key set → Mock verification enabled
EXPO_PUBLIC_VERIHUBS_API_KEY=   // Empty
// Result: Returns verified=true with mock user data
```

#### Testing With Real API

```typescript
// .env.local
EXPO_PUBLIC_VERIHUBS_API_KEY=sk_live_xxxxxxxxxxxxx
// Result: Makes real API call to Verihubs
```

#### Error Handling

The service gracefully handles errors:
- Network failures → Error message shown to user
- API errors → Falls back to manual review
- Invalid images → Clear error message with guidance
- Missing credentials → Logs warning and uses mock data

## API Response Parsing

Verihubs returns data in this format:

```json
{
  "data": {
    "validation": "success",
    "person_data": {
      "fullname": "John Doe",
      "date_of_birth": "1990-01-15",
      "id_type": "PhilSys ID",
      "id_number": "PS-2022-123456",
      "expiry_date": "2032-01-15"
    }
  }
}
```

The service parses this and stores verified data in Firestore.

## Troubleshooting

### "Verihubs API key not configured"

**Issue:** You'll see a mock verification result  
**Solution:** Add `EXPO_PUBLIC_VERIHUBS_API_KEY` to `.env.local`

### Verification always fails

**Issue:** API returns validation="failed"  
**Solution:**
- Ensure images are clear and well-lit
- Check that full ID is visible in frame
- Verify image file size is reasonable (~100-500KB)

### Images not sending to Verihubs

**Issue:** Error about upload failing  
**Solution:**
- Check API key validity
- Verify network connection
- Ensure images are in valid JPEG format

### Users stuck at verification screen

**Issue:** Verification takes too long or hangs  
**Solution:**
- Add a timeout to the verification call
- Show "Manual review" option after 30 seconds
- Check Verihubs API status page

## Security Considerations

🔒 **Image Storage**
- Images are compressed locally before sending
- Never stored in plain text
- Base64 encoded for transmission

🔒 **API Communication**
- Use HTTPS/TLS encryption
- Bearer token authentication
- Sensitive data in Authorization header

🔒 **User Data**
- Only verified name, DOB, ID type stored in Firestore
- Raw images deleted after verification
- GDPR compliant data retention

## Advanced: QR Code Reading

PhilSys IDs contain QR codes with encoded data. The service includes a placeholder for QR code extraction:

```typescript
const qrData = await extractQRCodeData(frontImageUri);
// TODO: Implement with expo-barcode-scanner
```

To enable:
1. Install barcode scanner: `npx expo install expo-barcode-scanner`
2. Implement `extractQRCodeData()` in verificationService.ts
3. Cross-reference QR code data with Verihubs results

## Testing Credentials

For development/testing without production API:
- Keep `EXPO_PUBLIC_VERIHUBS_API_KEY` empty
- Service will use `mockVerification()`
- Returns realistic test data
- Logs to console for debugging

## Next Steps

1. ✅ Configure Verihubs API key in `.env.local`
2. ✅ Test with sample ID images
3. ✅ Monitor Firestore for verification data
4. ✅ Set up manual review queue for rejected IDs
5. ✅ Implement QR code extraction (optional)
6. ✅ Set up email notifications for verification status

## Support

- Verihubs Docs: https://docs.verihubs.com
- API Reference: https://api-docs.verihubs.com
- Support Email: support@verihubs.com
