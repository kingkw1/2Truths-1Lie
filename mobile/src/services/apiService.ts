/**
 * Platform-agnostic API service abstraction
 * Prepares for future web API implementation while providing mock data for mobile
 */

import { Platform } from 'react-native';

// Types for your future API implementation
export interface Challenge {
  id: string;
  creatorId: string;
  creatorName: string;
  statements: Statement[];
  mediaData: MediaCapture[];
  isPublic: boolean;
  createdAt: Date;
  lastPlayed?: Date;
  tags?: string[];
  difficultyRating?: number;
  popularityScore?: number;
  totalGuesses?: number;
}

export interface Statement {
  id: string;
  text: string;
  isLie: boolean;
  confidence?: number;
}

export interface MediaCapture {
  type: 'video' | 'audio' | 'text';
  url?: string;
  duration: number;
  fileSize?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

interface APIServiceInterface {
  // Challenge operations (for future web implementation)
  getChallenges(filters?: any): Promise<APIResponse<Challenge[]>>;
  getChallenge(id: string): Promise<APIResponse<Challenge>>;
  createChallenge(challenge: Partial<Challenge>): Promise<APIResponse<Challenge>>;
  updateChallenge(id: string, updates: Partial<Challenge>): Promise<APIResponse<Challenge>>;
  deleteChallenge(id: string): Promise<APIResponse<boolean>>;
  
  // Media operations (for future web implementation)
  uploadMedia(file: Blob | string, metadata: any): Promise<APIResponse<{ url: string }>>;
  deleteMedia(url: string): Promise<APIResponse<boolean>>;
  
  // User operations
  getUserProfile(userId: string): Promise<APIResponse<any>>;
  updateUserProfile(userId: string, updates: any): Promise<APIResponse<any>>;
}

/**
 * Mock API service for current mobile deployment
 * Returns hardcoded data for testing and development
 */
class MockAPIService implements APIServiceInterface {
  private mockChallenges: Challenge[] = [
    {
      id: 'challenge_1',
      creatorId: 'user_1',
      creatorName: 'Alice Johnson',
      statements: [
        { id: 'stmt_1', text: 'I have climbed Mount Everest', isLie: true },
        { id: 'stmt_2', text: 'I can speak 4 languages fluently', isLie: false },
        { id: 'stmt_3', text: 'I once met a famous movie star', isLie: false },
      ],
      mediaData: [
        { type: 'text', duration: 0 },
        { type: 'text', duration: 0 },
        { type: 'text', duration: 0 },
      ],
      isPublic: true,
      createdAt: new Date('2024-01-15'),
      lastPlayed: new Date('2024-01-20'),
      tags: ['travel', 'languages'],
      difficultyRating: 25,
      popularityScore: 87,
      totalGuesses: 45,
    },
    {
      id: 'challenge_2',
      creatorId: 'user_2',
      creatorName: 'Bob Smith',
      statements: [
        { id: 'stmt_4', text: 'I have never broken a bone', isLie: false },
        { id: 'stmt_5', text: 'I can cook 50 different dishes', isLie: true },
        { id: 'stmt_6', text: 'I have a pet parrot', isLie: false },
      ],
      mediaData: [
        { type: 'text', duration: 0 },
        { type: 'text', duration: 0 },
        { type: 'text', duration: 0 },
      ],
      isPublic: true,
      createdAt: new Date('2024-01-18'),
      lastPlayed: new Date('2024-01-22'),
      tags: ['cooking', 'pets'],
      difficultyRating: 45,
      popularityScore: 72,
      totalGuesses: 32,
    },
  ];

