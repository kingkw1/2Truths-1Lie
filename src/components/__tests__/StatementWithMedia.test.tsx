/**
 * Unit tests for StatementWithMedia component
 * Tests integration of text input with media recording
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatementWithMedia from '../StatementWithMedia';
import { Statement, MediaCapture } from '../../types/challenge';

// Mock MediaRecorder component
jest.mock('../MediaRecorder', () => {
  return function MockMediaRecorder({ onRecordingComplete, onRecordingError }: any) {
    return (
      <div data-testid="media-recorder">
        <button 
          onClick={() => onRecordingComplete({
            type: 'video',
            url: 'blob:mock-video-url',
            duration: 15000,
            fileSize: 2048,
            mimeType: 'video/webm',
          })}
        >
          Complete Video Recording
        </button>
        <button 
          onClick={() => onRecordingComplete({
            type: 'audio',
            url: 'blob:mock-audio-url',
            duration: 10000,
            fileSize: 1024,
            mimeType: 'audio/webm',
          })}
        >
          Complete Audio Recording
        </button>
        <button 
          onClick={() => onRecordingComplete({
            type: 'text',
            url: 'data:text/plain;base64,VGVzdCB0ZXh0',
            duration: 0,
            fileSize: 512,
            mimeType: 'text/plain',
          })}
        >
          Complete Text Recording
        </button>
        <button onClick={() => onRecordingError('Mock recording error')}>
          Trigger Error
        </button>
      </div>
    );
  };
});

describe('StatementWithMedia Component', () => {
  const mockStatement: Statement = {
    id: 'stmt_1',
    text: 'This is a test statement',
    isLie: false,
    confidence: 0,
  };

  const mockOnStatementChange = jest.fn();
  const mockOnMediaChange = jest.fn();

  const defaultProps = {
    statementIndex: 0,
    statement: mockStatement,
    onStatementChange: mockOnStatementChange,
    onMediaChange: mockOnMediaChange,
    isLie: false,
    disabled: false,
    maxTextLength: 280,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders statement input with correct placeholder', () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Enter your first statement (this could be true or false)...')).toBeInTheDocument();
    expect(screen.getByDisplayValue('This is a test statement')).toBeInTheDocument();
  });

  it('shows lie indicator when isLie is true', () => {
    render(<StatementWithMedia {...defaultProps} isLie={true} />);
    
    expect(screen.getByText('🎭 This is the lie')).toBeInTheDocument();
  });

  it('handles text changes and enforces character limit', () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    const textInput = screen.getByDisplayValue('This is a test statement');
    
    // Change text
    fireEvent.change(textInput, { target: { value: 'New statement text' } });
    
    expect(mockOnStatementChange).toHaveBeenCalledWith(0, {
      ...mockStatement,
      text: 'New statement text',
    });
  });

  it('enforces maximum text length', () => {
    render(<StatementWithMedia {...defaultProps} maxTextLength={50} />);
    
    const textInput = screen.getByDisplayValue('This is a test statement');
    const longText = 'a'.repeat(100);
    
    fireEvent.change(textInput, { target: { value: longText } });
    
    // Should be truncated to 50 characters
    expect(mockOnStatementChange).toHaveBeenCalledWith(0, {
      ...mockStatement,
      text: 'a'.repeat(50),
    });
  });

  it('shows character count', () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    expect(screen.getByText('24/280 characters')).toBeInTheDocument();
  });

  it('toggles media recorder visibility', () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Initially media recorder should not be visible
    expect(screen.queryByTestId('media-recorder')).not.toBeInTheDocument();
    
    // Click add media button
    fireEvent.click(screen.getByText('📹 Add Media'));
    
    // Media recorder should now be visible
    expect(screen.getByTestId('media-recorder')).toBeInTheDocument();
  });

  it('handles video recording completion', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Open media recorder
    fireEvent.click(screen.getByText('📹 Add Media'));
    
    // Complete video recording
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(mockOnMediaChange).toHaveBeenCalledWith(0, {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/webm',
      });
    });
    
    // Should show video preview
    expect(screen.getByText('Video Recording')).toBeInTheDocument();
    expect(screen.getByText('Duration: 15s')).toBeInTheDocument();
    expect(screen.getByText('Size: 2 KB')).toBeInTheDocument();
  });

  it('handles audio recording completion', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Open media recorder and complete audio recording
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Audio Recording'));
    
    await waitFor(() => {
      expect(mockOnMediaChange).toHaveBeenCalledWith(0, {
        type: 'audio',
        url: 'blob:mock-audio-url',
        duration: 10000,
        fileSize: 1024,
        mimeType: 'audio/webm',
      });
    });
    
    // Should show audio preview
    expect(screen.getByText('Audio Recording')).toBeInTheDocument();
    expect(screen.getByText('Duration: 10s')).toBeInTheDocument();
  });

  it('handles text recording completion and updates statement', async () => {
    // Mock atob for base64 decoding
    (global as any).atob = jest.fn(() => 'Decoded text from recording');
    
    render(<StatementWithMedia {...defaultProps} />);
    
    // Open media recorder and complete text recording
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Text Recording'));
    
    await waitFor(() => {
      expect(mockOnMediaChange).toHaveBeenCalledWith(0, {
        type: 'text',
        url: 'data:text/plain;base64,VGVzdCB0ZXh0',
        duration: 0,
        fileSize: 512,
        mimeType: 'text/plain',
      });
    });
    
    // Should also update the statement text
    expect(mockOnStatementChange).toHaveBeenCalledWith(0, {
      ...mockStatement,
      text: 'Decoded text from recording',
    });
  });

  it('handles recording errors', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Open media recorder and trigger error
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Trigger Error'));
    
    await waitFor(() => {
      expect(screen.getByText('Mock recording error')).toBeInTheDocument();
    });
  });

  it('allows removing recorded media', async () => {
    // Mock URL.revokeObjectURL
    (global as any).URL = {
      revokeObjectURL: jest.fn(),
    };
    
    render(<StatementWithMedia {...defaultProps} />);
    
    // Add media first
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('Video Recording')).toBeInTheDocument();
    });
    
    // Remove media
    fireEvent.click(screen.getByText('✕'));
    
    expect(mockOnMediaChange).toHaveBeenCalledWith(0, null);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-video-url');
  });

  it('shows edit media button when media is recorded', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Initially shows "Add Media"
    expect(screen.getByText('📹 Add Media')).toBeInTheDocument();
    
    // Add media
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('🎬 Edit Media')).toBeInTheDocument();
    });
  });

  it('applies lie styling when isLie is true', () => {
    render(<StatementWithMedia {...defaultProps} isLie={true} />);
    
    const container = screen.getByText('Statement 1').closest('div');
    expect(container).toHaveStyle('border-color: #ef4444');
  });

  it('disables interactions when disabled prop is true', () => {
    render(<StatementWithMedia {...defaultProps} disabled={true} />);
    
    const textInput = screen.getByDisplayValue('This is a test statement');
    const mediaButton = screen.getByText('📹 Add Media');
    
    expect(textInput).toBeDisabled();
    expect(mediaButton).toBeDisabled();
  });

  it('formats file sizes correctly', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    // Test different file sizes
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('Size: 2 KB')).toBeInTheDocument();
    });
  });

  it('formats duration correctly', async () => {
    render(<StatementWithMedia {...defaultProps} />);
    
    fireEvent.click(screen.getByText('📹 Add Media'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText('Duration: 15s')).toBeInTheDocument();
    });
  });

  it('shows correct statement number', () => {
    render(<StatementWithMedia {...defaultProps} statementIndex={2} />);
    
    expect(screen.getByText('Statement 3')).toBeInTheDocument();
  });

  it('shows correct placeholder for different statement indices', () => {
    const { rerender } = render(<StatementWithMedia {...defaultProps} statementIndex={1} />);
    
    expect(screen.getByPlaceholderText('Enter your second statement (this could be true or false)...')).toBeInTheDocument();
    
    rerender(<StatementWithMedia {...defaultProps} statementIndex={2} />);
    expect(screen.getByPlaceholderText('Enter your third statement (this could be true or false)...')).toBeInTheDocument();
  });
});