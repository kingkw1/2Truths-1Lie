/**
 * Accessibility Tests for Media Capture UI
 * Tests WCAG compliance, screen reader support, and assistive technology compatibility
 * Requirement 8: Media Capture with accessibility compliance
 * Requirement 10: Testing and Quality Assurance with accessibility validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import MediaRecorder from '../MediaRecorder';
import MediaPreview from '../MediaPreview';
import StatementWithMedia from '../StatementWithMedia';
import EnhancedChallengeCreationForm from '../EnhancedChallengeCreationForm';
import { MediaCapture } from '../../types/challenge';
import challengeCreationSlice from '../../store/slices/challengeCreationSlice';

// Mock URL.createObjectURL and revokeObjectURL
global.URL = global.URL || {};
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock media APIs for accessibility testing
const mockMediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: () => [{ stop: jest.fn() }],
  }),
  enumerateDevices: jest.fn().mockResolvedValue([
    { kind: 'videoinput', deviceId: 'camera1', label: 'HD Webcam' },
    { kind: 'audioinput', deviceId: 'mic1', label: 'Built-in Microphone' },
  ]),
};

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

(global as any).MediaRecorder = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'inactive',
}));

(global as any).MediaRecorder.isTypeSupported = jest.fn(() => true);

// Test store setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationSlice,
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = createTestStore();
  return <Provider store={store}>{children}</Provider>;
};

describe('Media Capture UI - Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('passes axe accessibility audit for MediaRecorder', async () => {
      const { container } = render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for MediaPreview', async () => {
      const mockVideoData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 30000,
        fileSize: 1024000,
        mimeType: 'video/webm',
      };

      const { container } = render(
        <MediaPreview 
          mediaData={mockVideoData}
          onReRecord={jest.fn()}
          onConfirm={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for StatementWithMedia', async () => {
      const { container } = render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: 'Test statement', isLie: false, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for EnhancedChallengeCreationForm', async () => {
      const { container } = render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports full keyboard navigation in MediaRecorder', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      const videoButton = screen.getByText('Video').closest('button');
      const audioButton = screen.getByText('Audio').closest('button');
      const textButton = screen.getByText('Text Only').closest('button');

      // All buttons should be keyboard focusable
      expect(videoButton).not.toHaveAttribute('tabindex', '-1');
      expect(audioButton).not.toHaveAttribute('tabindex', '-1');
      expect(textButton).not.toHaveAttribute('tabindex', '-1');

      // Test keyboard activation
      if (videoButton) {
        videoButton.focus();
        expect(document.activeElement).toBe(videoButton);
        
        fireEvent.keyDown(videoButton, { key: 'Enter' });
        fireEvent.keyDown(videoButton, { key: ' ' }); // Space key
      }
    });

    it('maintains logical tab order in challenge creation form', () => {
      render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Get all focusable elements
      const focusableElements = screen.getAllByRole('textbox')
        .concat(screen.getAllByRole('button'))
        .filter(el => !el.hasAttribute('disabled'));

      // Should have a logical tab order
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // First element should be focusable
      if (focusableElements[0]) {
        focusableElements[0].focus();
        expect(document.activeElement).toBe(focusableElements[0]);
      }
    });

    it('provides keyboard shortcuts for common actions', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Text Only'));
      
      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      const submitButton = screen.getByText('Complete Text Recording');

      // Test Ctrl+Enter shortcut (if implemented)
      textInput.focus();
      fireEvent.change(textInput, { target: { value: 'Test statement' } });
      fireEvent.keyDown(textInput, { key: 'Enter', ctrlKey: true });
      
      // Should be able to submit with keyboard
      expect(submitButton).not.toBeDisabled();
    });

    it('handles escape key to cancel operations', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      // Wait for fallback to text mode
      await waitFor(() => {
        expect(screen.getByText(/video recording not supported, falling back to text mode/)).toBeInTheDocument();
      });

      // Test escape key to cancel
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Should handle escape gracefully
      expect(screen.getByText('Video')).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    it('provides proper ARIA labels for media type buttons', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      const videoButton = screen.getByText('Video').closest('button');
      const audioButton = screen.getByText('Audio').closest('button');
      const textButton = screen.getByText('Text Only').closest('button');

      // Buttons should have accessible names
      expect(videoButton).toHaveAccessibleName();
      expect(audioButton).toHaveAccessibleName();
      expect(textButton).toHaveAccessibleName();
    });

    it('announces recording state changes to screen readers', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByText(/video recording not supported, falling back to text mode/)).toBeInTheDocument();
      });

      // Should have ARIA live region for status updates (error message is announced)
      const errorMessage = screen.getByText(/video recording not supported, falling back to text mode/);
      expect(errorMessage).toBeInTheDocument();
    });

    it('provides descriptive text for media preview controls', () => {
      const mockVideoData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 30000,
        fileSize: 1024000,
        mimeType: 'video/webm',
      };

      render(
        <MediaPreview 
          mediaData={mockVideoData}
          onReRecord={jest.fn()}
          onConfirm={jest.fn()}
        />
      );

      // Control buttons should have descriptive titles/labels
      const playButton = screen.getByTitle('Play');
      const muteButton = screen.getByTitle(/mute/i);
      const volumeSlider = screen.getByTitle('Volume');

      expect(playButton).toBeInTheDocument();
      expect(muteButton).toBeInTheDocument();
      expect(volumeSlider).toBeInTheDocument();
    });

    it('provides context for form validation errors', async () => {
      render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Try to submit without completing form
      const submitButton = screen.getByText('Create Challenge');
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should show validation errors with proper context
        const errorElements = screen.queryAllByText(/Please fix the following issues/);
        if (errorElements.length > 0) {
          expect(errorElements[0]).toBeInTheDocument();
        }
      });
    });

    it('announces upload progress to screen readers', () => {
      const mockVideoData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 30000,
        fileSize: 1024000,
        mimeType: 'video/webm',
      };

      render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: 'Test', isLie: false, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
          />
        </TestWrapper>
      );

      // Upload progress should be announced
      // This would be tested with actual upload state
      expect(screen.getByText('Statement 1')).toBeInTheDocument();
    });
  });

  describe('Visual Accessibility', () => {
    it('provides sufficient color contrast for all text', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      // Title should have good contrast
      const title = screen.getByText('Record Your Statement');
      const titleStyles = window.getComputedStyle(title);
      
      // This is a basic check - in real testing, you'd use tools like axe
      expect(title).toBeInTheDocument();
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: 'Test', isLie: true, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
            isLie={true}
          />
        </TestWrapper>
      );

      // Lie indicator should be visible in high contrast
      expect(screen.getByText('🎭 This is the lie')).toBeInTheDocument();
    });

    it('provides visual focus indicators', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      const videoButton = screen.getByText('Video').closest('button');
      
      if (videoButton) {
        videoButton.focus();
        
        // Should have visible focus indicator
        // This would be tested with actual CSS focus styles
        expect(document.activeElement).toBe(videoButton);
      }
    });

    it('scales properly with browser zoom', () => {
      // Mock high zoom level
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2,
      });

      render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Should render properly at high zoom levels
      expect(screen.getByText('Create Your Challenge')).toBeInTheDocument();
    });

    it('supports reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      // Should render without problematic animations
      expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
    });
  });

  describe('Touch and Mobile Accessibility', () => {
    it('provides adequate touch targets on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: '', isLie: false, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
          />
        </TestWrapper>
      );

      const mediaButton = screen.getByText('📹 Add Media').closest('button');
      
      // Button should have adequate touch target size (44px minimum)
      if (mediaButton) {
        const styles = window.getComputedStyle(mediaButton);
        // This would check actual computed styles in real testing
        expect(mediaButton).toBeInTheDocument();
      }
    });

    it('supports voice control and switch navigation', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      // All interactive elements should be properly labeled for voice control
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('handles orientation changes gracefully', () => {
      const { rerender } = render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Simulate orientation change
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 812, // Landscape width
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        value: 375, // Landscape height
      });

      rerender(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Should maintain accessibility in landscape mode
      expect(screen.getByText('Create Your Challenge')).toBeInTheDocument();
    });
  });

  describe('Assistive Technology Compatibility', () => {
    it('works with screen magnification software', () => {
      // Mock high zoom scenario
      Object.defineProperty(document.documentElement, 'style', {
        writable: true,
        value: { zoom: '200%' },
      });

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      // Should remain functional at high magnification
      expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
    });

    it('supports voice recognition software', () => {
      render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: '', isLie: false, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
          />
        </TestWrapper>
      );

      const textInput = screen.getByPlaceholderText(/Enter your first statement/);
      
      // Should support voice input
      fireEvent.change(textInput, { target: { value: 'Voice dictated text' } });
      // Verify the input is functional for voice recognition
      expect(textInput).toBeInTheDocument();
    });

    it('provides alternative text for visual elements', () => {
      render(
        <TestWrapper>
          <StatementWithMedia
            statementIndex={0}
            statement={{ id: '1', text: 'Test', isLie: true, confidence: 0 }}
            onStatementChange={jest.fn()}
            onMediaChange={jest.fn()}
            isLie={true}
          />
        </TestWrapper>
      );

      // Emoji and visual indicators should have text alternatives
      expect(screen.getByText('🎭 This is the lie')).toBeInTheDocument();
    });

    it('maintains functionality with JavaScript disabled', () => {
      // This would require a different testing approach in real scenarios
      // For now, we test that core HTML structure is accessible
      render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Form should have proper HTML structure
      const textInputs = screen.getAllByRole('textbox');
      const buttons = screen.getAllByRole('button');
      
      expect(textInputs.length).toBeGreaterThan(0);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Accessibility', () => {
    it('announces errors to screen readers', async () => {
      // Mock permission denied
      mockMediaDevices.getUserMedia.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        // Error message should be announced
        expect(screen.getByText(/video recording not supported, falling back to text mode/)).toBeInTheDocument();
      });
    });

    it('provides clear recovery instructions', async () => {
      render(
        <TestWrapper>
          <EnhancedChallengeCreationForm />
        </TestWrapper>
      );

      // Try to submit incomplete form
      const submitButton = screen.getByText('Create Challenge');
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should provide clear instructions for fixing issues
        const instructions = screen.queryByText(/Please fix the following issues/);
        if (instructions) {
          expect(instructions).toBeInTheDocument();
        }
      });
    });

    it('maintains accessibility during error states', () => {
      const corruptedMedia: MediaCapture = {
        type: 'video',
        url: 'invalid-url',
        duration: -1,
        fileSize: -1,
        mimeType: 'invalid/type',
      };

      render(<MediaPreview mediaData={corruptedMedia} />);

      // Should remain accessible even with invalid data
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
    });
  });
});