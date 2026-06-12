interface VerificationResult {
  verified: boolean;
  name: string;
  dateOfBirth: string;
  idType: string;
  idNumber: string;
  expiryDate?: string;
  error?: string;
}

/**
 * Verifies government ID with Verihubs PhilSys Verification API
 * 
 * TODO: Configure your Verihubs API credentials:
 * 1. Get your API key from https://www.verihubs.com
 * 2. Set VERIHUBS_API_KEY in your .env file
 * 3. Update the API endpoint if needed
 */

// IMPORTANT: Never call third-party identity providers directly from the client.
// This app used EXPO_PUBLIC_VERIHUBS_API_KEY (client-side) which can leak.
// The safe approach is to proxy verification through your own backend.
// For now we fail closed (block verification) unless you wire a backend endpoint.

// Intentionally unused on the client (backend holds Verihubs secret).
// Keeping EXPO_PUBLIC_VERIHUBS_API_KEY out of the client request path avoids leaking it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _VERIHUBS_API_KEY = process.env.EXPO_PUBLIC_VERIHUBS_API_KEY;

const VERIHUBS_VERIFY_BACKEND_URL = process.env.EXPO_PUBLIC_VERIHUBS_VERIFY_BACKEND_URL;
// const VERIHUBS_API_URL = 'https://api.verihubs.com/v1/identity/philsys';

export const verifyIDWithVerihubs = async (
  frontImageUri: string,
  backImageUri: string
): Promise<VerificationResult> => {
  try {
    // Fail closed unless a backend proxy URL is configured.
    // (A client-side API key would be exposed to every app user.)
    if (!VERIHUBS_VERIFY_BACKEND_URL) {
      return {
        verified: false,
        name: '',
        dateOfBirth: '',
        idType: '',
        idNumber: '',
        error: 'Verification unavailable (backend proxy not configured).',
      };
    }


    // Prepare the request payload
    const formData = new FormData();
    formData.append('document_front', {
      uri: frontImageUri,
      type: 'image/jpeg',
      name: 'id_front.jpg',
    } as any);
    formData.append('document_back', {
      uri: backImageUri,
      type: 'image/jpeg',
      name: 'id_back.jpg',
    } as any);

    // Call your backend proxy endpoint.
    // Backend should perform the Verihubs request securely using a server-side secret.
    const response = await fetch(VERIHUBS_VERIFY_BACKEND_URL, {
      method: 'POST',
      headers: {
        // Content-Type is set automatically for FormData by fetch in React Native.
        Accept: 'application/json',
      },
      body: formData,
    });


    if (!response.ok) {
      throw new Error(`Verihubs API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse the Verihubs response
    if (data.data?.validation === 'success' && data.data?.person_data) {
      const personData = data.data.person_data;
      return {
        verified: true,
        name: personData.fullname || 'Unknown',
        dateOfBirth: personData.date_of_birth || '',
        idType: personData.id_type || 'Government ID',
        idNumber: personData.id_number || '',
        expiryDate: personData.expiry_date,
      };
    }

    return {
      verified: false,
      name: '',
      dateOfBirth: '',
      idType: '',
      idNumber: '',
      error: data.data?.validation_message || 'Verification failed',
    };
  } catch (error) {
    console.error('Verihubs verification error:', error);
    return {
      verified: false,
      name: '',
      dateOfBirth: '',
      idType: '',
      idNumber: '',
      error: error instanceof Error ? error.message : 'An error occurred during verification',
    };
  }
};

/**
 * Mock verification for development/testing
 * Replace with real API calls once credentials are configured
 */
// Removed mock verification to avoid accidentally shipping a bypass.
// If you need a dev-only bypass, implement it server-side behind auth/feature-flag.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockVerification = (): VerificationResult => {
  return {
    verified: false,
    name: '',
    dateOfBirth: '',
    idType: '',
    idNumber: '',
    error: 'Mock verification disabled for security.',
  };
};


/**
 * Extract QR code data from ID image (optional utility)
 * This can be used if you implement barcode scanning
 */
export const extractQRCodeData = async (_imageUri: string): Promise<string | null> => {
  // TODO: Implement QR code extraction using expo-barcode-scanner or similar.
  return null;
};
