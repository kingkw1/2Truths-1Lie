/**
 * Blob URL Management Utility
 * Provides centralized management of blob URLs to prevent memory leaks
 */

interface BlobUrlEntry {
  url: string;
  blob: Blob;
  createdAt: number;
  lastAccessed: number;
}

class BlobUrlManager {
  private urls = new Map<string, BlobUrlEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create a blob URL and track it for cleanup
   */
  createUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    const now = Date.now();
    
    this.urls.set(url, {
      url,
      blob,
      createdAt: now,
      lastAccessed: now,
    });

    return url;
  }

  /**
   * Revoke a blob URL and remove it from tracking
   */
  revokeUrl(url: string): void {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
  }

  /**
   * Update last accessed time for a URL
   */
  accessUrl(url: string): void {
    const entry = this.urls.get(url);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /**
   * Get blob for a URL (if still valid)
   */
  getBlob(url: string): Blob | null {
    const entry = this.urls.get(url);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.blob;
    }
    return null;
  }

  /**
   * Check if a URL is still valid
   */
  isValidUrl(url: string): boolean {
    return this.urls.has(url);
  }

  /**
   * Clean up old URLs
   */
  private cleanup(): void {
    const now = Date.now();
    const toRevoke: string[] = [];

    for (const [url, entry] of this.urls.entries()) {
      if (now - entry.lastAccessed > this.MAX_AGE) {
        toRevoke.push(url);
      }
    }

    toRevoke.forEach(url => this.revokeUrl(url));

    if (toRevoke.length > 0) {
      console.log(`BlobUrlManager: Cleaned up ${toRevoke.length} expired URLs`);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop cleanup timer and revoke all URLs
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Revoke all remaining URLs
    for (const url of this.urls.keys()) {
      URL.revokeObjectURL(url);
    }
    
    this.urls.clear();
  }

  /**
   * Get statistics about managed URLs
   */
  getStats(): { total: number; oldestAge: number; newestAge: number } {
    const now = Date.now();
    let oldestAge = 0;
    let newestAge = 0;

    for (const entry of this.urls.values()) {
      const age = now - entry.createdAt;
      if (oldestAge === 0 || age > oldestAge) {
        oldestAge = age;
      }
      if (newestAge === 0 || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      total: this.urls.size,
      oldestAge,
      newestAge,
    };
  }
}

// Global instance
export const blobUrlManager = new BlobUrlManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    blobUrlManager.dispose();
  });
}

export default BlobUrlManager;