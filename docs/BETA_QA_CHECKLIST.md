# RideShare Beta QA Checklist

This document serves as the comprehensive testing matrix for the closed beta phase. Both Driver and Rider applications must be tested across real-world edge cases before public launch.

## 1. Functional Testing

### Authentication & Profiles
- [ ] Sign up as a Rider with a new phone number.
- [ ] Sign up as a Driver with a new phone number.
- [ ] Sign out and sign back in (session restoration).
- [ ] Verify profile data persists across restarts.

### Core Ride Lifecycle (Happy Path)
- [ ] Rider requests a ride to a valid destination.
- [ ] Driver receives the ping with correct ETA and fare estimate.
- [ ] Driver accepts the ride within the countdown window.
- [ ] Driver navigates to pickup and swipes "Arrive".
- [ ] Rider sees "Driver is arriving" state.
- [ ] OTP generation and verification (Rider to Driver).
- [ ] Driver swipes "Start Trip".
- [ ] Driver navigates to destination and swipes "Complete Ride".
- [ ] Rider receives receipt and dismisses it.
- [ ] Both parties submit ratings.

### Payments & Receipts
- [ ] Verify fare estimation matches final charge (excluding dynamic waiting fees/tolls).
- [ ] Test Cash collection flow.
- [ ] Test UPI collection flow (QR code presentation).
- [ ] Verify receipt modal correctly breaks down base fare, taxes, and tips.

### Socket Reliability
- [ ] Force-close the app mid-ride and reopen. Verify state recovers instantly.
- [ ] Disconnect Wi-Fi/Cellular for 10 seconds during an active ride. Verify automatic reconnection and state sync.
- [ ] Simulate driver losing connection immediately after accepting a ride.

### Background & Location (CRITICAL)
- [ ] **Driver Backgrounding**: Accept a ride, then switch to Google Maps or lock the screen. Verify the Rider app still sees the driver's car moving.
- [ ] **Rider Backgrounding**: Request a ride, background the app. Verify push notifications arrive when the driver is approaching.
- [ ] Verify GPS accuracy and smooth marker interpolation on the map.

### Edge Cases & Cancellations
- [ ] Driver declines an incoming ping. Verify the ping rotates to another driver.
- [ ] Rider cancels before driver accepts.
- [ ] Rider cancels while driver is en route.
- [ ] Driver cancels while en route to pickup.
- [ ] Ping times out (driver ignores it).

## 2. UI / UX Testing

### Display Contexts
- [ ] Small screen testing (e.g. iPhone SE / Android equivalent). Verify BottomSheets do not clip or hide CTA buttons.
- [ ] Large screen testing (e.g. iPhone Pro Max / Pixel Pro). Verify UI does not stretch unnaturally.
- [ ] Keyboard behaviour: Verify `DriverRatingCard` and `RiderBottomSheet` do not block text inputs when the keyboard is open.

### Accessibility (a11y)
- [ ] Enable VoiceOver/TalkBack. Ensure all core flows can be navigated via screen reader.
- [ ] Verify minimum touch targets (44x44pt) for all interactive elements (e.g., Call buttons, Add Feedback).
- [ ] Verify all icon-only buttons have descriptive `accessibilityLabel` attributes.

### Animation & Performance
- [ ] Verify 60FPS transitions when opening/closing BottomSheets.
- [ ] Verify map camera padding dynamically adjusts when the BottomSheet expands/collapses.
- [ ] Ensure no UI "flickers" during auth state restoration.

## 3. Regression Checks

- [ ] Map Interactions: Pinch-to-zoom, pan, and My Location button.
- [ ] Shared Components: Ensure modifications to Driver UI haven't broken the Rider UI (e.g. `SwipeToAccept`, `StarRating`).
- [ ] Verify error boundaries: Force a crash and ensure the graceful fallback screen appears instead of returning to the OS home screen.

---

### Sign-off
**Beta Ready:** [ ] Yes / [ ] No
**Tested By:** _______________
**Date:** _______________
