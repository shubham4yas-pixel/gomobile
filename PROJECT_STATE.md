# 🚗 RideShare Platform — Project State

> **Last Updated:** 2026-06-25

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Mobile Framework** | React Native (Expo Router) | Single codebase for Rider & Driver apps |
| **Language** | TypeScript (mobile), JavaScript (backend) | Type safety on client, simplicity on server |
| **State Management** | Zustand | Lightweight reactive stores for live tracking |
| **Authentication** | Firebase Auth | Email/password authentication |
| **Auth Persistence** | AsyncStorage | Session persistence on native platforms |
| **Maps** | react-native-maps | Interactive MapView with custom markers |
| **Location** | expo-location | GPS permissions and position tracking |
| **Live Backend** | Express + Socket.IO | Real-time WebSocket dispatch server |
| **Bottom Sheets** | @gorhom/bottom-sheet v5 | Premium role/status-driven ride UI |
| **Animations** | react-native-reanimated 4 + react-native-gesture-handler | Worklet-driven gestures (swipe-to-accept, radar) |
| **Routing/Polylines** | react-native-maps-directions | Uber-style route line driver↔pickup↔dropoff |
| **Gradients** | expo-linear-gradient | Vibrant blue CTA buttons |
| **Haptics** | expo-haptics | Tactile feedback on taps, swipes, trip events (`src/lib/haptics.ts`) |
| **User Data** | Firebase Firestore | User profiles, ride history (Future) |
| **Maps API** | Google Maps API | Geocoding, directions (Directions API required for routes) |

## Architecture

