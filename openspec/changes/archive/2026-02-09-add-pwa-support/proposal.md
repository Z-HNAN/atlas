## Why

The container currently lacks offline resilience and installability, limiting reliability on flaky networks and reducing engagement. Adding PWA support enables install prompts and cached shell assets with minimal disruption.

## What Changes

- Add a PWA manifest and service worker for the container shell.
- Cache core shell assets for offline/poor network startup and provide safe update behavior.
- Register the service worker and surface update-ready UX.
- Add build tooling for PWA generation and local testing support.

## Capabilities

### New Capabilities
- `pwa-support`: Installable container with manifest, service worker, and offline-ready shell assets.

### Modified Capabilities
- 

## Impact

- Frontend build (Vite) configuration and dependencies (PWA plugin/workbox).
- App shell runtime (service worker registration, update prompt UI).
- Static assets (manifest, icons) and caching strategy for shell assets.