  async getChallenges(filters?: any): Promise<APIResponse<Challenge[]>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      data: this.mockChallenges,
      timestamp: new Date(),
    };
  }

  async getChallenge(id: string): Promise<APIResponse<Challenge>> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const challenge = this.mockChallenges.find(c => c.id === id);
    
    if (challenge) {
      return {
        success: true,
        data: challenge,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        error: 'Challenge not found',
        timestamp: new Date(),
      };
    }
  }

  async createChallenge(challenge: Partial<Challenge>): Promise<APIResponse<Challenge>> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newChallenge: Challenge = {
      id: `challenge_${Date.now()}`,
      creatorId: challenge.creatorId || 'unknown',
      creatorName: challenge.creatorName || 'Unknown User',
      statements: challenge.statements || [],
      mediaData: challenge.mediaData || [],
      isPublic: challenge.isPublic !== false,
      createdAt: new Date(),
      tags: challenge.tags || [],
      difficultyRating: 50,
      popularityScore: 0,
      totalGuesses: 0,
    };
    
    this.mockChallenges.push(newChallenge);
    
    return {
      success: true,
      data: newChallenge,
      timestamp: new Date(),
    };
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<APIResponse<Challenge>> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const index = this.mockChallenges.findIndex(c => c.id === id);
    if (index !== -1) {
      this.mockChallenges[index] = { ...this.mockChallenges[index], ...updates };
      return {
        success: true,
        data: this.mockChallenges[index],
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        error: 'Challenge not found',
        timestamp: new Date(),
      };
    }
  }

  async deleteChallenge(id: string): Promise<APIResponse<boolean>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const index = this.mockChallenges.findIndex(c => c.id === id);
    if (index !== -1) {
      this.mockChallenges.splice(index, 1);
      return {
        success: true,
        data: true,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        error: 'Challenge not found',
        timestamp: new Date(),
      };
    }
  }

  async uploadMedia(file: Blob | string, metadata: any): Promise<APIResponse<{ url: string }>> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock successful upload
    const mockUrl = `https://mock-cdn.example.com/media/${Date.now()}`;
    
    return {
      success: true,
      data: { url: mockUrl },
      timestamp: new Date(),
    };
  }

  async deleteMedia(url: string): Promise<APIResponse<boolean>> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      success: true,
      data: true,
      timestamp: new Date(),
    };
  }

  async getUserProfile(userId: string): Promise<APIResponse<any>> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      success: true,
      data: {
        id: userId,
        name: 'Mock User',
        level: 5,
        experience: 1250,
        totalChallenges: 3,
        accuracyRate: 75,
      },
      timestamp: new Date(),
    };
  }

  async updateUserProfile(userId: string, updates: any): Promise<APIResponse<any>> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return {
      success: true,
      data: { id: userId, ...updates },
      timestamp: new Date(),
    };
  }
}

/**
 * Web API service for future implementation
 * Will connect to your actual backend when ready
 */
class WebAPIService implements APIServiceInterface {
  private baseURL: string;
  
  constructor(baseURL: string = 'https://your-api.example.com') {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          data,
          timestamp: new Date(),
        };
      } else {
        return {
          success: false,
          error: data.message || 'API request failed',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date(),
      };
    }
  }

  async getChallenges(filters?: any): Promise<APIResponse<Challenge[]>> {
    const params = filters ? `?${new URLSearchParams(filters)}` : '';
    return this.request<Challenge[]>(`/challenges${params}`);
  }

  async getChallenge(id: string): Promise<APIResponse<Challenge>> {
    return this.request<Challenge>(`/challenges/${id}`);
  }

  async createChallenge(challenge: Partial<Challenge>): Promise<APIResponse<Challenge>> {
    return this.request<Challenge>('/challenges', {
      method: 'POST',
      body: JSON.stringify(challenge),
    });
  }

  async updateChallenge(id: string, updates: Partial<Challenge>): Promise<APIResponse<Challenge>> {
    return this.request<Challenge>(`/challenges/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteChallenge(id: string): Promise<APIResponse<boolean>> {
    return this.request<boolean>(`/challenges/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadMedia(file: Blob | string, metadata: any): Promise<APIResponse<{ url: string }>> {
    // TEMPORARILY DISABLED: FormData usage causing launch issues
    console.warn('⚠️ Media upload temporarily disabled due to FormData issues');
    return {
      success: false,
      error: 'Media upload temporarily disabled - FormData compatibility issues',
      timestamp: new Date()
    };
    
    /*
    const formData = new FormData();
    formData.append('file', file as Blob);
    formData.append('metadata', JSON.stringify(metadata));

    return this.request<{ url: string }>('/media/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    });
    */
  }

  async deleteMedia(url: string): Promise<APIResponse<boolean>> {
    return this.request<boolean>('/media', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    });
  }

  async getUserProfile(userId: string): Promise<APIResponse<any>> {
    return this.request<any>(`/users/${userId}`);
  }

  async updateUserProfile(userId: string, updates: any): Promise<APIResponse<any>> {
    return this.request<any>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
}

// Platform-specific API service instance
const createAPIService = (): APIServiceInterface => {
  // For React Native (current deployment) - use mock data
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return new MockAPIService();
  }
  
  // For web (future implementation) - use real API
  if (Platform.OS === 'web') {
    return new WebAPIService();
  }
  
  // Fallback to mock service
  return new MockAPIService();
};

// Export the API service instance
export const apiService = createAPIService();

// Export classes and types for future use
export { MockAPIService, WebAPIService };
export type { APIServiceInterface };
