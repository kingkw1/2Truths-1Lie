// Simple test to verify test setup works
describe('Device Test Setup', () => {
  it('can access global test variables', () => {
    global.__TEST_SCENARIO__ = 'SETUP_TEST';
    expect(global.__TEST_SCENARIO__).toBe('SETUP_TEST');
  });

  it('can mock React Native modules', () => {
    const { Platform } = require('react-native');
    expect(Platform).toBeDefined();
    expect(Platform.OS).toBe('ios');
  });

  it('can mock Expo modules', () => {
    const Camera = require('expo-camera');
    expect(Camera.CameraView).toBeDefined();
    expect(Camera.useCameraPermissions).toBeDefined();
  });

  it('can set device scenarios', () => {
    global.__DEVICE_SCENARIO__ = 'IPHONE_13';
    global.__CAMERA_PERMISSION_GRANTED__ = true;
    
    expect(global.__DEVICE_SCENARIO__).toBe('IPHONE_13');
    expect(global.__CAMERA_PERMISSION_GRANTED__).toBe(true);
  });
});