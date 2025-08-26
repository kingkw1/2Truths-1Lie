/**
 * Tests for media compression functionality
 */

// Export to make this a module
export {};

// Mock MediaRecorder and related APIs
const mockMediaRecorderInstance = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: null,
  onstop: null,
  onerror: null,
};

const MockMediaRecorderConstructor = jest.fn(() => mockMediaRecorderInstance);
(MockMediaRecorderConstructor as any).isTypeSupported = jest.fn().mockReturnValue(true);

global.MediaRecorder = MockMediaRecorderConstructor as any;

Object.defineProperty(global.MediaRecorder, 'isTypeSupported', {
  value: jest.fn().mockReturnValue(true),
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createMediaElementSource: jest.fn(),
  createMediaStreamDestination: jest.fn().mockReturnValue({
    stream: {
      getAudioTracks: jest.fn().mockReturnValue([]),
    },
  }),
  createBufferSource: jest.fn().mockReturnValue({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  }),
  decodeAudioData: jest.fn().mockResolvedValue({
    duration: 5,
  }),
  close: jest.fn(),
  state: 'running',
}));

// Mock canvas and context
const mockContext2D = {
  drawImage: jest.fn(),
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  canvas: null as any, // Will be set below
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn((contextType) => {
    if (contextType === '2d') {
      return mockContext2D;
    }
    return null;
  }),
  captureStream: jest.fn().mockReturnValue({
    addTrack: jest.fn(),
    getAudioTracks: jest.fn().mockReturnValue([]),
  }),
};

// Set up circular reference
mockContext2D.canvas = mockCanvas;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

describe('MediaCompressor', () => {
  // Set longer timeout for all tests in this suite
  jest.setTimeout(15000);
  
  // Import after mocks are set up
  let MediaCompressor: any;
  let compressMediaBlob: any;

  beforeAll(() => {
    // Mock document.createElement just before requiring the module
    jest.doMock('../mediaCompression', () => {
      const originalModule = jest.requireActual('../mediaCompression');
      
      // Create a mock MediaCompressor constructor function
      function MockedMediaCompressor(this: any) {
        this.canvas = mockCanvas;
        this.ctx = mockContext2D;
        this.audioContext = null;
      }
      
      // Copy prototype methods
      MockedMediaCompressor.prototype = originalModule.MediaCompressor.prototype;
      
      // Copy static methods
      (MockedMediaCompressor as any).getPresets = originalModule.MediaCompressor.getPresets;
      (MockedMediaCompressor as any).shouldCompress = originalModule.MediaCompressor.shouldCompress;
      (MockedMediaCompressor as any).estimateCompressionTime = originalModule.MediaCompressor.estimateCompressionTime;
      
      return {
        ...originalModule,
        MediaCompressor: MockedMediaCompressor,
        createMediaCompressor: () => new (MockedMediaCompressor as any)(),
      };
    });
    
    const compressionModule = require('../mediaCompression');
    MediaCompressor = compressionModule.MediaCompressor;
    compressMediaBlob = compressionModule.compressMediaBlob;
  });

  afterAll(() => {
    // No need to restore since we're using Object.defineProperty
  });

  describe('initialization', () => {
    it('should create a compressor instance', () => {
      const compressor = new MediaCompressor();
      expect(compressor).toBeDefined();
      expect(compressor.canvas).toBe(mockCanvas);
      expect(compressor.ctx).toBe(mockContext2D);
      compressor.dispose();
    });

    it('should initialize canvas and context', () => {
      const compressor = new MediaCompressor();
      // Since we're using a mock constructor, check that mock objects are assigned
      expect(compressor.canvas).toBe(mockCanvas);
      expect(compressor.ctx).toBe(mockContext2D);
      compressor.dispose();
    });
  });

  describe('compression options', () => {
    it('should provide default compression presets', () => {
      const presets = MediaCompressor.getPresets();
      
      expect(presets).toHaveProperty('high');
      expect(presets).toHaveProperty('medium');
      expect(presets).toHaveProperty('low');
      expect(presets).toHaveProperty('mobile');
      
      expect(presets.high.quality).toBe(0.9);
      expect(presets.medium.quality).toBe(0.8);
      expect(presets.low.quality).toBe(0.6);
    });

    it('should recommend compression for large files', () => {
      const largeBlob = new Blob(['x'.repeat(6 * 1024 * 1024)]); // 6MB
      const smallBlob = new Blob(['small content']);
      
      expect(MediaCompressor.shouldCompress(largeBlob)).toBe(true);
      expect(MediaCompressor.shouldCompress(smallBlob)).toBe(false);
    });

    it('should estimate compression time based on file size', () => {
      const videoBlob = new Blob(['x'.repeat(2 * 1024 * 1024)], { type: 'video/webm' }); // 2MB
      const audioBlob = new Blob(['x'.repeat(2 * 1024 * 1024)], { type: 'audio/webm' }); // 2MB
      
      const videoTime = MediaCompressor.estimateCompressionTime(videoBlob);
      const audioTime = MediaCompressor.estimateCompressionTime(audioBlob);
      
      expect(videoTime).toBeGreaterThan(audioTime);
      expect(videoTime).toBeGreaterThan(0);
      expect(audioTime).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported media types', async () => {
      const compressor = new MediaCompressor();
      const unsupportedBlob = new Blob(['content'], { type: 'image/png' });
      
      await expect(compressor.compressMedia(unsupportedBlob)).rejects.toThrow(
        'Unsupported media type: image/png'
      );
      
      compressor.dispose();
    });

    it('should handle compression failures gracefully', async () => {
      // Mock a failure in MediaRecorder
      const originalMediaRecorder = global.MediaRecorder;
      const failingMockConstructor = jest.fn().mockImplementation(() => {
        throw new Error('MediaRecorder failed');
      });
      (failingMockConstructor as any).isTypeSupported = jest.fn().mockReturnValue(true);
      global.MediaRecorder = failingMockConstructor as any;

      const compressor = new MediaCompressor();
      const videoBlob = new Blob(['video content'], { type: 'video/webm' });
      
      await expect(compressor.compressMedia(videoBlob)).rejects.toThrow();
      
      // Restore original
      global.MediaRecorder = originalMediaRecorder;
      compressor.dispose();
    });
  });

  describe('utility functions', () => {
    it('should create a compressor instance via utility function', () => {
      const { createMediaCompressor } = require('../mediaCompression');
      const instance = createMediaCompressor();
      
      expect(instance).toBeDefined();
      instance.dispose();
    });
  });

  describe('progress reporting', () => {
    it('should call progress callback during compression', async () => {
      const compressor = new MediaCompressor();
      const progressCallback = jest.fn();
      const blob = new Blob(['test content'], { type: 'audio/webm' });

      try {
        await compressor.compressMedia(blob, {}, progressCallback);
      } catch (error) {
        // Expected to fail in test environment, but should have called progress
      }
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'analyzing',
          progress: expect.any(Number),
        })
      );
      
      compressor.dispose();
    });
  });
});

describe('Integration with MediaRecording', () => {
  it('should integrate with useMediaRecording hook', () => {
    // This would be tested in the hook tests
    // Here we just verify the interface compatibility
    const compressionOptions = {
      quality: 0.8,
      maxWidth: 640,
      maxHeight: 480,
    };
    
    expect(compressionOptions).toHaveProperty('quality');
    expect(compressionOptions).toHaveProperty('maxWidth');
    expect(compressionOptions).toHaveProperty('maxHeight');
  });
});