/**
 * Real Challenge API Service
 * Connects to the backend challenge endpoints for real challenge creation and management
 */

import { Platform } from 'react-native';
import { authService } from './authService';

export interface Challenge {
  id: string;
  creator_id: string;
  creator_name: string;
  statements: Statement[];
  mediaData: MediaCapture[];
  is_public: boolean;
  created_at: string;
  tags?: string[];
  difficulty_rating?: number;
  popularity_score?: number;
  total_guesses?: number;
}

export interface Statement {
  statement_id: string;
  text: string;
  is_lie: boolean;
  media_id?: string;
  media_url?: string;
  duration_seconds?: number;
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
  }>;
  lie_statement_index: number;
  tags?: string[];
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
      console.log('🎯 CHALLENGE: Creating challenge with backend...');
      console.log('🎯 CHALLENGE: Request:', JSON.stringify(request, null, 2));
      console.log('🎯 CHALLENGE: Attempting to connect to:', `${this.baseUrl}/api/v1/test/challenge`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('🚨 CHALLENGE: Request timeout - aborting fetch');
        controller.abort();
      }, 15000); // 15 second timeout

      try {
        console.log('🎯 CHALLENGE: Starting fetch request...');
        // Temporarily use test endpoint to bypass auth issues
        const response = await fetch(`${this.baseUrl}/api/v1/test/challenge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('🎯 CHALLENGE: Fetch completed, got response');

        console.log('🎯 CHALLENGE: Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('❌ CHALLENGE: Create failed:', response.status, errorText);
          throw new Error(`Challenge creation failed: ${response.status} ${errorText}`);
        }

        const challenge = await response.json();
        console.log('✅ CHALLENGE: Created successfully:', challenge);

        return {
          success: true,
          data: challenge,
          timestamp: new Date(),
        };

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('🚨 CHALLENGE: Fetch error:', fetchError);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - backend not responding');
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error('❌ CHALLENGE: Error creating challenge:', error);
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
      const response = await fetch(`${this.baseUrl}/api/v1/challenges/?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to get challenges: ${response.status} ${errorText}`);
      }

      const challenges = await response.json();
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
