export interface ProfileData {
  username: string;
  displayName: string;
  profileImageUrl: string;
  profileUrl: string;
  extractedAt: Date;
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

export interface QRCodeOptions {
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
}

export interface NameTagData {
  profileData: ProfileData;
  profileImage: ProcessedImage;
  qrCode: Buffer;
}

export interface NameTagConfig {
  dimensions: {
    width: number;
    height: number;
  };
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fonts: {
    displayName: FontConfig;
    username: FontConfig;
  };
  colors: {
    background: string;
    text: string;
    accent: string;
  };
}

export interface FontConfig {
  size: number;
  family: string;
  weight?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
}