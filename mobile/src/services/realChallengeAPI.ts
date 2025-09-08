/**
 * Real Challenge API Service
 * Connects to the backend challenge endpoints for real challenge creation and management
 */

import { Platform } from 'react-native';
import { authService } from './authService';

export interface Challenge {
  challenge_id: string;
  creator_id: string;
  title?: string;
  statements: Statement[];
  lie_statement_id: string;
  status: string;
  difficulty_level?: string;
  tags?: string[];
  is_merged_video?: boolean;
  merged_video_metadata?: any;
  created_at: string;
  updated_at: string;
  published_at?: string;
  view_count: number;
  guess_count: number;
  correct_guess_count: number;
  // Computed fields for compatibility
  id?: string;
  creator_name?: string;
  mediaData?: MediaCapture[];
  is_public?: boolean;
  difficulty_rating?: number;
  popularity_score?: number;
  total_guesses?: number;
}

export interface Statement {
  statement_id: string;
  statement_type: 'truth' | 'lie';
  media_url: string;
  media_file_id: string;
  streaming_url?: string;
  cloud_storage_key?: string;
  storage_type?: string;
  duration_seconds: number;
  segment_start_time?: number;
  segment_end_time?: number;
  segment_duration?: number;
  segment_metadata?: any;
  created_at: string;
  // Computed fields for compatibility
  text?: string;
  is_lie?: boolean;
  media_id?: string;
}

export interface MediaCapture {
  type: 'video' | 'audio' | 'text';
  url?: string;
  streamingUrl?: string;
  duration: number;
  fileSize?: number;
  mediaId?: string;
  cloudStorageKey?: string;
  storageType?: 'local' | 'cloud';
  isUploaded?: boolean;
  compressionRatio?: number;
  uploadTime?: number;
}

