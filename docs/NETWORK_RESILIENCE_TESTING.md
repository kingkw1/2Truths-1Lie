# Network Resilience Testing Guide

## Quick Start Testing

### 1. Import the Components in Your App

Add to your main App.tsx or component:

```typescript
import { NetworkResilientCameraRecorder } from './src/components/NetworkResilientCameraRecorder';
import { NetworkResilienceDemo } from './src/demos/NetworkResilienceDemo';
import { networkResilienceService } from './src/services/networkResilienceService';
```

### 2. Add Network Monitoring to Your App

```typescript
import { useNetwork } from './src/hooks/useNetwork';

function App() {
  const {
    isOnline,
    connectionStrength,
    offlineQueueLength,
    shouldShowOfflineIndicator,
    shouldShowPoorConnectionWarning
  } = useNetwork();

  return (
    <View>
      {/* Network Status Indicator */}
      {shouldShowOfflineIndicator && (
        <View style={{ backgroundColor: 'red', padding: 10 }}>
          <Text style={{ color: 'white' }}>
            📴 Offline - {offlineQueueLength} items queued
          </Text>
        </View>
      )}
      
      {shouldShowPoorConnectionWarning && (
        <View style={{ backgroundColor: 'orange', padding: 10 }}>
          <Text style={{ color: 'white' }}>
            ⚠️ Poor connection - uploads may be slower
          </Text>
        </View>
      )}

      {/* Your existing app content */}
      <YourExistingContent />
    </View>
  );
}
```

### 3. Test Network Resilience Features

#### Test Scenario 1: Retry Logic
```typescript
// This will automatically retry failed requests
const testRetryLogic = async () => {
  try {
    const response = await networkResilienceService.resilientFetch(
      'https://httpbin.org/status/500', // Returns 500 error
      { method: 'GET' },
      'api'
    );
    console.log('Success after retries:', response);
  } catch (error) {
    console.log('Failed after all retries:', error);
  }
};
```

#### Test Scenario 2: Offline Queue
```typescript
import { useAppDispatch } from './src/store/hooks';
import { addToOfflineQueue } from './src/store/slices/networkSlice';

const testOfflineQueue = () => {
  const dispatch = useAppDispatch();
  
  // Add a request to offline queue
  dispatch(addToOfflineQueue({
    id: 'test-upload-' + Date.now(),
    url: 'https://httpbin.org/post',
    options: {
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    },
    priority: 'high',
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: 3
  }));
};
```

#### Test Scenario 3: Network Health Monitoring
```typescript
const testNetworkHealth = () => {
  const metrics = networkResilienceService.getNetworkMetrics();
  console.log('Network Health:', {
    latency: metrics.latency + 'ms',
    bandwidth: metrics.bandwidth.toFixed(1) + ' Mbps',
    stability: (metrics.stability * 100).toFixed(1) + '%'
  });
};
```

### 4. Manual Testing Steps

#### Test Poor Network Conditions:
1. **Enable Airplane Mode** to test offline behavior
2. **Use Network Conditioner** (iOS) or **Network throttling** (Android dev tools)
3. **Interrupt network** during uploads to test retry logic
4. **Switch between WiFi/Cellular** to test connection changes

#### Expected Behaviors:
- ✅ **Automatic retries** when network requests fail
- ✅ **Queue requests** when offline
- ✅ **Process queue** automatically when back online
- ✅ **Show user feedback** for poor connections
- ✅ **Adapt video quality** based on connection strength

### 5. Debug Network Issues

Enable detailed logging:

```typescript
// Add to your app initialization
networkResilienceService.addNetworkListener((state) => {
  console.log('Network State Changed:', {
    connected: state.isConnected,
    type: state.type,
    strength: state.strength,
    bandwidth: state.bandwidth
  });
});
```

### 6. Camera Component Usage

```typescript
import { NetworkResilientCameraRecorder } from './src/components/NetworkResilientCameraRecorder';

function CameraScreen() {
  const [showCamera, setShowCamera] = useState(false);

  return (
    <View>
      <Button 
        title="Record Video" 
        onPress={() => setShowCamera(true)} 
      />
      
      <NetworkResilientCameraRecorder
        statementIndex={0}
        isVisible={showCamera}
        onRecordingComplete={(uri, duration) => {
          console.log('Recording completed:', uri, duration);
          setShowCamera(false);
        }}
        onError={(error) => {
          console.error('Recording error:', error);
          setShowCamera(false);
        }}
        onCancel={() => setShowCamera(false)}
      />
    </View>
  );
}
```

## Performance Monitoring

Monitor the network resilience system performance:

```typescript
// Check queue status
const queueStatus = networkResilienceService.getOfflineQueueStatus();
console.log('Queue Status:', {
  itemCount: queueStatus.itemCount,
  isProcessing: queueStatus.isProcessing,
  lastProcessed: queueStatus.lastProcessed
});

// Get network metrics
const metrics = networkResilienceService.getNetworkMetrics();
console.log('Network Performance:', metrics);
```

## Troubleshooting

### Common Issues:

**Network monitoring not working:**
- Ensure @react-native-community/netinfo is properly installed
- Check permissions for network access
- Restart the app to reinitialize the service

**Queue not processing:**
- Check if network state is properly detected
- Verify Redux store is configured correctly
- Look for JavaScript errors in console

**Camera component errors:**
- Ensure expo-camera permissions are granted
- Check camera availability on device/simulator
- Verify TypeScript imports are correct

### Debug Commands:

```bash
# Check network library installation
npx react-native info

# Clear app data (to test queue persistence)
# iOS: Reset simulator
# Android: Clear app data in settings

# Monitor network in Chrome DevTools
# Enable remote debugging and check Network tab
```

This testing guide will help you validate that all network resilience features are working correctly in various network conditions.
