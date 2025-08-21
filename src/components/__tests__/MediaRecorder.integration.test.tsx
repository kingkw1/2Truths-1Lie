/**
 * Integration tests for MediaRecorder component
 * Tests the full recording workflow with enhanced controls
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecorder from '../MediaRecorder';
import { MediaCapture, MediaType } from '../../types/challenge';

describe('MediaRecorder Integration Tests', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    onRecordingComplete: mockOnRecordingComplete,
    onRecordingError: mockOnRecordingError,
    maxDuration: 30000,
    allowedTypes: ['video', 'audio', 'text'] as MediaType[],
    disabled: false,
  };

  it('provides complete recording workflow with all controls', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Should show all media type options
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Text Only')).toBeInTheDocument();
    
    // Test text recording workflow (most reliable in test environment)
    fireEvent.click(screen.getByText('Text Only'));
    
    // Should show text input interface
    const textInput = screen.getByPlaceholderText(/Type your statement here/);
    expect(textInput).toBeInTheDocument();
    
    // Should show character counter
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    
    // Type some text
    fireEvent.change(textInput, { target: { value: 'This is my test statement for the challenge' } });
    
    // Should update character counter
    expect(screen.getByText('43/500 characters')).toBeInTheDocument();
    
    // Complete button should be enabled
    const completeButton = screen.getByText('Complete Text Recording');
    expect(completeButton).not.toBeDisabled();
    
    // Complete the recording
    fireEvent.click(completeButton);
    
    // Should show completion state
    await waitFor(() => {
      expect(screen.getByText('Text Recorded:')).toBeInTheDocument();
      expect(screen.getByText('"This is my test statement for the challenge"')).toBeInTheDocument();
    });
    
    // Should have called completion callback
    expect(mockOnRecordingComplete).toHaveBeenCalledWith({
      type: 'text',
      url: expect.stringContaining('data:text/plain;base64,'),
      duration: 0,
      fileSize: expect.any(Number),
      mimeType: 'text/plain',
    });
    
    // Should show record again option
    expect(screen.getByText('Record Again')).toBeInTheDocument();
  });

  it('handles recording controls interface correctly', () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Should provide clear interface for all recording types
    const videoButton = screen.getByText('Video').closest('button');
    const audioButton = screen.getByText('Audio').closest('button');
    const textButton = screen.getByText('Text Only').closest('button');
    
    expect(videoButton).not.toBeDisabled();
    expect(audioButton).not.toBeDisabled();
    expect(textButton).not.toBeDisabled();
    
    // Should show helpful icons
    expect(screen.getByText('🎥')).toBeInTheDocument();
    expect(screen.getByText('🎤')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('respects disabled state for all controls', () => {
    render(<MediaRecorder {...defaultProps} disabled={true} />);
    
    const videoButton = screen.getByText('Video').closest('button');
    const audioButton = screen.getByText('Audio').closest('button');
    const textButton = screen.getByText('Text Only').closest('button');
    
    expect(videoButton).toBeDisabled();
    expect(audioButton).toBeDisabled();
    expect(textButton).toBeDisabled();
  });

  it('enforces character limits in text mode', () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Text Only'));
    
    const textInput = screen.getByPlaceholderText(/Type your statement here/) as HTMLTextAreaElement;
    
    // Type text exceeding limit
    const longText = 'a'.repeat(600);
    fireEvent.change(textInput, { target: { value: longText } });
    
    // Should be limited to 500 characters
    expect(textInput.value).toHaveLength(500);
    expect(screen.getByText('500/500 characters')).toBeInTheDocument();
  });

  it('provides fallback behavior for unsupported media types', () => {
    render(<MediaRecorder {...defaultProps} allowedTypes={['text']} />);
    
    // Should only show text option when other types are not allowed
    expect(screen.queryByText('Video')).not.toBeInTheDocument();
    expect(screen.queryByText('Audio')).not.toBeInTheDocument();
    expect(screen.getByText('Text Only')).toBeInTheDocument();
  });
});