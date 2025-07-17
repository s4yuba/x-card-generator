// X Profile Data Types
export interface XProfile {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl: string;
  profileUrl: string;
  verified: boolean;
  followerCount: string;
  followingCount: string;
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

// Name Tag Template Types
export interface NameTagTemplate {
  id: string;
  name: string;
  dimensions: {
    width: number;
    height: number;
  };
  layout: {
    avatarPosition: Position;
    avatarSize: number;
    namePosition: Position;
    usernamePosition: Position;
    qrCodePosition: Position;
    qrCodeSize: number;
  };
  styles: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
    nameFontSize: number;
    usernameFontSize: number;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
  };
}

export interface Position {
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
}

export interface FontConfig {
  size: number;
  family: string;
  weight?: string;
}

// Application Settings
export interface AppSettings {
  autoDownload: boolean;
  downloadFormat: 'pdf' | 'png';
  pdfQuality: 'low' | 'medium' | 'high';
  defaultTemplate: string;
  recentProfiles: string[];
  maxRecentProfiles: number;
}

// Error Handling Types
export enum ErrorCode {
  INVALID_URL = 'INVALID_URL',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PARSING_ERROR = 'PARSING_ERROR',
  GENERATION_ERROR = 'GENERATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface APIError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

// Service Response Types
export interface ProfileFetchResult {
  profile: XProfile;
  fromCache?: boolean;
}

export interface BatchProfileResult {
  successful: ProfileFetchResult[];
  failed: Array<{
    url: string;
    error: APIError;
  }>;
}

// Legacy types for backward compatibility
export interface ProfileData {
  username: string;
  displayName: string;
  profileImageUrl: string;
  profileUrl: string;
  extractedAt: Date;
}