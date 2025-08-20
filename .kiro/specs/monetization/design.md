# Monetization - Design

## Architecture

- Frontend integrated with RevenueCat for purchase flows  
- Backend verifies and tracks purchase states  
- Feature gating based on purchase status  
- Admin APIs to manage promo codes and track usage

## Data Flow

1. User initiates purchase → RevenueCat processes payment  
2. App receives purchase receipt and verifies with backend  
3. Backend updates user profile with entitlement/access rights  
4. Frontend unlocks premium features and cosmetics accordingly
