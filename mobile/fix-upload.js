const fs = require('fs');

// Read the current file
let content = fs.readFileSync('src/services/uploadService.ts', 'utf8');

// Replace FormData approach with JSON approach in _uploadVideoAttempt method
content = content.replace(
  /\/\/ Create a proper FormData with base64 data[\s\S]*?body: formData,/,
  `// Create JSON payload for base64 upload
      const uploadPayload = {
        filename: filename || 'video.mp4',
        contentType: 'video/mp4',
        fileContent: base64Data,
      };

      onProgress?.({ stage: 'uploading', progress: 20, startTime });

      const uploadUrl = \`\${this.baseUrl}/api/v1/s3-media/upload-base64\`;

      // Create timeout promise
      const timeoutMs = options?.timeout || 60000;
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(\`Upload timeout after \${timeoutMs}ms\`));
        }, timeoutMs);
        
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(uploadUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadPayload),`
);

// Also fix the metadata upload method
content = content.replace(
  /\/\/ Prepare file for upload with metadata[\s\S]*?body: formData,/,
  `// Create JSON payload for base64 upload with metadata
      const uploadPayload = {
        filename: filename || 'video.mp4',
        contentType: 'video/mp4',
        fileContent: base64Data,
        metadata: JSON.stringify(metadata),
      };

      onProgress?.({ stage: 'uploading', progress: 20, startTime });

      const uploadUrl = \`\${this.baseUrl}/api/v1/s3-media/upload-base64\`;

      // Upload directly to S3 endpoint with timeout
      
      // Create timeout promise
      const timeoutMs = options?.timeout || 60000;
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(\`Upload timeout after \${timeoutMs}ms\`));
        }, timeoutMs);
        
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(uploadUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadPayload),`
);

// Write the file back
fs.writeFileSync('src/services/uploadService.ts', content);
console.log('Fixed upload service to use JSON payload instead of FormData');