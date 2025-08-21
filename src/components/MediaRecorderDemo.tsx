/**
 * Demo component to test the video+audio recording fix
 * This can be used to manually verify the fix works in a real browser
 */

import React from 'react';
import MediaRecorder from './MediaRecorder';
import { MediaCapture } from '../types/challenge';

const MediaRecorderDemo: React.FC = () => {
  const handleRecordingComplete = (mediaData: MediaCapture) => {
    console.log('🎉 Recording completed:', mediaData);
    
    // Log details about the recording
    console.log('📊 Recording Details:');
    console.log('  Type:', mediaData.type);
    console.log('  Duration:', mediaData.duration, 'ms');
    console.log('  File size:', mediaData.fileSize, 'bytes');
    console.log('  MIME type:', mediaData.mimeType);
    console.log('  URL:', mediaData.url);
    
    if (mediaData.type === 'video') {
      console.log('✅ Video recording completed - checking for audio...');
      
      // Create a test video element to verify audio is included
      const testVideo = document.createElement('video');
      testVideo.src = mediaData.url || '';
      testVideo.controls = true;
      testVideo.style.maxWidth = '400px';
      testVideo.style.marginTop = '20px';
      testVideo.preload = 'metadata';
      
      // Add to demo area
      const demoArea = document.getElementById('demo-result');
      if (demoArea) {
        demoArea.innerHTML = '<h3>🎬 Recording Result:</h3><p>Loading video metadata...</p>';
        demoArea.appendChild(testVideo);
        
        // Comprehensive audio detection
        testVideo.addEventListener('loadedmetadata', () => {
          console.log('📹 Video metadata loaded:');
          console.log('  Duration:', testVideo.duration, 'seconds');
          console.log('  Dimensions:', testVideo.videoWidth, 'x', testVideo.videoHeight);
          
          // Multiple methods to detect audio
          const videoElement = testVideo as any;
          const detectionMethods = {
            mozHasAudio: videoElement.mozHasAudio,
            webkitAudioDecodedByteCount: videoElement.webkitAudioDecodedByteCount,
            audioTracks: videoElement.audioTracks?.length || 0,
            duration: testVideo.duration > 0
          };
          
          console.log('🔍 Audio detection methods:', detectionMethods);
          
          const hasAudio = detectionMethods.mozHasAudio !== false || 
                          detectionMethods.webkitAudioDecodedByteCount > 0 ||
                          detectionMethods.audioTracks > 0;
          
          // Update the demo area with results
          const resultDiv = document.createElement('div');
          resultDiv.style.marginTop = '15px';
          resultDiv.style.padding = '15px';
          resultDiv.style.backgroundColor = hasAudio ? '#e8f5e8' : '#fff3cd';
          resultDiv.style.border = `2px solid ${hasAudio ? '#28a745' : '#ffc107'}`;
          resultDiv.style.borderRadius = '8px';
          
          resultDiv.innerHTML = `
            <h4>${hasAudio ? '✅ Audio Detected!' : '⚠️ Audio Detection Inconclusive'}</h4>
            <p><strong>Video Duration:</strong> ${testVideo.duration.toFixed(2)} seconds</p>
            <p><strong>Video Dimensions:</strong> ${testVideo.videoWidth} x ${testVideo.videoHeight}</p>
            <p><strong>File Size:</strong> ${((mediaData.fileSize || 0) / 1024).toFixed(1)} KB</p>
            <p><strong>MIME Type:</strong> ${mediaData.mimeType}</p>
            <p style="margin-top: 10px;"><strong>🔊 IMPORTANT:</strong> Play the video above to manually verify audio is working. The browser's audio controls should not be grayed out if audio is present.</p>
          `;
          
          if (demoArea) {
            // Remove loading message
            const loadingP = demoArea.querySelector('p');
            if (loadingP) loadingP.remove();
            demoArea.appendChild(resultDiv);
          }
          
          if (hasAudio) {
            console.log('✅ Audio likely detected in video recording');
          } else {
            console.log('⚠️ Audio detection inconclusive - PLEASE PLAY VIDEO TO VERIFY MANUALLY');
          }
        });
        
        testVideo.addEventListener('error', (e) => {
          console.error('❌ Error loading video:', e);
          if (demoArea) {
            demoArea.innerHTML += '<p style="color: red;">Error loading video for playback</p>';
          }
        });
      }
    } else {
      console.log('📝 Text recording:', mediaData.url);
      const demoArea = document.getElementById('demo-result');
      if (demoArea) {
        demoArea.innerHTML = '<h3>📝 Text Recording:</h3><p>' + atob((mediaData.url || '').split(',')[1] || '') + '</p>';
      }
    }
  };

  const handleRecordingError = (error: string) => {
    console.error('Recording error:', error);
    
    const demoArea = document.getElementById('demo-result');
    if (demoArea) {
      demoArea.innerHTML = `<h3>Recording Error:</h3><p style="color: red;">${error}</p>`;
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>MediaRecorder Video+Audio Fix Demo</h1>
      <p>
        This demo tests the fix for video recording without audio. 
        Try recording a video and check the browser console for detailed logs.
      </p>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
        <h3>What to Test:</h3>
        <ul>
          <li>✅ Video preview should show your camera feed (not black box)</li>
          <li>✅ Recording should capture both video and audio</li>
          <li>✅ Playback should have sound</li>
          <li>✅ Console should show detailed recording information</li>
        </ul>
      </div>

      <MediaRecorder
        onRecordingComplete={handleRecordingComplete}
        onRecordingError={handleRecordingError}
        maxDuration={15000} // 15 seconds for demo
        enableCompression={false} // Disable compression for faster testing
      />
      
      <div id="demo-result" style={{ marginTop: '20px' }}>
        {/* Recording result will be displayed here */}
      </div>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h3>Browser Console Output:</h3>
        <p>Open your browser's developer console (F12) to see detailed logging about:</p>
        <ul>
          <li>Media stream setup</li>
          <li>Video and audio track detection</li>
          <li>MediaRecorder configuration</li>
          <li>Recording completion details</li>
        </ul>
      </div>
    </div>
  );
};

export default MediaRecorderDemo;