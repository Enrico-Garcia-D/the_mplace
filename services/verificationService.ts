import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

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

const VERIHUBS_API_KEY = process.env.EXPO_PUBLIC_VERIHUBS_API_KEY;
const VERIHUBS_API_URL = 'https://api.verihubs.com/v1/identity/philsys';

export const verifyIDWithVerihubs = async (
  frontImageUri: string,
  backImageUri: string
): Promise<VerificationResult> => {
  try {
    // TODO: Remove this fallback once you have real API credentials
    if (!VERIHUBS_API_KEY) {
      console.warn('Verihubs API key not configured. Using mock verification.');
      return mockVerification();
    }

    // Compress and convert images to base64
    const frontBase64 = await compressImageToBase64(frontImageUri);
    const backBase64 = await compressImageToBase64(backImageUri);

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

    // Call Verihubs API
    const response = await fetch(VERIHUBS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERIHUBS_API_KEY}`,
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
const mockVerification = (): VerificationResult => {
  return {
    verified: true,
    name: 'John Doe',
    dateOfBirth: '1990-01-15',
    idType: 'PhilSys ID',
    idNumber: 'PS-2022-123456',
    expiryDate: '2032-01-15',
  };
};

/**
 * Compress image and convert to base64
 */
const compressImageToBase64 = async (imageUri: string): Promise<string> => {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return base64;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
};

/**
 * Extract QR code data from ID image (optional utility)
 * This can be used if you implement barcode scanning
 */
export const extractQRCodeData = async (imageUri: string): Promise<string | null> => {
  try {
    // TODO: Implement QR code extraction using expo-barcode-scanner or similar
    // For now, this is a placeholder
    return null;
  } catch (error) {
    console.error('Error extracting QR code:', error);
    return null;
  }
};
