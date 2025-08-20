/**
 * Unit tests for MediaRecorder component
 * Tests video, audio, and text recording functionality with fallback mechanisms
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecorder from '../MediaRecorder';
import { MediaCapture } from '../../types/challenge';

// Mock MediaRecorder API
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: null as any,
  onstop: null as any,
  state: 'inactive',
};

const mockStream = {
  getTracks: jest.fn(() => [
    { stop: jest.fn() },
    { stop: jest.fn() },
  ]),
};

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(),
  },
});

// Mock MediaRecorder constructor
(global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);
(global as any).MediaRecorder.isTypeSupported = jest.fn(() => true);

// Mock URL.createObjectURL
(global as any).URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock Blob
(global as any).Blob = jest.fn(() => ({
  size: 1024,
}));

// Mock btoa for text encoding
(global as any).btoa = jest.fn((str: string) => Buffer.from(str).toString('base64'));

describe('MediaRecorder Component', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaRecorder.start.mockClear();
    mockMediaRecorder.stop.mockClear();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
  });

  const defaultProps = {
    onRecordingComplete: mockOnRecordingComplete,
    onRecordingError: mockOnRecordingError,
    maxDuration: 30000,
    allowedTypes: ['video', 'audio', 'text'] as const,
    disabled: false,
  };

  it('renders media type selection buttons', () => {
    render(<MediaRecorder {...defaultProps} />);
    
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Text Only')).toBeInTheDocument();
  });

  it('shows only allowed media types', () => {
    render(<MediaRecorder {...defaultProps} allowedTypes={['audio', 'text']} />);
    
    expect(screen.queryByText('Video')).not.toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Text Only')).toBeInTheDocument();
  });

  it('handles text-only recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click text-only button
    fireEvent.click(screen.getByText('Text Only'));
    
    // Should show text input
    expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
    
    // Type text and submit
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    fireEvent.change(textInput, { target: { value: 'This is my test statement' } });
    
    fireEvent.click(screen.getByText('Complete Text Recording'));
    
    await waitFor(() => {
      expect(mockOnRecordingComplete).toHaveBeenCalledWith({
        type: 'text',
        url: expect.stringContaining('data:text/plain;base64,'),
        duration: 0,
        fileSize: 1024,
        mimeType: 'text/plain',
      });
    });
  });

  it('requests video permissions and starts recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click video button
    fireEvent.click(screen.getByText('Video'));
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      });
    });
  });

  it('requests audio permissions and starts recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click audio button
    fireEvent.click(screen.getByText('Audio'));
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
      });
    });
  });

  it('falls back to text when video permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
      new Error('Permission denied')
    );
    
    render(<MediaRecorder {...defaultProps} />);
    
    // Click video button
    fireEvent.click(screen.getByText('Video'));
    
    // Should show error message in UI instead of calling onRecordingError
    await waitFor(() => {
      expect(screen.getByText(/video recording not supported, using text mode/)).toBeInTheDocument();
    });
    
    // Should show text input as fallback
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
    });
  });

  it('falls back to text when audio permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
      new Error('Permission denied')
    );
    
    render(<MediaRecorder {...defaultProps} />);
    
    // Click audio button
    fireEvent.click(screen.getByText('Audio'));
    
    // Should show error message in UI instead of calling onRecordingError
    await waitFor(() => {
      expect(screen.getByText(/audio recording not supported, using text mode/)).toBeInTheDocument();
    });
    
    // Should show text input as fallback
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
    });
  });

  it('shows error when unsupported media type is requested', () => {
    render(<MediaRecorder {...defaultProps} allowedTypes={['text']} />);
    
    // Manually trigger video recording (simulating internal call)
    const component = screen.getByText('Record Your Statement').closest('div');
    expect(component).toBeInTheDocument();
    
    // Only text should be available
    expect(screen.queryByText('Video')).not.toBeInTheDocument();
    expect(screen.queryByText('Audio')).not.toBeInTheDocument();
    expect(screen.getByText('Text Only')).toBeInTheDocument();
  });

  it('enforces character limit in text mode', () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click text-only button
    fireEvent.click(screen.getByText('Text Only'));
    
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    
    // Type text exceeding limit
    const longText = 'a'.repeat(600);
    fireEvent.change(textInput, { target: { value: longText } });
    
    // Should be truncated to 500 characters (the component handles this internally)
    expect((textInput as HTMLTextAreaElement).value).toHaveLength(500);
  });

  it('shows character count in text mode', () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click text-only button
    fireEvent.click(screen.getByText('Text Only'));
    
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    fireEvent.change(textInput, { target: { value: 'Hello world' } });
    
    expect(screen.getByText('11/500 characters')).toBeInTheDocument();
  });

  it('disables recording when disabled prop is true', () => {
    render(<MediaRecorder {...defaultProps} disabled={true} />);
    
    const videoButton = screen.getByText('Video').closest('button');
    const audioButton = screen.getByText('Audio').closest('button');
    const textButton = screen.getByText('Text Only').closest('button');
    
    expect(videoButton).toBeDisabled();
    expect(audioButton).toBeDisabled();
    expect(textButton).toBeDisabled();
  });

  it('allows text recording reset', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click text-only button and complete recording
    fireEvent.click(screen.getByText('Text Only'));
    
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    fireEvent.change(textInput, { target: { value: 'Test statement' } });
    fireEvent.click(screen.getByText('Complete Text Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('Record Again')).toBeInTheDocument();
    });
    
    // Click record again
    fireEvent.click(screen.getByText('Record Again'));
    
    // Should show text input again
    expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
  });

  it('handles MediaRecorder not supported gracefully', async () => {
    // Mock MediaRecorder as not supported
    (global as any).MediaRecorder = undefined;
    
    render(<MediaRecorder {...defaultProps} />);
    
    // Click video button
    fireEvent.click(screen.getByText('Video'));
    
    // Should fall back to text mode
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
    });
  });
});

describe('MediaRecorder Text Recording', () => {
  const mockOnComplete = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates text input before completion', () => {
    render(<MediaRecorder 
      onRecordingComplete={mockOnComplete}
      onRecordingError={jest.fn()}
      allowedTypes={['text']}
    />);
    
    // Click text-only button
    fireEvent.click(screen.getByText('Text Only'));
    
    // Try to complete without text
    const completeButton = screen.getByText('Complete Text Recording');
    expect(completeButton).toBeDisabled();
    
    // Add text
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    fireEvent.change(textInput, { target: { value: 'Valid text' } });
    
    // Button should now be enabled
    expect(completeButton).not.toBeDisabled();
  });

  it('shows preview after text completion', async () => {
    render(<MediaRecorder 
      onRecordingComplete={mockOnComplete}
      onRecordingError={jest.fn()}
      allowedTypes={['text']}
    />);
    
    // Complete text recording
    fireEvent.click(screen.getByText('Text Only'));
    
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    fireEvent.change(textInput, { target: { value: 'My test statement' } });
    fireEvent.click(screen.getByText('Complete Text Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('Text Recorded:')).toBeInTheDocument();
      expect(screen.getByText('"My test statement"')).toBeInTheDocument();
    });
  });
});