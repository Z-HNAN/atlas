## ADDED Requirements

### Requirement: PWA manifest is provided
The container SHALL serve a valid web app manifest with name, short_name, icons, start_url, display mode, and theme/background colors.

#### Scenario: Manifest available
- **WHEN** the browser requests `/manifest.webmanifest`
- **THEN** the response SHALL be a valid manifest referencing existing icon assets

### Requirement: Service worker is registered by the shell
The container shell MUST register a service worker on first load in supported browsers.

#### Scenario: Supported browser registration
- **WHEN** the shell loads in a browser that supports service workers
- **THEN** the service worker registration SHALL be attempted once per page load

### Requirement: Shell assets are precached for offline startup
The service worker SHALL precache the built shell assets required to render the home route.

#### Scenario: Offline startup
- **WHEN** the user opens the installed app or site while offline
- **THEN** the shell UI SHALL render using precached assets without network requests

### Requirement: Update-ready state is surfaced in UI
When a new service worker version is available, the shell MUST surface a user-facing update-ready prompt.

#### Scenario: New version available
- **WHEN** the service worker detects an updated precache
- **THEN** the UI SHALL notify the user and provide an action to refresh

### Requirement: Service worker does not cache sub-app runtime data by default
The service worker MUST avoid runtime caching of sub-app network requests unless explicitly configured.

#### Scenario: Sub-app request
- **WHEN** a sub-app makes a network request at runtime
- **THEN** the request SHALL be passed through without service worker runtime caching
