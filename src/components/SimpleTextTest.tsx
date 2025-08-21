/**
 * Simple Text Input Test Component
 * Tests basic text input without Redux to isolate the issue
 */

import React, { useState } from 'react';

export const SimpleTextTest: React.FC = () => {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [text3, setText3] = useState('');

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#FFF3CD',
      border: '2px solid #FFC107',
      borderRadius: '8px',
      margin: '20px 0'
    }}>
      <h3>🧪 Text Input Test (No Redux)</h3>
      <p>Type in these boxes to test if spaces work correctly:</p>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Test 1:</label>
        <textarea
          value={text1}
          onChange={(e) => setText1(e.target.value)}
          placeholder="Type something with spaces here..."
          style={{
            width: '100%',
            padding: '8px',
            margin: '5px 0',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
          rows={2}
        />
        <div>Length: {text1.length} | Content: "{text1}"</div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>Test 2:</label>
        <textarea
          value={text2}
          onChange={(e) => setText2(e.target.value)}
          placeholder="Type something with spaces here..."
          style={{
            width: '100%',
            padding: '8px',
            margin: '5px 0',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
          rows={2}
        />
        <div>Length: {text2.length} | Content: "{text2}"</div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>Test 3:</label>
        <textarea
          value={text3}
          onChange={(e) => setText3(e.target.value)}
          placeholder="Type something with spaces here..."
          style={{
            width: '100%',
            padding: '8px',
            margin: '5px 0',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
          rows={2}
        />
        <div>Length: {text3.length} | Content: "{text3}"</div>
      </div>

      <div style={{
        padding: '10px',
        backgroundColor: '#E7F3FF',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>Debug Info:</strong>
        <br />Text 1: {JSON.stringify(text1)}
        <br />Text 2: {JSON.stringify(text2)}
        <br />Text 3: {JSON.stringify(text3)}
      </div>
    </div>
  );
};

export default SimpleTextTest;