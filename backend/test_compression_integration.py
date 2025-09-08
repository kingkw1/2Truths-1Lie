#!/usr/bin/env python3
"""
Test script for compression integration in video merge service
"""
import asyncio
import tempfile
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_merge_service import VideoMergeService
from config import settings

async def test_compression_presets():
    """Test different compression presets"""
    print("Testing compression presets...")
    
    merge_service = VideoMergeService()
    
    # Test each preset
    for preset_name in settings.COMPRESSION_QUALITY_PRESETS.keys():
        print(f"\nTesting {preset_name} preset:")
        
        # Get compression settings
        compression_settings = merge_service._get_compression_settings(preset_name)
        
        print(f"  CRF: {compression_settings['crf']}")
        print(f"  Preset: {compression_settings['preset']}")
        print(f"  Max bitrate: {compression_settings['max_bitrate']}")
        print(f"  Audio bitrate: {compression_settings['audio_bitrate']}")
        
        # Verify settings match config
        expected = settings.COMPRESSION_QUALITY_PRESETS[preset_name]
        assert compression_settings['crf'] == expected['crf'], f"CRF mismatch for {preset_name}"
        assert compression_settings['preset'] == expected['preset'], f"Preset mismatch for {preset_name}"
        assert compression_settings['max_bitrate'] == expected['max_bitrate'], f"Bitrate mismatch for {preset_name}"
        
        print(f"  ✓ {preset_name} preset validated")
    
    # Test invalid preset
    print(f"\nTesting invalid preset:")
    invalid_settings = merge_service._get_compression_settings("invalid_preset")
    
    # Should fall back to default settings
    assert invalid_settings['crf'] == settings.VIDEO_COMPRESSION_CRF
    assert invalid_settings['preset'] == settings.VIDEO_COMPRESSION_PRESET
    print(f"  ✓ Invalid preset falls back to defaults")
    
    print("\n✅ All compression preset tests passed!")
    return True

async def test_compression_parameters():
    """Test that compression parameters are properly configured"""
    print("\nTesting compression parameter configuration...")
    
    # Verify all required settings exist
    required_settings = [
        'VIDEO_COMPRESSION_PRESET',
        'VIDEO_COMPRESSION_CRF', 
        'VIDEO_MAX_BITRATE',
        'VIDEO_BUFFER_SIZE',
        'AUDIO_BITRATE',
        'AUDIO_CODEC',
        'VIDEO_CODEC',
        'COMPRESSION_QUALITY_PRESETS'
    ]
    
    for setting_name in required_settings:
        assert hasattr(settings, setting_name), f"Missing setting: {setting_name}"
        print(f"  ✓ {setting_name}: {getattr(settings, setting_name)}")
    
    # Verify presets are properly configured
    presets = settings.COMPRESSION_QUALITY_PRESETS
    assert 'high' in presets, "Missing 'high' quality preset"
    assert 'medium' in presets, "Missing 'medium' quality preset"  
    assert 'low' in presets, "Missing 'low' quality preset"
    
    # Verify preset structure
    for preset_name, preset_config in presets.items():
        required_keys = ['crf', 'preset', 'max_bitrate', 'buffer_size', 'audio_bitrate']
        for key in required_keys:
            assert key in preset_config, f"Missing key '{key}' in preset '{preset_name}'"
        
        # Verify CRF is in valid range (0-51)
        assert 0 <= preset_config['crf'] <= 51, f"Invalid CRF value in preset '{preset_name}'"
        
        print(f"  ✓ {preset_name} preset structure validated")
    
    print("\n✅ All compression parameter tests passed!")
    return True

async def main():
    """Main test function"""
    print("Compression Integration Test Suite")
    print("=" * 50)
    
    try:
        # Test compression presets
        await test_compression_presets()
        
        # Test compression parameters
        await test_compression_parameters()
        
        print("\n🎉 All compression integration tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)