export interface CreateChallengeRequest {
  statements: Array<{
    text: string;
    media_file_id: string;
    segment_start_time?: number;
    segment_end_time?: number;
    segment_duration?: number;
  }>;
  lie_statement_index: number;
  tags?: string[];
  is_merged_video?: boolean;
  merged_video_metadata?: {
    total_duration: number; // Changed from total_duration_ms to match backend
    segments: Array<{
      statement_index: number;
      start_time: number; // Changed from start_time_ms to match backend
      end_time: number; // Changed from end_time_ms to match backend
      duration: number; // Changed from duration_ms to match backend
    }>;
    video_file_id: string;
    compression_applied?: boolean;
    original_total_duration?: number;
  };
  // Server-side merged video fields
  merged_video_url?: string;
  merged_video_file_id?: string;
  merge_session_id?: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export class RealChallengeAPIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = this.getApiBaseUrl();
  }

  private getApiBaseUrl(): string {
    // Force development mode for local testing
    // if (__DEV__) {
      // Development mode - use local backend
      if (Platform.OS === 'android') {
        return 'http://192.168.50.111:8001'; // Your local development IP
      } else {
        return 'http://localhost:8001';
      }
    // } else {
    //   // Production mode - use your production API
    //   return 'https://your-production-api.com';
    // }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = authService.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'User-Agent': 'TwoTruthsLie-Mobile/1.0',
    };
  }

  async createChallenge(request: CreateChallengeRequest): Promise<APIResponse<Challenge>> {
    try {
      console.log('🎯 API: ==================== CREATE CHALLENGE API CALL ====================');
      console.log('🎯 API: Time:', new Date().toISOString());
      console.log('🎯 API: Platform:', Platform.OS);
      console.log('🎯 API: Base URL:', this.baseUrl);
      console.log('🎯 API: Request has statements:', !!request.statements);
      console.log('🎯 API: Request statements count:', request.statements?.length);
      console.log('🎯 API: Request is_merged_video:', request.is_merged_video);
      console.log('🎯 API: Request JSON size:', JSON.stringify(request).length, 'characters');
      
      if (request.statements) {
        console.log('🎯 API: Statements count:', request.statements.length);
        request.statements.forEach((stmt, idx) => {
          console.log(`🎯 API: Statement ${idx}:`, {
            text: stmt.text,
            media_file_id: stmt.media_file_id,
            hasSegmentData: !!(stmt.segment_start_time !== undefined),
          });
        });
      }
      
      console.log('🎯 API: About to connect to endpoint...');
      console.log('🎯 API: Full URL:', `${this.baseUrl}/api/v1/test/challenge`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('🚨 API: ⏰ REQUEST TIMEOUT! - Aborting fetch after 15 seconds');
        controller.abort();
      }, 15000); // 15 second timeout

      console.log('🎯 API: Creating AbortController and starting fetch...');
      console.log('🎯 API: Timeout set for 15 seconds');

      try {
        console.log('🎯 API: 🚀 STARTING FETCH REQUEST...');
        console.log('🎯 API: Method: POST');
        console.log('🎯 API: Headers: Content-Type: application/json');
        console.log('🎯 API: Body length:', JSON.stringify(request).length);
        
        const startTime = Date.now();
        
        // Use test endpoint for development (bypasses auth)
        const response = await fetch(`${this.baseUrl}/api/v1/test/challenge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        clearTimeout(timeoutId);
        console.log('🎯 API: ✅ FETCH COMPLETED!');
        console.log('🎯 API: Request duration:', duration, 'ms');
        console.log('🎯 API: Response received, checking status...');

        console.log('🎯 API: Response status:', response.status);
        console.log('🎯 API: Response ok:', response.ok);
        console.log('🎯 API: Response statusText:', response.statusText);
        console.log('🎯 API: Response headers:', response.headers);

        if (!response.ok) {
          console.error('❌ API: Response not OK! Status:', response.status);
          
          let errorText;
          try {
            errorText = await response.text();
            console.error('❌ API: Error response body:', errorText);
          } catch (textError) {
            console.error('❌ API: Failed to read error response body:', textError);
            errorText = 'Unknown error - could not read response';
          }
          
          console.error('❌ API: Throwing error for bad status');
          throw new Error(`Challenge creation failed: ${response.status} ${errorText}`);
        }

        console.log('🎯 API: Status OK, parsing JSON response...');
        
        let challenge;
        try {
          challenge = await response.json();
          console.log('✅ API: JSON parsed successfully');
          console.log('✅ API: Response data type:', typeof challenge);
          console.log('✅ API: Response has id:', !!(challenge?.id || challenge?.challenge_id));
        } catch (jsonError) {
          console.error('❌ API: Failed to parse JSON response:', jsonError);
          throw new Error('Invalid JSON response from server');
        }

        console.log('✅ API: Challenge created successfully!');
        console.log('✅ API: Challenge ID:', challenge?.id || challenge?.challenge_id || 'NO_ID');

        return {
          success: true,
          data: challenge,
          timestamp: new Date(),
        };

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('🚨🚨🚨 API: FETCH ERROR CAUGHT! 🚨🚨🚨');
        console.error('🚨 API: Error type:', typeof fetchError);
        console.error('🚨 API: Error name:', fetchError?.name);
        console.error('🚨 API: Error message:', fetchError?.message);
        console.error('🚨 API: Error stack:', fetchError?.stack);
        console.error('🚨 API: Full fetch error:', JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError), 2));
        
        if (fetchError.name === 'AbortError') {
          console.error('🚨 API: Request was aborted due to timeout');
          throw new Error('Request timeout - backend not responding');
        }
        
        if (fetchError.message?.includes('Network request failed')) {
          console.error('🚨 API: Network request failed - possibly no connection to backend');
        }
        
        throw fetchError;
      }

    } catch (error: any) {
      console.error('🚨🚨🚨 API: TOP-LEVEL ERROR CAUGHT! 🚨🚨🚨');
      console.error('🚨 API: Error in createChallenge method');
      console.error('🚨 API: Error type:', typeof error);
      console.error('🚨 API: Error name:', error?.name);
      console.error('🚨 API: Error message:', error?.message);
      console.error('🚨 API: Error stack:', error?.stack);
      console.error('🚨 API: Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      return {
        success: false,
        error: error.message || 'Failed to create challenge',
        timestamp: new Date(),
      };
    }
  }

  async getChallenge(id: string): Promise<APIResponse<Challenge>> {
    try {
      console.log('🎯 CHALLENGE: Fetching challenge:', id);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/v1/challenges/${id}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to get challenge: ${response.status} ${errorText}`);
      }

      const challenge = await response.json();
      console.log('✅ CHALLENGE: Retrieved successfully:', challenge.id);

      return {
        success: true,
        data: challenge,
        timestamp: new Date(),
      };

    } catch (error: any) {
      console.error('❌ CHALLENGE: Error getting challenge:', error);
      return {
        success: false,
        error: error.message || 'Failed to get challenge',
        timestamp: new Date(),
      };
    }
  }

  async getChallenges(skip: number = 0, limit: number = 20): Promise<APIResponse<Challenge[]>> {
    try {
      console.log('🎯 CHALLENGE: Fetching challenges list...');

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/v1/challenges/?skip=${skip}&limit=${limit}&public_only=true`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to get challenges: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();
      console.log('🎯 CHALLENGE: Raw response: [HIDDEN]');

      // Handle the paginated response format from backend
      const challenges = responseData.challenges || responseData;
      console.log(`✅ CHALLENGE: Retrieved ${challenges.length} challenges`);

      return {
        success: true,
        data: challenges,
        timestamp: new Date(),
      };

    } catch (error: any) {
      console.error('❌ CHALLENGE: Error getting challenges:', error);
      return {
        success: false,
        error: error.message || 'Failed to get challenges',
        timestamp: new Date(),
      };
    }
  }

  async submitGuess(challengeId: string, guessedStatementId: string): Promise<APIResponse<any>> {
    try {
      console.log('🎯 CHALLENGE: Submitting guess for challenge:', challengeId);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/v1/challenges/${challengeId}/guess`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guessed_lie_statement_id: guessedStatementId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to submit guess: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ CHALLENGE: Guess submitted:', result);

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error: any) {
      console.error('❌ CHALLENGE: Error submitting guess:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit guess',
        timestamp: new Date(),
      };
    }
  }

  async deleteChallenge(challengeId: string): Promise<APIResponse<boolean>> {
    try {
      console.log('🎯 CHALLENGE: Deleting challenge:', challengeId);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/v1/challenges/${challengeId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to delete challenge: ${response.status} ${errorText}`);
      }

      console.log('✅ CHALLENGE: Deleted successfully');

      return {
        success: true,
        data: true,
        timestamp: new Date(),
      };

    } catch (error: any) {
      console.error('❌ CHALLENGE: Error deleting challenge:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete challenge',
        timestamp: new Date(),
      };
    }
  }
}

// Create singleton instance
export const realChallengeAPI = new RealChallengeAPIService();
