/**
 * Simple example showing UploadProgress integration
 * This demonstrates the basic usage pattern
 */

import React, { useState } from 'react';
import { UploadProgress } from './UploadProgress';
import { useFileUpload } from '../hooks/useFileUpload';

export const UploadProgressExample: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSessions, setUploadSessions] = useState<Array<{
    sessionId: string;
    filename: string;
    fileSize: number;
  }>>([]);

  const {
    startUpload,
    isUploading,
    progress,
    result,
    error,
    sessionId,
  } = useFileUpload({
    onUploadComplete: (uploadResult) => {
      console.log('Upload completed:', uploadResult);
      // Remove from active sessions
      setUploadSessions(prev => 
        prev.filter(session => session.sessionId !== uploadResult.sessionId)
      );
    },
    onUploadError: (uploadError) => {
      console.error('Upload error:', uploadError);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleStartUpload = async () => {
    if (selectedFile) {
      await startUpload(selectedFile);
      
      // Add to active sessions for tracking
      if (sessionId) {
        setUploadSessions(prev => [...prev, {
          sessionId,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
        }]);
      }
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Upload Progress Example</h2>
      
      {/* File Selection */}
      <div style={styles.section}>
        <input
          type="file"
          onChange={handleFileSelect}
          accept="video/*,audio/*,image/*,.txt,.pdf"
          style={styles.fileInput}
        />
        
        {selectedFile && (
          <div style={styles.fileInfo}>
            <p>Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
            <button 
              onClick={handleStartUpload}
              disabled={isUploading}
              style={styles.uploadButton}
            >
              {isUploading ? 'Uploading...' : 'Start Upload'}
            </button>
          </div>
        )}
      </div>

      {/* Active Upload Progress */}
      {progress && sessionId && (
        <div style={styles.section}>
          <h3>Current Upload</h3>
          <UploadProgress
            sessionId={sessionId}
            filename={selectedFile?.name || 'unknown'}
            fileSize={progress.totalBytes}
            onUploadComplete={(fileUrl) => {
              console.log('File available at:', fileUrl);
            }}
            onUploadError={(error) => {
              console.error('Upload failed:', error);
            }}
            onUploadCancel={() => {
              console.log('Upload cancelled by user');
            }}
            showDetails={true}
            compact={false}
          />
        </div>
      )}

      {/* Upload History */}
      {uploadSessions.length > 0 && (
        <div style={styles.section}>
          <h3>Upload Sessions</h3>
          {uploadSessions.map((session) => (
            <UploadProgress
              key={session.sessionId}
              sessionId={session.sessionId}
              filename={session.filename}
              fileSize={session.fileSize}
              showDetails={false}
              compact={true}
            />
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={styles.section}>
          <h3>Upload Complete</h3>
          <div style={styles.result}>
            <p>✅ File uploaded successfully!</p>
            <p>URL: <a href={result.fileUrl} target="_blank" rel="noopener noreferrer">{result.fileUrl}</a></p>
            <p>Size: {formatFileSize(result.fileSize)}</p>
            <p>Completed: {result.completedAt.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={styles.section}>
          <h3>Upload Error</h3>
          <div style={styles.error}>
            <p>❌ {error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Styles
const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  } as React.CSSProperties,

  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  section: {
    marginBottom: '24px',
    padding: '16px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
  } as React.CSSProperties,

  fileInput: {
    width: '100%',
    padding: '8px',
    marginBottom: '12px',
  } as React.CSSProperties,

  fileInfo: {
    padding: '12px',
    backgroundColor: '#F9FAFB',
    borderRadius: '6px',
  } as React.CSSProperties,

  uploadButton: {
    padding: '8px 16px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '8px',
  } as React.CSSProperties,

  result: {
    padding: '12px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '6px',
  } as React.CSSProperties,

  error: {
    padding: '12px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    color: '#DC2626',
  } as React.CSSProperties,
};

export default UploadProgressExample;