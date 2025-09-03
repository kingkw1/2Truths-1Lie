"""
CDN Service - Global content delivery network integration with signed URL support
"""
import os
import json
import time
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, urljoin
import logging

try:
    import boto3
    from botocore.exceptions import ClientError
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logging.warning("CDN crypto dependencies not available. Install with: pip install boto3 cryptography")

logger = logging.getLogger(__name__)

class CDNError(Exception):
    """Base exception for CDN operations"""
    pass

class CDNService:
    """Content Delivery Network service for global scalable delivery"""
    
    def __init__(
        self,
        cdn_base_url: Optional[str] = None,
        distribution_id: Optional[str] = None,
        private_key_path: Optional[str] = None,
        key_pair_id: Optional[str] = None,
        cache_control: str = "public, max-age=86400",
        signed_url_expiry: int = 7200
    ):
        self.cdn_base_url = cdn_base_url
        self.distribution_id = distribution_id
        self.private_key_path = private_key_path
        self.key_pair_id = key_pair_id
        self.cache_control = cache_control
        self.signed_url_expiry = signed_url_expiry
        
        # Initialize CloudFront client if available
        self.cloudfront_client = None
        if CRYPTO_AVAILABLE and distribution_id:
            try:
                self.cloudfront_client = boto3.client('cloudfront')
                logger.info(f"CloudFront CDN initialized: {distribution_id}")
            except Exception as e:
                logger.error(f"Failed to initialize CloudFront client: {e}")
        
        # Load private key for signed URLs
        self.private_key = None
        if private_key_path and os.path.exists(private_key_path):
            try:
                with open(private_key_path, 'rb') as key_file:
                    self.private_key = serialization.load_pem_private_key(
                        key_file.read(),
                        password=None
                    )
                logger.info("CDN private key loaded for signed URLs")
            except Exception as e:
                logger.error(f"Failed to load CDN private key: {e}")
    
    def is_enabled(self) -> bool:
        """Check if CDN is properly configured and enabled"""
        return bool(self.cdn_base_url and CRYPTO_AVAILABLE)
    
    def get_cdn_url(self, s3_key: str, bucket_name: str = None) -> str:
        """Convert S3 key to CDN URL"""
        if not self.cdn_base_url:
            return None
        
        # Remove bucket name from key if present
        if bucket_name and s3_key.startswith(f"{bucket_name}/"):
            s3_key = s3_key[len(bucket_name)+1:]
        
        # Ensure key doesn't start with /
        s3_key = s3_key.lstrip('/')
        
        # Construct CDN URL
        cdn_url = urljoin(self.cdn_base_url.rstrip('/') + '/', s3_key)
        return cdn_url
    
    def create_signed_url(
        self,
        s3_key: str,
        expires_in: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[str]:
        """Create CloudFront signed URL with optional IP and user agent restrictions"""
        
        if not self.is_enabled() or not self.private_key or not self.key_pair_id:
            logger.warning("CDN signed URLs not available - missing configuration")
            return None
        
        try:
            # Get CDN URL
            cdn_url = self.get_cdn_url(s3_key)
            if not cdn_url:
                return None
            
            # Calculate expiration time
            expires_in = expires_in or self.signed_url_expiry
            expire_time = int(time.time()) + expires_in
            
            # Create policy for signed URL
            policy = {
                "Statement": [
                    {
                        "Resource": cdn_url,
                        "Condition": {
                            "DateLessThan": {
                                "AWS:EpochTime": expire_time
                            }
                        }
                    }
                ]
            }
            
            # Add IP address restriction if provided
            if ip_address:
                policy["Statement"][0]["Condition"]["IpAddress"] = {
                    "AWS:SourceIp": ip_address
                }
            
            # Convert policy to JSON and encode
            policy_json = json.dumps(policy, separators=(',', ':'))
            policy_b64 = base64.b64encode(policy_json.encode()).decode()
            policy_b64 = policy_b64.replace('+', '-').replace('=', '_').replace('/', '~')
            
            # Sign the policy
            signature = self.private_key.sign(
                policy_json.encode(),
                padding.PKCS1v15(),
                hashes.SHA1()
            )
            signature_b64 = base64.b64encode(signature).decode()
            signature_b64 = signature_b64.replace('+', '-').replace('=', '_').replace('/', '~')
            
            # Construct signed URL
            separator = '&' if '?' in cdn_url else '?'
            signed_url = f"{cdn_url}{separator}Policy={policy_b64}&Signature={signature_b64}&Key-Pair-Id={self.key_pair_id}"
            
            logger.info(f"Created CDN signed URL for {s3_key}, expires in {expires_in}s")
            return signed_url
            
        except Exception as e:
            logger.error(f"Failed to create CDN signed URL for {s3_key}: {e}")
            return None
    
    def create_canned_signed_url(
        self,
        s3_key: str,
        expires_in: Optional[int] = None
    ) -> Optional[str]:
        """Create simple canned CloudFront signed URL (no custom policy)"""
        
        if not self.is_enabled() or not self.private_key or not self.key_pair_id:
            return None
        
        try:
            # Get CDN URL
            cdn_url = self.get_cdn_url(s3_key)
            if not cdn_url:
                return None
            
            # Calculate expiration time
            expires_in = expires_in or self.signed_url_expiry
            expire_time = int(time.time()) + expires_in
            
            # Create signature for canned policy
            message = f"GET\n\n\n{expire_time}\n{cdn_url}"
            signature = self.private_key.sign(
                message.encode(),
                padding.PKCS1v15(),
                hashes.SHA1()
            )
            signature_b64 = base64.b64encode(signature).decode()
            signature_b64 = signature_b64.replace('+', '-').replace('=', '_').replace('/', '~')
            
            # Construct signed URL
            separator = '&' if '?' in cdn_url else '?'
            signed_url = f"{cdn_url}{separator}Expires={expire_time}&Signature={signature_b64}&Key-Pair-Id={self.key_pair_id}"
            
            logger.info(f"Created CDN canned signed URL for {s3_key}, expires in {expires_in}s")
            return signed_url
            
        except Exception as e:
            logger.error(f"Failed to create CDN canned signed URL for {s3_key}: {e}")
            return None
    
    async def invalidate_cache(self, paths: List[str]) -> bool:
        """Invalidate CDN cache for specified paths"""
        
        if not self.cloudfront_client or not self.distribution_id:
            logger.warning("CDN cache invalidation not available")
            return False
        
        try:
            # Ensure paths start with /
            formatted_paths = [f"/{path.lstrip('/')}" for path in paths]
            
            # Create invalidation
            response = self.cloudfront_client.create_invalidation(
                DistributionId=self.distribution_id,
                InvalidationBatch={
                    'Paths': {
                        'Quantity': len(formatted_paths),
                        'Items': formatted_paths
                    },
                    'CallerReference': f"invalidation-{int(time.time())}"
                }
            )
            
            invalidation_id = response['Invalidation']['Id']
            logger.info(f"CDN cache invalidation created: {invalidation_id} for {len(paths)} paths")
            return True
            
        except ClientError as e:
            logger.error(f"CDN cache invalidation failed: {e}")
            return False
    
    async def get_distribution_info(self) -> Optional[Dict[str, Any]]:
        """Get CDN distribution information"""
        
        if not self.cloudfront_client or not self.distribution_id:
            return None
        
        try:
            response = self.cloudfront_client.get_distribution(Id=self.distribution_id)
            distribution = response['Distribution']
            
            return {
                "id": distribution['Id'],
                "domain_name": distribution['DomainName'],
                "status": distribution['Status'],
                "enabled": distribution['DistributionConfig']['Enabled'],
                "origins": [
                    {
                        "id": origin['Id'],
                        "domain_name": origin['DomainName'],
                        "origin_path": origin.get('OriginPath', '')
                    }
                    for origin in distribution['DistributionConfig']['Origins']['Items']
                ],
                "cache_behaviors": len(distribution['DistributionConfig']['CacheBehaviors']['Items']),
                "price_class": distribution['DistributionConfig']['PriceClass'],
                "last_modified": distribution['LastModifiedTime'].isoformat()
            }
            
        except ClientError as e:
            logger.error(f"Failed to get CDN distribution info: {e}")
            return None
    
    def get_edge_location_for_region(self, region: str) -> str:
        """Get optimal CDN edge location for a given region"""
        
        # Mapping of AWS regions to optimal CloudFront edge locations
        edge_mapping = {
            "us-east-1": "IAD",      # Washington DC
            "us-east-2": "CMH",      # Columbus
            "us-west-1": "SFO",      # San Francisco
            "us-west-2": "SEA",      # Seattle
            "eu-west-1": "DUB",      # Dublin
            "eu-west-2": "LHR",      # London
            "eu-central-1": "FRA",   # Frankfurt
            "ap-southeast-1": "SIN", # Singapore
            "ap-southeast-2": "SYD", # Sydney
            "ap-northeast-1": "NRT", # Tokyo
            "ap-northeast-2": "ICN", # Seoul
            "sa-east-1": "GRU",      # São Paulo
        }
        
        return edge_mapping.get(region, "IAD")  # Default to US East
    
    def optimize_delivery_for_device(
        self,
        s3_key: str,
        user_agent: Optional[str] = None,
        client_ip: Optional[str] = None,
        device_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Optimize content delivery based on device and location"""
        
        optimization = {
            "cdn_url": self.get_cdn_url(s3_key),
            "cache_control": self.cache_control,
            "optimizations": []
        }
        
        # Device-specific optimizations
        if device_type:
            if device_type.lower() in ['mobile', 'tablet']:
                optimization["cache_control"] = "public, max-age=43200"  # 12 hours for mobile
                optimization["optimizations"].append("mobile_cache_optimization")
            elif device_type.lower() == 'desktop':
                optimization["cache_control"] = "public, max-age=86400"  # 24 hours for desktop
                optimization["optimizations"].append("desktop_cache_optimization")
        
        # User agent based optimizations
        if user_agent:
            user_agent_lower = user_agent.lower()
            if 'mobile' in user_agent_lower or 'android' in user_agent_lower or 'iphone' in user_agent_lower:
                optimization["optimizations"].append("mobile_user_agent_detected")
                # Suggest adaptive bitrate streaming for mobile
                optimization["suggested_formats"] = ["video/mp4", "video/webm"]
            elif 'chrome' in user_agent_lower:
                optimization["optimizations"].append("chrome_optimization")
                optimization["suggested_formats"] = ["video/webm", "video/mp4"]
            elif 'safari' in user_agent_lower:
                optimization["optimizations"].append("safari_optimization")
                optimization["suggested_formats"] = ["video/mp4", "video/quicktime"]
        
        # Geographic optimization (simplified)
        if client_ip:
            # In a real implementation, you'd use a GeoIP service
            optimization["optimizations"].append("geographic_routing")
            optimization["suggested_edge"] = "auto"
        
        return optimization
    
    def get_analytics_data(self, start_date: datetime, end_date: datetime) -> Optional[Dict[str, Any]]:
        """Get CDN analytics data for the specified date range"""
        
        if not self.cloudfront_client or not self.distribution_id:
            return None
        
        try:
            # Get distribution statistics
            response = self.cloudfront_client.get_distribution_config(Id=self.distribution_id)
            
            # In a real implementation, you'd use CloudWatch or CloudFront real-time logs
            # This is a simplified version
            return {
                "distribution_id": self.distribution_id,
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "metrics": {
                    "requests": "N/A - Requires CloudWatch integration",
                    "bytes_downloaded": "N/A - Requires CloudWatch integration",
                    "cache_hit_rate": "N/A - Requires CloudWatch integration",
                    "origin_latency": "N/A - Requires CloudWatch integration"
                },
                "top_countries": [],
                "top_referrers": [],
                "error_rate": "N/A - Requires CloudWatch integration"
            }
            
        except ClientError as e:
            logger.error(f"Failed to get CDN analytics: {e}")
            return None

# Factory function to create CDN service
def create_cdn_service(
    cdn_base_url: Optional[str] = None,
    distribution_id: Optional[str] = None,
    private_key_path: Optional[str] = None,
    key_pair_id: Optional[str] = None,
    **kwargs
) -> Optional[CDNService]:
    """Factory function to create CDN service"""
    
    if not cdn_base_url:
        logger.info("CDN not configured - CDN_BASE_URL not provided")
        return None
    
    if not CRYPTO_AVAILABLE:
        logger.warning("CDN crypto dependencies not available")
        return None
    
    return CDNService(
        cdn_base_url=cdn_base_url,
        distribution_id=distribution_id,
        private_key_path=private_key_path,
        key_pair_id=key_pair_id,
        **kwargs
    )