- **Single Codebase**: Both Rider and Driver experiences live in one Expo project (`mobile-app/`)
- **Live Backend**: Standalone Node.js server (`backend/`) with Socket.IO for real-time dispatch
- **File-Based Routing**: Expo Router with route groups for auth, app, rider, and driver flows
- **Role Split**: Landing gate screen lets users self-select as Rider or Driver
- **Auth Gating**: Root layout subscribes to `onAuthStateChanged` and redirects based on auth state
- **Dev Bypass**: `devBypassLogin()` action for instant access without Firebase credentials
- **Room Segregation**: Drivers, riders, and admins join separate Socket.IO rooms for targeted broadcasts
- **God Mode**: Web admin dashboard at `/dashboard` (route group `(admin)`, exempt from the auth gate) shows the whole live fleet + trips via the `admin:sync` snapshot
- **Schematic Web Map**: `MapView.web.tsx` is a real coordinate-projecting map (markers + route polylines on a dark grid) — no map dependency; native still uses Google Maps
- **Modular Services**: `src/services/` for auth, location, sockets, and Firebase helpers
- **Reactive State**: `src/store/` for Zustand stores (auth, location, ride)
- **Design System**: `src/theme/theme.ts` centralizes colors, radii, spacing, shadow + typography tokens. **Theme is light/whitish with a vibrant blue (`#2563EB`) primary** and amber driver accent; `idealTextOn()` picks legible text per accent. Maps use a light style (`config/mapStyle.ts`); status bar is dark-on-light.
- **Status-Driven UI**: role + `useRideStore.status` select the bottom-sheet content (idle / confirming / searching / offered / accepted / arrived / in-progress / completed)
- **Destination Flow (Phase 11)**: the rider's idle sheet now hosts an **inline Google Places Autocomplete** (`DestinationSearch`, native) — no separate screen needed. Selecting a result sets `dropoffLocation` (lat/lng + formatted address) and reverse-geocodes the current GPS into `pickupLocation`, transitioning to a **`CONFIRMING`** state: the map draws the pickup→dropoff route, `MapView.Directions` `onReady` fills `routeInfo` (real driving km/min), and the sheet shows an estimated fare + `Confirm RideShare`. The `/destination` pin-drop modal remains as a secondary "set on map" path (also writes `dropoffLocation`). Web uses `DestinationSearch.web.tsx` (Places web service is CORS-blocked in browsers).
- **Notification Layer (Phase 20)**: fully event-driven — ride logic emits domain events into `notificationService` (`src/services/notificationService.ts`); a swappable `NotificationProvider` (local mock today → Expo Push/FCM later, zero UI changes) delivers them. Foreground → glassmorphism banners (`src/components/notifications/`, mounted once as `<NotificationHost />` in the root layout, which also boots the `useNotifications` bridge). Background → expo-notifications with stable identifiers (in-place updates) plus the notifee live ETA chronometer. Stable channel ids (`{tripId}:live`, `{tripId}:payment`, …) mean updates replace, never stack. Quick actions (Call Driver / Message / View Ride) route through `performNotificationAction`; native taps deep-link via the `deepLink` payload. Dev builds expose `__notifications` for test-mode emission.
- **Babel (SDK 54)**: NO `babel.config.js` — `babel-preset-expo` is applied automatically and auto-injects `react-native-worklets/plugin` (Reanimated 4). Adding an explicit preset double-applies it (preset isn't hoisted locally; resolves to a stray `~/node_modules`) and corrupts expo-router's `require.context`. Leave it unset.

## Phase Tracker

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Shared Mobile Framework & UI Scaffold | ✅ Complete |
| **Phase 2** | Authentication Logic & Global State | ✅ Complete |
| **Phase 3** | Maps & Location Tracking | ✅ Complete |
| **Phase 4** | Live Dispatch Server (WebSockets) | ✅ Complete |
| **Phase 5** | Live GPS Broadcasting & Driver Tracking | ✅ Complete |
| **Phase 6** | Ride Matching & Driver Flow | ✅ Complete |
| **Phase 7** | Premium UI & Trip Execution | ✅ Complete |
| **Phase 8** | Web Admin Dashboard ("God Mode") | ✅ Complete |
| **Phase 9** | Post-Trip Flow (Fares & Ratings) | ✅ Complete |
| **Phase 10** | Persistent Storage & Ride History | ✅ Complete |
| **Phase 11** | Google Places & Production Routing | ✅ Complete |
| **Phase 12** | Notifications & High-Fidelity Booking | ✅ Complete |
| **Phase 13** | Payments, Escrow & Ledger | ✅ Complete |
| **Phase 14** | Razorpay Integration, History & Earnings | 🟡 Active (M3 done; Razorpay on hold) |
| **Phase 15** | Real Auth, UPI Collection & UI/UX Overhaul | 🟡 Active |
| **Phase 16** | Auth-First Onboarding, Navy/Gold Theme, Socket Auth + Resync | 🟡 Active |
| **Phase 17** | Two-App Split (Variants) & Premium Design System | 🟡 Active |
| **Phase 18** | Uber-Grade Ride Experience (Navy/Gold, Inter everywhere, motion + haptics) | 🟡 Active |
| **Phase 20** | Live Push Notification System (event-driven, provider-swappable) | ✅ Complete |

## Folder Structure

```
GO/
├── PROJECT_STATE.md
├── mobile-app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── _layout.tsx           # Root layout (auth gatekeeper)
│   │   │   ├── index.tsx             # Landing gate (dev bypass)
│   │   │   ├── (auth)/               # Auth route group
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── rider-login.tsx
│   │   │   │   └── driver-login.tsx
│   │   │   ├── (app)/                # Protected route group
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── map.tsx           # Full-screen MapView + HUD (+ idle History button)
│   │   │   │   ├── destination.tsx   # "Where to?" picker (search + pin), modal
│   │   │   │   ├── history.tsx       # Rider Ride History (date · pickup→dropoff · fare)
│   │   │   │   └── earnings.tsx      # Driver Earnings Dashboard (net after commission)
│   │   │   └── (admin)/              # God Mode (web, no auth gate) → /dashboard
│   │   │       ├── _layout.tsx
│   │   │       └── dashboard.tsx     # Split-screen fleet map + dispatch console
│   │   ├── components/
│   │   │   ├── MapView.tsx           # Native map wrapper (Marker, Polyline, MapDirections)
│   │   │   ├── MapView.web.tsx       # Web schematic map (projects coords; markers + routes)
│   │   │   ├── PaymentProvider.tsx   # Razorpay config context wrapper (Phase 13)
│   │   │   ├── ui/
│   │   │   │   ├── PrimaryButton.tsx # Gradient/accent/outline CTA
│   │   │   │   ├── SearchBar.tsx     # (legacy) tappable "Where to?" entry
│   │   │   │   ├── DestinationSearch.tsx     # Google Places Autocomplete (native, in-sheet)
│   │   │   │   ├── DestinationSearch.web.tsx # Web fallback (device-geocoder search)
│   │   │   │   ├── PickupSelector.tsx        # Pickup mode: current vs search/pin (Phase 12)
│   │   │   │   └── PhoneInput.tsx            # Phone field + isValidPhone/normalizePhone (P12)
│   │   │   ├── trip/
│   │   │   │   ├── RadarPulse.tsx    # Online/searching radar animation
│   │   │   │   ├── DriverProfileCard.tsx # Rider-facing driver + vehicle card
│   │   │   │   └── SwipeToAccept.tsx # Gesture swipe-to-accept (worklets)
│   │   │   └── sheets/
│   │   │       ├── RiderBottomSheet.tsx   # Rider status-driven sheet (+ pickup/booking/call)
│   │   │       └── DriverBottomSheet.tsx  # Driver status-driven sheet (+ rider contact/call)
│   │   ├── hooks/
│   │   │   ├── useAnimatedCoordinate.ts # rAF lerp for smooth driver marker (Phase 12)
│   │   │   ├── usePaymentSheet.ts     # Razorpay checkout + escrow authorize (Phase 13)
│   │   │   └── usePaymentSheet.web.ts # Web simulated-payment shim
│   │   ├── types/
│   │   │   └── react-native-razorpay.d.ts # Ambient types for the native SDK
│   │   ├── theme/
│   │   │   └── theme.ts              # Design tokens (colors, radii, shadows)
│   │   ├── lib/
│   │   │   ├── driverProfile.ts      # Deterministic mock driver profiles
│   │   │   └── earnings.ts           # Driver net-earnings split + Today/Week rollups (P14)
│   │   ├── config/
│   │   │   ├── firebase.ts           # Firebase initialization
│   │   │   └── maps.ts               # Google Maps API key (Directions)
│   │   ├── store/
│   │   │   ├── useAuthStore.ts       # Auth state + dev bypass
│   │   │   ├── useLocationStore.ts   # GPS location state
│   │   │   ├── useRideStore.ts       # Ride lifecycle + trip route
│   │   │   └── useAdminStore.ts      # God Mode fleet/trips snapshot
│   │   └── services/
│   │       ├── authService.ts        # Firebase auth helpers
│   │       ├── locationService.ts    # GPS permission + position
│   │       ├── geocoding.ts          # Places search + device-geocoder fallback
│   │       ├── socketService.ts      # Socket.IO client + trip events (+ phone, push, payment)
│   │       ├── pushService.ts        # Expo push permission + token (Phase 12)
│   │       ├── paymentService.ts     # Payment intent + signature verify (Phase 13)
│   │       └── apiService.ts         # REST helpers (ride history fetch)
│   ├── app.json                      # (no babel.config.js — see Architecture)
│   └── package.json
└── backend/
    ├── server.js                     # Express + Socket.IO dispatch (+ Firestore, push, payments)
    ├── firebase.js                   # Firebase Admin → Firestore: trips, push_tokens, ledger, wallets
    ├── pushService.js                # Expo Push API sender (Phase 12, fire-and-forget)
    ├── razorpay.js                   # Razorpay SDK init + HMAC verify helpers (Phase 13, graceful)
    ├── controllers/
    │   └── paymentController.js      # Intent / verify / webhook + capture-split-ledger engine
    ├── test-client.js                # WebSocket flow verifier
    ├── test-phase{9,11,12,13}.js     # Per-phase verification scripts
    ├── test-phase13-webhook.js       # Signed webhook → Firestore ledger/wallet test
    ├── package.json
    ├── .env                          # PORT, FIREBASE_SERVICE_ACCOUNT, RAZORPAY_* (Phase 13)
    └── .gitignore                    # ignores .env + serviceAccountKey.json
```

## Socket Event Protocol

| Event | Direction | Payload |
|---|---|---|
| _handshake_ | Client → Server | `query: { role, userId, phone }` (phone added Phase 12) |
| `driver:update-location` | Driver → Server | `{ id, lat, lng }` |
| `driver:go-offline` | Driver → Server | — |
| `push:register-token` | Client → Server | `{ token }` (Expo push token, Phase 12) |
| `push:register-fcm-token` | Client → Server | `{ token }` (native FCM token for data-only ETA msgs, Phase 15) |
| `trip:request` | Rider → Server | `{ pickup, dropoff, distanceKm?, durationMin?, bookingFor?, payment? }` (payment = authorized escrow ref, Phase 13) |
| `trip:cancel` | Rider → Server | `{ tripId }` |
| `trip:offered` | Server → Driver | `{ tripId, pickup, dropoff, distanceKm }` |
| `trip:accept` | Driver → Server | `{ tripId }` |
| `trip:reject` | Driver → Server | `{ tripId }` |
| `trip:accepted` | Server → Rider | `{ tripId, driver, driverPhone }` (driverPhone Phase 12) |
| `trip:confirmed` | Server → Driver | `{ tripId, pickup, dropoff, riderPhone, isThirdParty }` (contact Phase 12) |
| `trip:status-update` | Driver → Server | `{ tripId, status, distanceKm?, durationMin? }` (real distance on COMPLETED) |
| `drivers:nearby` | Server → Rider | `[{ id, lat, lng, updatedAt }]` |
| `trip:searching` | Server → Rider | `{ tripId, message }` |
| `trip:status-changed` | Server → Rider | `{ tripId, status }` |
| `trip:eta-update` | Server → Rider | `{ tripId, etaMin, driver: { lat, lng } }` (Phase 15, en-route ticks) |
| `trip:no-drivers` | Server → Rider | `{ tripId }` |
| `trip:offer-expired` | Server → Driver | `{ tripId }` |
| `trip:cancelled` | Server → Rider/Driver | `{ tripId }` |
| `trip:error` | Server → Client | `{ message }` |
| `trip:receipt` | Server → Rider/Driver | `{ tripId, fare, distanceKm, durationMin, baseFare, perKmRate, currency }` |
| `trip:submit-rating` | Rider/Driver → Server | `{ tripId, userId, rating, role }` |
| `admin:sync` | Server → Admin | `{ drivers: [{id,lat,lng,busy,updatedAt}], trips: [...], serverTime }` |
| `trip:resync` | Server → Rider/Driver | `{ tripId, status, pickup, dropoff, driver, counterpartyPhone, isThirdParty }` (on reconnect, Phase 16) |
| `trip:driver-connection` | Server → Rider | `{ tripId, state: 'lost'\|'restored', graceSeconds? }` (mid-trip driver drop, Phase 16) |

> **REST endpoints:** `GET /health`, `GET /api/drivers`, `GET /api/trips`, `GET /api/history/:userId?role=`, and (Phase 13) `POST /api/payments/initialize-intent`, `POST /api/payments/verify-payment`, `POST /api/payments/webhook` (raw body, HMAC-verified — mounted **before** `express.json()`).

> **Admin connection:** the dashboard calls `connectSocket('admin', adminId)` → handshake `query.role = 'admin'` → server joins the `admins` room and pushes `admin:sync` immediately, then on every 3s broadcast tick (only while ≥1 admin is connected).

> **Phase 7 fix:** the rider client previously listened for `trip:status-update`, but the server emits `trip:status-changed` to riders — so live ARRIVED/IN_PROGRESS/COMPLETED updates never reached the rider. Now corrected in `map.tsx`.

## Phase 7 Notes & Known Limitations

- **Driver profile is mocked client-side** (`src/lib/driverProfile.ts`) — the dispatch server only knows a driver's id + coordinates. Deterministic so the same driver looks consistent. Real profiles are a backend follow-up.
- **Directions API**: route drawing uses `react-native-maps-directions` with the Google key in `app.json`. The **Directions API** must be enabled + billed on that key; otherwise `map.tsx` falls back to a straight dashed `Polyline` (handled via `onError`).
- **Post-accept cancel**: the dispatch server only supports cancellation during SEARCHING/OFFERED. The rider's "Cancel Trip" after acceptance resets locally; full post-accept cancellation needs a backend change.
- **Destination search key**: type-to-search calls the Google Places **web service** (autocomplete + details). If the Maps key is restricted to Android apps (SHA-1) or the Places API isn't enabled, those REST calls return `REQUEST_DENIED` and `geocoding.ts` silently falls back to the `expo-location` device geocoder (free, no setup). Pin-on-map always works. For rich POI autocomplete, enable the Places API on an unrestricted (or web-service-allowed) key.
- **Web**: rider/driver maps now render on web too via the schematic `MapView.web.tsx` (was a "Native Maps Only" shim); native still uses Google Maps. Bottom sheets, gestures, and animations render on web.

## Phase 8 Notes & Known Limitations

- **God Mode performance**: `admin:sync` is gated on `hasAdmins()` and piggybacks the existing 3s broadcast tick — zero cost when no dispatcher is watching, one serialization fanned out to the `admins` room. `getTripsList()` strips the non-serializable `offerTimeout` handle. Scale path (not built): deltas, viewport/geohash filtering, lower admin cadence.
- **No auth on `/dashboard`** (intentional for now) — the `(admin)` route group is exempted from the root auth gate. Add real admin auth before exposing publicly.
- **Schematic map**: the web map is a coordinate-projection "ops radar" (uniform-scale lat/lng → x/y on a dark grid), not real streets. Driver markers + straight pickup→dropoff route lines. The dashboard auto-frames the fleet when the driver/trip set changes and offers a **Recenter** control.
- **Verified**: `tsc` clean; `expo export --platform web` succeeds with `/dashboard` as a static route; backend `admin:sync` confirmed via socket test (immediate + interval, `busy` flag, serializable trips). Smoke-tested in the browser at `http://localhost:8081` → `/dashboard`.

## Phase 9 Notes & Known Limitations

- **Fare formula**: `fare = $3.00 base + (distanceKm × $1.50)`. `distanceKm` is the **real** straight-line haversine between the trip's pickup and dropoff (server already had `haversineDistance()`); `durationMin` is **simulated** from an assumed 28 km/h city average (no live ETA source yet). Config lives at the top of `backend/server.js` (`BASE_FARE`, `PER_KM_RATE`, `AVG_SPEED_KMH`).
- **Receipt-driven completion**: on `COMPLETED`, the server emits one `trip:receipt` to **both** the driver and rider sockets (computed once). The previous 3–3.5s auto-dismiss in `map.tsx` is **removed** — the rider stays on the receipt + 5-star card and the driver on the earnings + rate-rider card until they tap **Submit & Done** / **Go Online**, which fires `trip:submit-rating` and calls `useRideStore.resetRide()` → IDLE.
- **Ratings are log-only**: the server's `trip:submit-rating` handler just `console.log`s the rating (it must not assume the trip still exists — trips are cleaned up ~5s after `COMPLETED`). Persisting ratings to a driver/rider profile is a backend follow-up.
- **Driver earnings = full fare** (no platform commission split yet) — matches the spec's "You earned $X.XX". A take-rate is a one-line change in the earnings card / a backend split later.
- **Stars**: shared `src/components/trip/StarRating.tsx` (Ionicons via `@expo/vector-icons`), pre-selected at 5★ (Uber-style one-tap done), tappable to lower; selection haptic per tap. Renders on web + native.

## Phase 10 Notes & Known Limitations

- **Firestore persistence (graceful)**: `backend/firebase.js` initializes the Firebase Admin SDK and exports `{ db, isFirestoreConfigured }`. Credentials resolve from `FIREBASE_SERVICE_ACCOUNT` (a path to the key file **or** inline JSON) or the standard `GOOGLE_APPLICATION_CREDENTIALS`. **If none resolve, the server logs one warning and runs exactly as before** — all Firestore reads/writes become no-ops (mirrors the client's `isConfigured` idiom). The service-account key is gitignored and never committed.
- **`completed_trips` collection** — **doc id = `tripId`**. Fields: `tripId, riderId, driverId, fare, distanceKm, durationMin, currency, pickup, dropoff, date` (ISO), `createdAtMs, status, rating, riderRating`. `riderId`/`driverId` are the queryable keys.
- **Two-step, timing-safe write**: there is no `trip:complete` event — completion is the `COMPLETED` branch of `trip:status-update`, which writes the full doc with `rating: null` (so the trip persists even if no one rates). The later `trip:submit-rating` does a `doc(tripId).set({…}, { merge: true })` keyed by `tripId`, so it works even though the in-memory trip is cleaned up ~5s after `COMPLETED`. Both writes are **fire-and-forget with `.catch()`** — Firestore never blocks the live socket flow or the receipt emit.
- **Dual ratings (two-sided accountability)**: `rating` = the **rider's** score of the driver; `riderRating` = the **driver's** score of the rider. Stored separately, never collapsed.
- **`GET /api/history/:userId?role=rider|driver`** — `role=rider` queries `riderId`, `role=driver` queries `driverId` (no role → both, deduped). Results are **sorted by `date` desc in JS** to avoid a Firestore composite-index requirement. Returns `[]` (200) when Firestore is unconfigured or the user has no trips.
- **Frontend**: `src/services/apiService.ts` → `fetchRideHistory(userId, role)` (returns `[]` on any failure, never throws into the UI). `src/app/(app)/history.tsx` fetches on mount via the `useAuthStore` uid + role; rider view shows date · driver name · fare paid, driver view shows date · distance · fare earned. A premium History icon (top-right of the map HUD) appears **only in the `IDLE` state** → `router.push('/history')`.
- **Dev-bypass uids are ephemeral**: `devBypassLogin()` mints `dev-<role>-<Date.now()>`, so history won't persist across dev sessions. Real Firebase Auth (stable `uid`) or a seeded id is needed to see saved trips. Driver display names come from the deterministic `getDriverProfile(driverId)` mock (the backend only stores ids).

## Phase 11 Notes & Known Limitations

- **Inline Places Autocomplete**: `react-native-google-places-autocomplete` (v2.6.4, pure-JS → Expo Go-compatible) lives **inside** the rider's bottom sheet. The dropdown-clipping bug is avoided structurally: `textInputProps.InputComp = BottomSheetTextInput` (keyboard/focus integration), `disableScroll` (predictions render **in-flow**, not as a floating absolutely-positioned list), an in-flow `listView` style, and `keyboardShouldPersistTaps="handled"`. The sheet uses `keyboardBehavior="interactive"` + `keyboardBlurBehavior="restore"` and `expand()`s on focus to keep results above the keyboard. **Documented fallback if a device still clips:** `@gorhom/portal` (`PortalProvider` + `<Portal>` around the list). No portal is used today.
- **API key**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (in gitignored `mobile-app/.env`) is read by `config/maps.ts` (env → app.json → dev fallback) and powers Places Autocomplete + Place Details + Directions. Requires **Places API + Directions API** enabled/billed on the key.
- **`CONFIRMING` is a client-only status** (not in the union the server sees). Flow: IDLE → select place → `CONFIRMING` (review route + fare) → Confirm → `SEARCHING`. The store holds `pickupLocation`/`dropoffLocation` as `{ latitude, longitude, formattedAddress }` (matches react-native-maps coordinates) and `routeInfo` (`{distanceKm,durationMin}`); the legacy `destination` field was migrated to `dropoffLocation`. **The socket wire format + `server.js` stay `{lat,lng}`** — `map.tsx` converts `LocatedPlace → {lat,lng}` only at the `emitTripRequest` boundary, so the backend/protocol/fare path is untouched by the client contract.
- **Real fares from driving distance**: `MapView.Directions.onReady` yields `result.distance` (km) + `result.duration` (min). The rider's `CONFIRMING` preview captures it into `routeInfo` and sends it with `trip:request`; the driver captures the **first `IN_PROGRESS` reading** (driver ≈ pickup) and sends it at completion. `computeFare(pickup, dropoff, realKm?, realMin?)` prefers the driver's value → the rider's request estimate → **haversine fallback**. So web (schematic map, `onReady.distance = 0`) and Directions-API-off both degrade gracefully to the Phase 9 straight-line fare.
- **Cost-efficiency**: the autocomplete uses `minLength={2}` + `debounce={250}` and a rotating **Places session token** (`query.sessiontoken` + `GooglePlacesDetailsQuery.sessiontoken`, regenerated after each pick) so all keystrokes + the final Place Details lookup bill as **one** session. The driver captures only the **first** `IN_PROGRESS` Directions reading (no repeated billable recomputes).
- **Units stay metric (km)** to match the existing receipt UI; a km→mi switch would touch only the fare display + estimate label.
- **Web search is best-effort**: `DestinationSearch.web.tsx` reuses `geocoding.searchPlaces()` (device-geocoder fallback) since the Google Places *web service* is CORS-blocked in browsers — same limitation noted in Phase 7. Native is the primary, fully-functional path.

## Phase 12 Notes & Known Limitations

- **Flexible pickup (Task 1)**: the rider's idle sheet now leads with a **`PickupSelector`** — two explicit modes (`pickupMode: 'current' | 'custom'` in `useRideStore`). The old silent "pickup = current GPS" is gone; "Use current location" reverse-geocodes the GPS **on tap**, "Search / drop pin" reveals a Places search **and** a **draggable blue pin** on the map (`<Marker draggable onDragEnd>` → `reverseGeocode` → `setPickupLocation`). Pins are visually distinct: **pickup = blue 👤**, **destination/dropoff = green 🏁**. "Change destination" now preserves the chosen pickup + booking selection (only clears the dropoff).
- **Book for someone else (Task 2)**: a `Switch` ("Booking for someone else?") in the idle sheet expands a `PhoneInput`. State lives in `useRideStore.bookingFor = { isThirdParty, riderPhoneNumber }`, validated (`isValidPhone`, ≥7 digits) before confirm and sent on `trip:request`. The server normalizes it (a third-party booking **must** carry a non-empty phone, else it's treated as a self-booking) and writes it onto the trip + the Firestore `completed_trips` doc (`bookingFor`, defaults `{ isThirdParty:false, riderPhoneNumber:null }`).
- **Mutual contact exchange (Task 3)**: phone numbers are collected at **sign-up** (rider/driver login screens, persisted per-uid in AsyncStorage `phone:<uid>`, re-hydrated on login + on a restored Firebase session) and ride along in the socket **handshake** (`query.phone`). On `trip:accept` the server returns `driverPhone` to the rider (`trip:accepted`) and `riderPhone` to the driver (`trip:confirmed`) — for a third-party booking the driver gets the **passenger's** number, never the booker's account number. Both sheets show a **Call** button → `Linking.openURL('tel:…')`. Dev-bypass users get mock numbers so the flow demos end-to-end.
- **Live driver sync (Task 4)**: while the trip is active the assigned driver's marker is smoothed by `useAnimatedCoordinate` — a dependency-free **rAF easeOut lerp** that eases the rendered coordinate between the ~3s `drivers:nearby` ticks so the car glides instead of teleporting. It returns plain numeric coords, so the **same `<Marker>` works on native and the web schematic map** (no react-native-maps `AnimatedRegion` / wrapper changes). The drawn route origin follows the smoothed coordinate too.
- **Push notifications (Task 5)**: `expo-notifications` + `expo-device`. Client `services/pushService.ts` requests permission, fetches the `ExpoPushToken`, and registers it via `push:register-token`; the server stores it (`firebase.js` → Firestore `push_tokens/{userId}` with an in-memory fallback) and sends through the **Expo Push API** (`pushService.js`, `https://exp.host/--/api/v2/push/send`, fire-and-forget) on **driver accept** ("Your driver is on the way! 🚗") and **arrival** ("Your driver has arrived…").
- **⚠️ Remote push needs a dev build**: Expo Go on SDK 53+ **dropped remote push** — `getExpoPushTokenAsync()` fails there, so the whole path **degrades gracefully** (returns `null`, logs one line, app keeps working). To actually receive pushes, run a development build (`npx expo run:ios` / EAS dev client) on a **physical device**. Foreground notifications are surfaced via `setNotificationHandler`.

## Phase 13 Notes & Known Limitations

- **Gateway = Razorpay, escrow model**: orders are created with `payment_capture: 0` (authorize/hold) on `POST /api/payments/initialize-intent`; funds are **captured at trip COMPLETED** in `paymentController.captureAndSettle()`. Native checkout via `react-native-razorpay` (`usePaymentSheet.ts`); the rider authorizes the **estimated** fare before `trip:request` is broadcast. The authorized `{ orderId, paymentId }` rides in the `trip:request` payload and is stored on the trip for capture.
- **Strict cryptographic validation**: after checkout, the client posts the `{ order_id, payment_id, signature }` triple to `POST /api/payments/verify-payment`, which recomputes `HMAC-SHA256(order_id|payment_id, KEY_SECRET)` and compares **timing-safe** before the ride is allowed to broadcast. Webhooks (`POST /api/payments/webhook`) verify `X-Razorpay-Signature` against the **raw** body (mounted with `express.raw` **before** `express.json()`).
- **Split engine + immutable ledger**: `computeSplit(gross)` → `gatewayFee = 2% `, `platformFee = 20%`, `driverNet = gross − fees` (floored at 0). On COMPLETED the server captures, then `writeLedgerEntry()` does a **`.create()` keyed by tripId** (immutable + idempotent — a duplicate settlement throws `ALREADY_EXISTS` and is skipped, so no double-write/double-credit), and `creditDriverWallet()` does an atomic `FieldValue.increment(driverNet)` on `wallets/{driverId}`. **`transaction_ledger/{tripId}`** fields: `tripId, riderId, driverId, grossAmount, gatewayFee, platformFee, driverNet, currency, razorpayOrderId, razorpayPaymentId, status('CAPTURED'|'SIMULATED'|'FAILED'), timestamp`.
- **Graceful simulated mode**: with no `RAZORPAY_*` keys the backend returns `{ mock: true }` from initialize-intent, the client **skips the native sheet** and proceeds, and settlement writes a `SIMULATED` ledger row (split still computed, wallet still credited) — so the whole flow demos in Expo Go / on web (`usePaymentSheet.web.ts`) without keys. **The native sheet itself needs the dev build** (same constraint as push). Set `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET` (backend `.env`) + `EXPO_PUBLIC_RAZORPAY_KEY_ID` (mobile `.env`) for live mode. USD capture requires an international-enabled Razorpay account.
- **Payment failure never locks the state machine**: a failed/cancelled/unverified authorization leaves the rider in `CONFIRMING` and drops a premium banner — *"Payment authorization failed. Please update your payment method to request a ride."* The Confirm button shows a spinner (`PrimaryButton loading`) while authorizing.
- **Webhook is a real settlement path**: `handleWebhook` verifies `X-Razorpay-Signature` over the raw body, and on a `payment.captured` event calls the shared `settle()` core (split → ledger → wallet) using the trip context carried in the payment `notes` (`tripId, riderId, driverId`). It's **idempotent with the synchronous COMPLETED-branch settlement** — both write `transaction_ledger/{tripId}` via `.create()`, so whichever lands first wins and the other dedupes (`already settled, skipping`); the wallet is credited exactly once. Verified end-to-end against live Firestore by `test-phase13-webhook.js` (signs a mock `payment.captured`, POSTs it, reads back the ledger doc + wallet credit, asserts the duplicate is a no-op).
- **Firestore startup probe**: `firebase.js` `probeFirestore()` does a tiny read at boot and logs the *authoritative* status — `Firestore reachable — writes will persist ✅` vs an `UNREACHABLE` warning with the fix. The banner line is now `Firestore: credentials loaded` (honest — credentials ≠ reachability); the probe line that follows is the real signal. (Added after the Cloud Firestore API was found disabled on project `current-ae375`; **now enabled and verified reachable**.)
- **⚠️ Native sheet needs the dev build**: like push, `react-native-razorpay` is a native module — the real checkout only runs in a development build (`npx expo run:ios`), not Expo Go. Without it (or without keys) the flow uses simulated authorization. The backend/ledger/webhook paths are fully live regardless.

## Phase 14 Notes & Known Limitations

- **Razorpay integration is ON HOLD; payment bypass stays ACTIVE.** `map.tsx` `handleConfirmRide` keeps the dev bypass (`result = { ok: true, payment: { id: 'dev_bypass', … } }`) so rides are requested for free without a Razorpay sheet. The real `pay()` call is commented out directly below it (clearly marked `DEV BYPASS … END DEV BYPASS`). Because the mock payload has no `paymentId` string, the server normalizes `trip.payment` to `null` → settlement runs in **SIMULATED** mode (split still computed, wallet still credited). Two pre-existing `tsc` errors are expected and harmless to the running app: `map.tsx` (the bypass mock vs `PaymentRefPayload`) and `config/firebase.ts` (`getReactNativePersistence` typing). Both compile fine via Babel/Metro.
- **Milestone 3 — Ride History & Earnings (DONE).** Built on the Phase 10 `GET /api/history/:userId?role=` endpoint (Firestore `completed_trips`, filtered by `riderId`/`driverId`, sorted desc in JS — no composite index needed). **No backend changes** were required.
- **Rider Ride History** (`history.tsx`): fetches `role=rider`, renders date · **pickup → dropoff route** (green dot → red square rail) · fare paid, with a spend total header. Drivers hitting `/history` `<Redirect>` to `/earnings`.
- **Pickup/dropoff addresses persist (additive wire change)**: `emitTripRequest`'s pickup/dropoff now carry an optional `address` (the rider's `formattedAddress`, captured in `map.tsx`'s confirm handler). It rides inside the existing `pickup`/`dropoff` objects, so the server's `trip.pickup = pickup` write **auto-persists** it to Firestore — zero server/protocol-shape change (still `{lat,lng,…}`). Trips completed before this carry coords only; `formatPoint()` falls back to `"lat, lng"`.
- **Driver Earnings Dashboard** (`earnings.tsx`): fetches `role=driver`, computes **net after commission** via `src/lib/earnings.ts` — which **mirrors the backend `computeSplit`** (gateway 2% + platform 20%, net floored at 0) so the displayed net equals the wallet/`transaction_ledger` credit. Shows **Today** (hero card) / **This Week** (Monday-based, local time) net summaries, an all-time net + gross + commission breakdown, and a recent-trips list (`+$net Earned` per trip). Riders hitting `/earnings` `<Redirect>` to `/history`.
- **Navigation**: the existing idle-state HUD button (top-right of the map) is now role-aware — riders get the ⏱ icon → `/history`, drivers get the 👛 `wallet-outline` icon → `/earnings`.
- **Earnings net is computed client-side from each trip's persisted `fare`** (the `completed_trips` doc stores gross fare, not the per-trip net — that lives in `transaction_ledger`). Keep `lib/earnings.ts`'s `GATEWAY_PERCENT`/`PLATFORM_COMMISSION` in sync with `paymentController.js` if the take-rate ever changes. A future option is a `GET /api/earnings/:driverId` that reads the authoritative ledger/wallet instead.
- **Verified**: full non-lazy web bundle compiles (HTTP 200) with `earnings.ts` + the `(app)/earnings.tsx` route in the graph and no transform errors; `tsc` clean for all new/changed files (only the two pre-existing errors above remain).

## Phase 15 Notes & Known Limitations

- **Real Firebase Auth replaces the dev bypass.** Email/password + **Google Sign-In** (`@react-native-google-signin/google-signin` on native via the webClientId from `google-services.json`; Firebase `signInWithPopup` on web). `authService.ts` lazy-`require`s the native Google module so web/Expo Go don't crash. Session persists via `getReactNativePersistence(AsyncStorage)` (the Phase 2 fix). Role is stored in Firestore `users/{uid}` (`userService.ts`) and re-fetched in the root layout's `onAuthStateChanged` → drives rider/driver Map UI + a `complete-profile` onboarding funnel when the profile is incomplete (`needsProfile`).
- **Driver post-ride payment — UPI QR / Cash (Razorpay still deferred).** On `COMPLETED` the driver sheet shows `CollectPaymentCard` (`src/components/trip/CollectPaymentCard.tsx`) **before** rating: two options — **Collect Cash** (one-tap confirm) and **Collect via UPI** (animated reveal of a `react-native-qrcode-svg` QR encoding a standard `upi://pay` intent built by `src/lib/upi.ts`). The QR carries the **exact fare**, payee name, and `tr=tripId`. The **payee VPA is the driver's own `upiId`** read from their Firestore `users/{uid}` profile (`fetchDriverUpiId`, fetched on mount in the card), falling back to `EXPO_PUBLIC_DEFAULT_UPI_ID` (placeholder `rideshare.driver@upi`) when unset — so money goes straight to the driver. (A profile-edit field for `upiId` in complete-profile is a later add.) UPI settles INR-only (`cu=INR`); the numeric amount mirrors the receipt's `currency` (USD in dev) — convert before production if billing non-INR. After collection a toast fires and the sheet advances to earnings + rate-rider.
- **Toast/Snackbar replaces `Alert.alert`.** `useToastStore` (zustand) + `<ToastHost />` mounted once in the root layout. `toast.success/error/info(...)` callable from anywhere. All auth-screen `Alert.alert` popups were swapped to `toast.error(...)`.
- **Already in place from earlier phases (NOT rebuilt):** haptics (`src/lib/haptics.ts`, expo-haptics, wired on primary buttons — payment buttons now use it too), custom minimal map style (`src/config/mapStyle.ts`), and smooth marker interpolation (`useAnimatedCoordinate`, a dependency-free rAF lerp chosen over `AnimatedRegion` so it works on the web schematic map + native with one `<Marker>`). `PrimaryButton` already supports `disabled` + `loading` (greyed-out + spinner).
- **Map blur/dim overlay (DONE).** The map recedes behind the sheet as it expands: `map.tsx` passes a reanimated `animatedPosition` shared value to `<BottomSheet>`, and a full-screen `Reanimated.View` (a faint scrim + `expo-blur` `BlurView intensity={18} tint="light"`, `pointerEvents="none"`) interpolates its opacity from the sheet's Y position (clear at a low peek → soft frost when it covers the upper screen). Works with `enableDynamicSizing` since it's driven by continuous position, not snap indices. The sheet already had rounded top corners (`radius.lg`), a subtle shadow, and a 44px custom drag handle.
- **Rich Notifications — "Alive" driver-en-route (DONE for foreground; Path A / notifee).** `@notifee/react-native` + `src/services/richNotificationService.ts`: `displayDriverEnRoute({ tripId, etaMin, routeImageUrl })` posts/updates ONE notification keyed by `tripId` with a **live countdown chronometer** (`showChronometer` + `chronometerDirection:'down'` + `timestamp`) and the **Static-Maps route snapshot** as Android `BIGPICTURE` / iOS attachment. `onlyAlertOnce` + stable id → in-place silent refresh. Backend `emitEtaUpdates()` runs on the 3s broadcast tick: for each `ACCEPTED` trip it recomputes driver→pickup ETA and emits `trip:eta-update` to the rider **only when the whole-minute ETA changes** (`trip.lastEtaMin`). The rider handler in `map.tsx` builds the route image (`buildStaticRouteUrl` with its own Maps key from the driver coords + stored pickup/dropoff) and calls `displayDriverEnRoute`; ARRIVED/IN_PROGRESS/COMPLETED/cancelled → `cancelDriverEnRoute`. notifee background handler registered once at `_layout.tsx` module load. **All notifee calls lazy-require the native module and no-op on web / Expo Go.**
  - **Background updates (DONE — `@react-native-firebase/messaging`).** `emitEtaUpdates()` now ALSO sends a **data-only FCM message** (`firebase.js` `sendFcmDataMessage` via `firebase-admin/messaging`, `android.priority:'high'`, no `notification` block) carrying `{ type:'eta-update', tripId, etaMin, pickup/dropoff/driver coords }`. The client registers its **native FCM token** (`fcmService.getFcmToken` → `push:register-fcm-token` → `saveFcmToken`, stored in `fcm_tokens/{userId}` + in-memory). `fcmService.registerFcmBackgroundHandler()` (set at `_layout.tsx` module load) runs `setBackgroundMessageHandler` → `handleEtaDataMessage` → builds the route image (coords are in the payload since the headless context has no store access) → `displayDriverEnRoute`. So the chronometer + route image refresh even when the app is **backgrounded/quit**. On ARRIVED the server sends `type:'eta-cancel'` to clear it. A foreground `onMessage` listener mirrors it (idempotent via the tripId notification id). All RNFirebase calls lazy-require + no-op on web/Expo Go.
  - **Monochrome notification icon (DONE).** `expo-notifications` plugin `icon: ./assets/images/android-icon-monochrome.png` generates the `notification_icon` drawable; `richNotificationService` uses `smallIcon: 'notification_icon'` (tinted `#208AEF`).
  - **Driver UPI capture (DONE).** `complete-profile.tsx` shows a **UPI ID** field only when the **Driver** role is selected (required, validated `name@bank`); `completeProfile(…, upiId)` persists it to `users/{uid}.upiId`, which `CollectPaymentCard` reads for the QR payee.
  - **⚠️ Needs a NEW dev/preview EAS build** — notifee + `@react-native-firebase/{app,messaging}` are native modules (autolinked), absent from the current build. Enable + bill the **Static Maps API** on the Maps key for the route image. Coexistence note: expo-notifications (Expo push token, accept/arrive alerts) and RNFirebase messaging (FCM data token, background ETA) run side by side — both ride on Android FCM but use separate token abstractions.
- **Verified**: `tsc` clean; full non-lazy web bundle compiles (HTTP 200, ~11.65MB) with `CollectPaymentCard` + `react-native-qrcode-svg` + `ToastHost` + `richNotificationService` + `@notifee/react-native` + `expo-blur` + `lib/{upi,staticMap}.ts` all in the graph, no transform errors.

## Phase 16 Notes & Known Limitations

- **Auth-first onboarding (Uber pattern).** The landing gate no longer asks Rider/Driver. `index.tsx` is a premium brand screen → **Get Started** → the unified role-agnostic `/(auth)/login` (Google + email/password with sign-in/sign-up toggle). `rider-login.tsx`/`driver-login.tsx` are **deleted**. Smart routing after auth: a Firestore `users/{uid}` role → straight to `/(app)/map` (root gate redirects); no profile → `/(auth)/complete-profile` funnel (name, phone, role, driver UPI). `useAuthStore.login/register/loginWithGoogle` no longer take a `role` param — `login` fetches the stored role, `register` always funnels (`needsProfile: true`).
- **Navy/Gold premium theme.** `theme.ts` tokens: crisp white surfaces (`#F7F9FC`/`#FFFFFF`), deep premium blue primary (`rider: #1E40AF`, CTA gradient `#2E5BDB → #1E3A8A`), elegant gold accents (`gold`/`driver: #C9971C`, `goldSoft` tint), deep-navy text + new `navy` token. All token-referencing components inherit automatically.
- **Socket auth (P0).** `io.use()` middleware in `server.js` verifies the **Firebase ID token** from `handshake.auth.token` via `firebase.js` → `verifyIdToken()` (Admin SDK, same credential as Firestore). The VERIFIED uid lands on `socket.data.userId` — client-claimed userIds are never trusted; `driver:update-location` ignores the payload `id` too. The client (`socketService.ts`) passes `auth` as a **callback** so every reconnection attempt fetches a fresh `getIdToken()` (1h expiry auto-refresh). Graceful: without Admin credentials the server logs ONE loud warning and falls back to trusting query params (dev mode). `role === 'admin'` stays exempt (same as the open `/dashboard`, Phase 8 known limitation). **⚠️ Old APKs (query-only handshake) are rejected by an auth-enabled server — rebuild required.**
- **Reconnect resync (P0).** On every connection the server looks up the user's in-flight trip **by durable userId** (`findActiveTripForUser`) — riders match any non-terminal trip, drivers only post-accept (`ACCEPTED/ARRIVED/IN_PROGRESS`) — refreshes the stored socket id, and emits **`trip:resync`** (full trip state + counterparty phone). `map.tsx` restores status/route/driver/contact from it. A reconnecting mid-trip driver's `busy` flag is recomputed from their live trip on the first location update.
- **Mid-trip driver disconnect grace (P0).** A driver dropping during a live trip no longer strands the rider: the rider gets `trip:driver-connection {state:'lost'}` (banner), and the trip auto-cancels (`trip:cancelled` + push + FCM eta-cancel) only if the driver doesn't resync within **`DRIVER_RECONNECT_GRACE_MS` (2 min)**. A resync inside the window clears the timer and emits `state:'restored'`. `driverReconnectTimeout` is stripped from `getTripsList()` serialization and cleared on COMPLETED/shutdown.
- **Verified**: `tsc --noEmit` exits clean (0 errors — the two long-standing pre-existing errors are gone too); `expo export --platform web` compiles with `/(auth)/login` in the route graph and the old login screens absent; `node --check` passes on `server.js`/`firebase.js`; live boot shows `Socket Auth: ID tokens VERIFIED ✅`; middleware functionally tested — no-token rider **rejected**, bogus-token rider **rejected**, admin **accepted**.
- **Not yet done (deliberate)**: role is still client-claimed after identity verification (cross-check against Firestore `users/{uid}.role` is a follow-up); phone OTP, home/work address, emergency contact, profile-picture upload deferred from the funnel; active trips still in-memory (P1); admin socket/route still unauthenticated.

## Phase 17 Notes & Known Limitations

- **Two apps from one codebase (variants, NOT a monorepo).** `app.config.ts` (replaces `app.json`) reads `EXPO_PUBLIC_APP_VARIANT` → `rider` ("RideShare", `com.rideshare.rider`, scheme `rideshare`) / `driver` ("RideShare Driver", `com.rideshare.driver`, scheme `ridesharedriver`) / unset = **universal dev app** (original `com.anonymous.uberclone`, single-app behavior preserved for local dev). Slug + EAS projectId are shared. EAS profiles: `preview-rider`, `preview-driver`, `production-rider`, `production-driver` (verified: `extends` deep-merges `env`, so Firebase vars carry through). Monorepo deliberately deferred — revisit only when rider/driver code genuinely diverges; the variant boundary marks what would become `packages/shared`.
- **Variant runtime behavior**: `src/config/appVariant.ts` (`APP_VARIANT`, `isRiderApp`, `isDriverApp`). Funnel role selector is hidden + role fixed in variant builds; landing copy is variant-aware; root layout has a **wrong-app guard** (driver account in the rider APK → hand-off screen + sign out, never a mismatched map).
- **⚠️ Before the FIRST variant build**: add Android apps for `com.rideshare.rider` AND `com.rideshare.driver` in the Firebase console (project `current-ae375`) with the EAS keystore SHA-1/SHA-256, then download the merged `google-services.json` (it holds one client per package; the Gradle plugin picks by applicationId). Without this the build fails / Google Sign-In DEVELOPER_ERRORs. Custom per-app icons are a follow-up (`icon` currently shared).
- **Premium design system**: **Inter** via `@expo-google-fonts/inter`, loaded in the root layout (`useFonts`, gated by the existing loading screen). `theme.ts` gains `fonts` (family map — never pair with `fontWeight`, Android picks the wrong face) and a strict `type` scale (`display/title/heading/body/label/caption`) — spread into styles (`...type.title`). Multi-layered soft shadows via CSS-string `boxShadow` (`elevationShadows.soft/raised/floating/goldGlow`) — New-Arch RN 0.81 feature, works native + web; legacy `shadows.*` kept for older components.
- **Micro-interactions**: `ui/PressableScale.tsx` — shared UI-thread (Reanimated worklet) spring press + haptic tick; tuned over-damped press-in, springy release. `PrimaryButton` rebuilt on it (layered floating shadow, Inter, shadow on an outer non-clipped wrapper). `ui/GlassCard.tsx` — expo-blur frosted surface (Android `dimezisBlurView`, web degrades to translucent wash) for map-floating HUD content; not yet wired into map.tsx (follow-up with the TripProvider extraction).
- **Lottie searching animation**: hand-authored brand asset `assets/lottie/radar-search.json` (3 staggered expanding navy rings via layer `st` offsets + pulsing navy core + gold center dot, 30fps loop). `trip/SearchingRadar.tsx` renders it in the rider SEARCHING sheet (was RadarPulse); falls back to RadarPulse via `onAnimationFailure`. **`SearchingRadar.web.tsx`** keeps `lottie-react-native` out of the web bundle (v7 pulls `@lottiefiles/dotlottie-react` on web — not installed by design); same split idiom as MapView.web.tsx. Driver online radar still uses RadarPulse.
- **Typography applied so far**: landing, login, complete-profile, PrimaryButton + root-layout guard screens. **map.tsx + bottom sheets migrate next** (with the TripProvider refactor) — they still render system fonts.
- **Verified**: `tsc --noEmit` clean; web export compiles (lottie excluded); **Android export compiles as `EXPO_PUBLIC_APP_VARIANT=rider`** (lottie + Inter in the native graph); `expo config` resolves all three identities; `eas config --profile preview-rider` shows merged env + variant; Lottie JSON parses.

## Phase 18 Notes & Known Limitations

- **Design brief**: Uber's structural UI (map-first, status-driven bottom sheet, bold hero numerals, dot-rail routes) but with the brand palette — white surfaces, deep navy (`colors.navy`/`rider`) for text + primary actions, gold (`colors.gold`) reserved for ratings, driver identity, and premium accents. NOT black/white.
- **Inter everywhere (typography sweep complete).** A scripted sweep replaced every `fontWeight: typography.weight*` with the matching Inter family (`fonts.heavy/bold/medium`; `weightRegular` ('500') → `fonts.medium` to preserve visual weight) across 15 files: both sheets, history, earnings, destination, dashboard, DestinationSearch(+web), SearchBar, PhoneInput, PickupSelector, ToastHost, CollectPaymentCard, DriverProfileCard, SwipeToAccept — plus map.tsx's raw fontWeights (badge, error toast, permission card). Theme imports were auto-fixed (add `fonts`, drop unused `typography`). The dev-only debug overlay keeps monospace. `typography.weight*` tokens remain exported for compat but are now unreferenced.
- **State-transition motion**: `RiderBottomSheet`/`DriverBottomSheet` are now thin animated wrappers — `<Animated.View key={status} entering={FadeInDown.springify().damping(19).stiffness(220).mass(0.9)}>` around the (renamed) `RiderSheetContent`/`DriverSheetContent`. The `key={status}` remount makes EVERY ride-state change spring in; no per-state animation code. Works with `enableDynamicSizing`; internal state (rating, payment step) persists within a status.
- **Frosted-glass map HUD**: the role badge and the idle History/Earnings button are now `GlassCard` (blur over the live map, pill radii); the button is wrapped in `PressableScale` (0.9 pressed scale). `roleBadge`/`historyBtn` styles slimmed — GlassCard owns the surface/shadow.
- **Micro-interactions**: call buttons in both sheets → `PressableScale` (medium haptic); `StarRating` defaults to **gold** with a deep 0.78 spring pop per star; `PressableScale` gained `accessibilityRole`/`accessibilityLabel` passthrough (a11y preserved on stars/HUD). Rider idle greeting "Where to?" bumped to a 28px navy Inter-heavy hero.
- **Shadows**: driver `routeCard` and the sheets moved off legacy `shadows.card` to layered `boxShadow` (`elevationShadows.raised`); unused `shadows` imports dropped from both sheets + map.tsx.
- **Verified**: `tsc --noEmit` clean; web export compiles; Android export compiles as `EXPO_PUBLIC_APP_VARIANT=rider`.
- **Still deferred**: TripProvider extraction (map.tsx socket wiring), Lottie assets beyond the searching radar (e.g. driver-online, trip-complete confetti), map marker/polyline restyle to navy/gold, `type.*` scale adoption inside sheets (families swapped; sizes kept to avoid layout churn in one pass).

### Phase 18b — Map Brand Identity, Lottie Moments & Type-Scale Adoption

- **Map markers restyled to navy/gold**: driver cars are now **navy chips with a white `car-sport` Ionicon** and white ring (was gold circle + 🚗 emoji); the **assigned** driver earns a **gold ring + gold glow** (was green). Pickup pins = **navy + white `person` icon** (was blue 👤); dropoff pins (driver view + rider confirm preview) = **gold + white `flag` icon** (was green/blue 🏁). All emoji glyphs and the `pinGlyph`/`driverMarkerEmoji` styles removed. Web-safe: `MapView.web.tsx`'s Marker renders children directly.
- **Route polylines**: both the `MapDirections` route and the dashed straight-line fallback now draw in **navy** (`colors.navy`, width 5) for both roles — one brand line, Uber-style — instead of the role accent.
- **Lottie: trip-complete celebration** — `assets/lottie/trip-complete.json` is **generated by script** (gold check-circle pop with overshoot + hand-drawn check path + 12 radial confetti particles in gold/navy/blue, 60fr one-shot, `loop={false}`). `trip/TripCompleteCelebration.tsx` plays it atop the rider receipt AND the driver earnings card (`celebrationWrap` uses negative margins to trim canvas whitespace; the old 22px green check row was removed). Fallback = static gold check badge; `.web.tsx` twin keeps lottie off the web bundle.
- **Lottie: driver-online gold radar** — `SearchingRadar` gained `tint: 'navy'|'gold'` + `glyph` props; gold recolors the ring layers at render time via `colorFilters` keyed to the `ring-1/2/3` layer names (one asset, two roles). Driver IDLE sheet now uses it (was RadarPulse). RadarPulse survives only as the web/failure fallback.
- **Type scale adopted in both sheets** (scripted, exact-match replaces, zero misses): headings (`searchTitle`, `ratePrompt`, `statusLabel`, `onlineText`) → `type.heading`; `confirmTitle` → `type.title` (navy, heavy); body/labels/captions mapped to `type.body/label/caption` with deliberate family/size overrides kept inline. **Intentional off-scale heroes**: greeting "Where to?" (28) and fare/earnings numerals (46).
- **Verified**: `tsc` clean; `trip-complete.json` parses; web export compiles (lottie excluded); Android export compiles as rider variant.

## Beta Readiness & Final State

### Completed Modules
- Unified Expo project infrastructure (Rider & Driver variants).
- Core UI/UX implementation including Map animations, BottomSheets, and Glassmorphism layers.
- Complete Phone Auth flow (OTP).
- Full Socket.IO real-time Ride State Machine.
- Razorpay Payments & Receipts.
- Post-trip rating and feedback system.
- Production readiness enhancements (Error boundaries, logger abstractions, secure API keys).

### Remaining Modules
- **Native Background Location:** Migrate driver GPS polling from the JS thread to a native Expo foreground service to allow drivers to navigate via external apps without suspending.
- **Push Notifications:** Fallback FCM notifications when sockets disconnect.

### Known Issues
- Driver location broadcast pauses if the app goes to the background (due to standard iOS/Android JS thread suspension).

### Production Blockers
- None for the closed foreground Beta.
- The Native Background Location is the sole blocker for the public App Store release.

### Beta Testing Checklist
A comprehensive test matrix covering functional flows, UI/UX, and edge cases has been generated at `docs/BETA_QA_CHECKLIST.md`. It must be completed across physical devices prior to launch.
