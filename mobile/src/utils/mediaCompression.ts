/**
 * Client-side Media Compression Pipeline
 * Compresses video and audio files before upload to reduce bandwidth and storage costs
 * Supports multiple compression levels and quality settings
 */

export interface CompressionOptions {
  quality?: number; // 0.1 to 1.0, default 0.8
  maxWidth?: number; // For video, default 640
  maxHeight?: number; // For video, default 480
  maxFileSize?: number; // In bytes, default 5MB
  format?: 'webm' | 'mp4'; // Output format
  audioBitrate?: number; // In kbps, default 128
  videoBitrate?: number; // In kbps, default 1000
}

export interface CompressionResult {
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
  quality: number;
}

export interface CompressionProgress {
  stage: 'analyzing' | 'compressing' | 'finalizing';
  progress: number; // 0 to 100
  estimatedTimeRemaining?: number; // in milliseconds
}

export class MediaCompressor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Compress a media blob (video or audio)
   */
  async compressMedia(
    blob: Blob,
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalSize = blob.size;

    // Default options
    const opts: Required<CompressionOptions> = {
      quality: options.quality ?? 0.8,
      maxWidth: options.maxWidth ?? 640,
      maxHeight: options.maxHeight ?? 480,
      maxFileSize: options.maxFileSize ?? 5 * 1024 * 1024, // 5MB
      format: options.format ?? 'webm',
      audioBitrate: options.audioBitrate ?? 128,
      videoBitrate: options.videoBitrate ?? 1000,
    };

    onProgress?.({
      stage: 'analyzing',
      progress: 10,
    });

    let compressedBlob: Blob;

    if (blob.type.startsWith('video/')) {
      compressedBlob = await this.compressVideo(blob, opts, onProgress);
    } else if (blob.type.startsWith('audio/')) {
      compressedBlob = await this.compressAudio(blob, opts, onProgress);
    } else {
      throw new Error(`Unsupported media type: ${blob.type}`);
    }

    const processingTime = Date.now() - startTime;
    const compressedSize = compressedBlob.size;
    const compressionRatio = originalSize / compressedSize;

    onProgress?.({
      stage: 'finalizing',
      progress: 100,
    });

    return {
      compressedBlob,
      originalSize,
      compressedSize,
      compressionRatio,
      processingTime,
      quality: opts.quality,
    };
  }

  /**
   * Compress video using canvas and MediaRecorder
   */
  private async compressVideo(
    blob: Blob,
    options: Required<CompressionOptions>,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        try {
          // Calculate dimensions maintaining aspect ratio
          const { width, height } = this.calculateDimensions(
            video.videoWidth,
            video.videoHeight,
            options.maxWidth,
            options.maxHeight
          );

          this.canvas.width = width;
          this.canvas.height = height;

          onProgress?.({
            stage: 'compressing',
            progress: 30,
          });

          // Create MediaRecorder for compression
          const stream = this.canvas.captureStream(30); // 30 FPS
          
          // Add audio track if present
          video.onloadstart = async () => {
            try {
              const audioContext = new AudioContext();
              const source = audioContext.createMediaElementSource(video);
              const destination = audioContext.createMediaStreamDestination();
              source.connect(destination);
              
              // Add audio tracks to stream
              destination.stream.getAudioTracks().forEach(track => {
                stream.addTrack(track);
              });
            } catch (error) {
              console.warn('Could not add audio track:', error);
            }
          };

          const mimeType = this.getSupportedMimeType(options.format);
          const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: options.videoBitrate * 1000,
            audioBitsPerSecond: options.audioBitrate * 1000,
          });

          const chunks: Blob[] = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          recorder.onstop = () => {
            const compressedBlob = new Blob(chunks, { type: mimeType });
            resolve(compressedBlob);
          };

          recorder.onerror = (event) => {
            reject(new Error(`Recording failed: ${event}`));
          };

          // Start recording
          recorder.start(100);

          // Draw video frames to canvas
          let frameCount = 0;
          const totalFrames = Math.ceil(video.duration * 30); // Estimate

          const drawFrame = () => {
            if (video.ended || video.paused) {
              recorder.stop();
              return;
            }

            this.ctx.drawImage(video, 0, 0, width, height);
            frameCount++;

            const progress = Math.min(30 + (frameCount / totalFrames) * 60, 90);
            onProgress?.({
              stage: 'compressing',
              progress,
            });

            requestAnimationFrame(drawFrame);
          };

          video.onplay = () => {
            drawFrame();
          };

          video.play();
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Compress audio using Web Audio API
   */
  private async compressAudio(
    blob: Blob,
    options: Required<CompressionOptions>,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      
      audio.onloadedmetadata = async () => {
        try {
          onProgress?.({
            stage: 'compressing',
            progress: 40,
          });

          // Create audio context for processing
          if (!this.audioContext) {
            this.audioContext = new AudioContext();
          }

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

          onProgress?.({
            stage: 'compressing',
            progress: 60,
          });

          // Create MediaRecorder for audio compression
          const mediaStream = new MediaStream();
          const oscillator = this.audioContext.createOscillator();
          const destination = this.audioContext.createMediaStreamDestination();
          
          // Process audio buffer (simplified - in real implementation would apply compression algorithms)
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(destination);
          
          mediaStream.addTrack(destination.stream.getAudioTracks()[0]);

          const mimeType = this.getSupportedAudioMimeType();
          const recorder = new MediaRecorder(mediaStream, {
            mimeType,
            audioBitsPerSecond: options.audioBitrate * 1000,
          });

          const chunks: Blob[] = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          recorder.onstop = () => {
            const compressedBlob = new Blob(chunks, { type: mimeType });
            resolve(compressedBlob);
          };

          recorder.onerror = (event) => {
            reject(new Error(`Audio compression failed: ${event}`));
          };

          recorder.start();
          source.start();

          // Stop after audio duration
          setTimeout(() => {
            recorder.stop();
            source.stop();
          }, audioBuffer.duration * 1000);

          onProgress?.({
            stage: 'compressing',
            progress: 80,
          });

        } catch (error) {
          reject(error);
        }
      };

      audio.onerror = () => {
        reject(new Error('Failed to load audio'));
      };

      audio.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if necessary
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    // Ensure even dimensions for video encoding
    width = Math.floor(width / 2) * 2;
    height = Math.floor(height / 2) * 2;

    return { width, height };
  }

  /**
   * Get supported MIME type for video
   */
  private getSupportedMimeType(format: 'webm' | 'mp4'): string {
    const types = format === 'webm' 
      ? [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ]
      : [
          'video/mp4;codecs=h264,aac',
          'video/mp4',
        ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Get supported MIME type for audio
   */
  private getSupportedAudioMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Estimate compression time based on file size and type
   */
  static estimateCompressionTime(blob: Blob): number {
    const sizeMB = blob.size / (1024 * 1024);
    const baseTime = blob.type.startsWith('video/') ? 2000 : 1000; // ms per MB
    return sizeMB * baseTime;
  }

  /**
   * Check if compression is recommended
   */
  static shouldCompress(blob: Blob, maxSize: number = 5 * 1024 * 1024): boolean {
    return blob.size > maxSize;
  }

  /**
   * Get compression presets for different use cases
   */
  static getPresets(): Record<string, CompressionOptions> {
    return {
      high: {
        quality: 0.9,
        maxWidth: 1280,
        maxHeight: 720,
        videoBitrate: 2000,
        audioBitrate: 192,
      },
      medium: {
        quality: 0.8,
        maxWidth: 640,
        maxHeight: 480,
        videoBitrate: 1000,
        audioBitrate: 128,
      },
      low: {
        quality: 0.6,
        maxWidth: 480,
        maxHeight: 360,
        videoBitrate: 500,
        audioBitrate: 96,
      },
      mobile: {
        quality: 0.7,
        maxWidth: 480,
        maxHeight: 360,
        videoBitrate: 800,
        audioBitrate: 128,
        maxFileSize: 2 * 1024 * 1024, // 2MB
      },
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Utility functions
export const createMediaCompressor = (): MediaCompressor => {
  return new MediaCompressor();
};

export const compressMediaBlob = async (
  blob: Blob,
  options?: CompressionOptions,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> => {
  const compressor = createMediaCompressor();
  try {
    return await compressor.compressMedia(blob, options, onProgress);
  } finally {
    compressor.dispose();
  }
};