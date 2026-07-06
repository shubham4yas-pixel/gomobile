# Release Notes

## Version 0.1.0-beta (Current)
*Targeting initial closed beta release*

### Sprints Completed

**1. Project Setup & Architecture**
- Unified Expo project configured to build two variants (`rider` and `driver`) from the same codebase using `EXPO_PUBLIC_APP_VARIANT`.
- Custom `theme.ts` implemented with `Inter` typography, robust color palettes (`navy`, `gold`), and shadow definitions.
- Initialised Firebase integration and React Context providers.

**2. Authentication**
- Complete Phone Authentication flow (OTP).
- Shared `login` and `complete-profile` screens.
- Secure Firebase session management.

**3. Maps & Locations**
- Integrated `react-native-maps` for both iOS and Android (and `react-native-web` for testing).
- Real-time geolocation tracking and map centering.
- Integrated Google Maps Directions API for drawing route polylines.

**4. Driver Matching (Socket.IO)**
- Established robust bidirectional Socket.IO communication with the backend.
- Implemented real-time driver broadcasting and rider nearest-driver queries.
- Complete Ride State Machine (`IDLE` -> `OFFERED` -> `ACCEPTED` -> `ARRIVED` -> `IN_PROGRESS` -> `COMPLETED`).
- Implemented `SwipeToAccept` gesture for drivers.

**5. Payments & Experience**
- Integrated Razorpay for processing final ride fares.
- Dynamic fare calculation and receipt generation.
- Real-time trip progress indicators and dynamic ETAs.
- Dual rating system (Rider rates Driver, Driver rates Rider) with specific chip feedback.

**6. Beta Stabilisation (Final Pass)**
- Global Error Boundaries implemented to catch and gracefully display React rendering errors.
- Secured all Google Maps API keys via `.env`.
- Audited and stabilised `DriverBottomSheet` for small screens, keyboard interactions, and accessibility.
- Swept repository for UI consistency (migrating to Ionicons and `PressableScale`).
- Comprehensive QA checklist created in `docs/BETA_QA_CHECKLIST.md`.
