## 1. Setup

- [x] 1.1 Add PWA dependency (`vite-plugin-pwa`) to package.json
- [x] 1.2 Create manifest and icon assets under public/ (or equivalent)

## 2. Build Configuration

- [x] 2.1 Configure Vite PWA plugin with manifest metadata and icons
- [x] 2.2 Configure precache for shell assets and enable cleanupOutdatedCaches
- [x] 2.3 Ensure no runtime caching rules are added for sub-app requests

## 3. Runtime Integration

- [x] 3.1 Register service worker from the shell entrypoint
- [x] 3.2 Implement update-ready prompt UI with refresh action

## 4. Validation

- [x] 4.1 Verify manifest is served at /manifest.webmanifest
- [x] 4.2 Validate offline startup loads shell UI
- [x] 4.3 Validate update flow prompts and refreshes correctly
