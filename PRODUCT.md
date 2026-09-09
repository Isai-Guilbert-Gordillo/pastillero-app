# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Two roles, two devices, one shared record:

- **Paciente (primary):** an older adult, typically 80+, with reduced motor precision and vision, who needs to take medication on schedule without depending on memory. Uses the app directly on their own Android phone.
- **Cuidador (secondary):** a family member helping remotely, on their own separate phone and account. Can view, add, edit medications, and mark doses for the patient's account after redeeming an invite code, without sharing a login.

## Product Purpose

A medication reminder app for elderly users that makes forgetting a dose hard: large text, 70×70px touch targets, and alarms that ring through Android's real system alarm (not just an in-app notification) so they fire even if the app is closed or the phone was restarted. A caregiver can manage the same medication list from their own phone. Success is a dose taken on time without the patient having to operate a complex app, and a caregiver who can trust the record without being physically present.

## Positioning

Reminders ring through Android's actual Clock app (`expo-intent-launcher` → `ACTION_SET_ALARM`), not a push notification the OS can throttle, delay, or that gets missed if the app was killed. This is the load-bearing claim: a typical medication-reminder app relies on local/push notifications that can silently fail; PastilleroApp's alarm survives app kill and phone reboot because it's a real system alarm entry, backed up by local notifications with 60s follow-up reminders for 10 minutes if unconfirmed.

## Operating Context

- Patient adds a medication (photo, dose, frequency, start time, active weekdays) from their own phone; the app schedules both a system alarm and local notifications.
- At alarm time, a full-screen alarm view takes over with looping sound, aggressive vibration, and two large actions: "Ya la tomé" / "Posponer 5 min".
- `lib/doseSync.ts` reconciles history automatically on opening Inicio/Historial — no dose is left "pending" forever; overdue unconfirmed doses close as "no tomada" without the user having to remember to log anything.
- Caregiver redeems a 6-character invite code from their own account, then switches between "mi cuenta" and the patient's account from Perfil; a banner marks whenever they're viewing someone else's account, and any schedule change they make warns that the patient's alarm won't ring until the patient opens the app at least once (alarms are local to the patient's device, not pushed from a server).
- All backend access goes directly from the client to Supabase (Postgres + Auth + Storage) using the public anon key; authorization is enforced entirely by Postgres Row Level Security (`is_caregiver_of()`), not by the client or a middle-tier API.

## Capabilities and Constraints

- Android native is the only fully functional target today (system alarm, camera, real notifications with action buttons). Requires a development build (`expo-dev-client`) — these native modules do not work in Expo Go.
- Web build (`expo start --web`) runs with reduced functionality (no native alarm, no camera) — a dev-only preview surface, not a shipped target for end users.
- iOS: `app.json` declares a bundle identifier and permissions, but iOS has not been built or tested; the native-alarm mechanism is Android-only today.
- No server-side push notifications — all alarms/reminders are scheduled locally on-device.
- Known limitation: only one "urgent dose" card is highlighted at a time on Inicio; if two medications are due at close times, only the nearest gets the high-urgency treatment.
- Editing a medication's schedule creates a new system alarm without deleting the old one (old one must be removed manually from the Clock app).
- No ads. A visual placeholder banner (AdBanner) existed during development and was removed before publishing; no ad SDK is integrated.
- Password reset uses a 6+ digit emailed code (not a deep link), to work around Supabase's default email template limits; requires custom SMTP for reliable delivery.

## Brand Commitments

- Name: **PastilleroApp**. UI language: Spanish (all copy, no i18n layer today).
- Custom design system in `lib/theme.ts` (not platform-default Material): teal/emerald primary (`#0D9488`), indigo secondary, coral/rose accent, warm slate neutrals; Poppins typeface across all weights.
- Design constraints are binding, not decorative: minimum 70×70px touch targets, large base font sizes (18px minimum), high-contrast text, built specifically for reduced motor precision and vision in users 80+.

## Evidence on Hand

- Full feature set, architecture, data model, and known limitations are documented in `README.md` (Spanish) — treat as authoritative product record, not marketing copy.
- Schema/RLS policies live in `supabase-schema.sql`.
- No testimonials, case studies, press, or user research artifacts on hand — do not fabricate any.

## Product Principles

1. **Never depend on memory or app-open state for a critical reminder.** Alarms must survive the app being closed or killed; this is the product's core promise, not a feature among many.
2. **Design for reduced motor precision and vision first.** Every interactive surface meets the 70×70px / high-contrast bar before any other visual consideration.
3. **Caregiving is delegated authority, not a shared account.** Each person keeps their own login; access is granted, scoped, and revocable — never a shared password.
4. **Don't let the system silently fail closed.** Reconciliation (`doseSync.ts`) actively closes out missed doses and surfaces them, rather than leaving ambiguous "did this happen?" gaps.
5. **Android-native first; treat web and iOS as unfinished, not equivalent, surfaces.** Don't assume parity of functionality across platforms in design decisions.

## Accessibility & Inclusion

Internal design guidance (not a formal external compliance requirement): WCAG 2.1 principles — contrast, minimum touch target size, legible type at scale — inform every screen for a primary audience of adults 80+ with reduced motor precision and vision. Treat these as strong constraints to preserve, not a certification target to audit against.
