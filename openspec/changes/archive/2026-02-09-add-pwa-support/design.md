## Context

The container is a Vite + React shell that loads sub-apps at runtime. It currently serves only online-first assets with no service worker or manifest. We need PWA installability and resilient startup without changing sub-app behavior.

## Goals / Non-Goals

**Goals:**
- Add manifest + service worker to make the container installable.
- Cache shell assets for offline/poor-network startup.
- Provide safe update behavior (new SW available prompt) without breaking sub-app loading.
- Integrate with existing Vite build pipeline.

**Non-Goals:**
- Offline support for sub-app content or dynamic data.
- Push notifications or background sync.
- Replacing existing navigation or micro-frontend orchestration.

## Decisions

- **Use `vite-plugin-pwa` with Workbox (GenerateSW).**
  - *Why:* First-class Vite integration, automatic precache of build assets, and simple update lifecycle APIs.
  - *Alternatives:* Manual Workbox config or custom service worker; rejected due to higher maintenance and duplicated build steps.

- **Cache only shell assets and static routes.**
  - *Why:* Sub-apps are loaded remotely and may have independent caching strategies; shell-only cache avoids stale or inconsistent micro-frontend state.
  - *Alternatives:* Runtime caching of sub-app assets; rejected due to version skew and invalidation complexity.

- **Surface update prompt via in-app UI.**
  - *Why:* Avoid silent updates that may disrupt running sub-apps; gives user control to refresh.
  - *Alternatives:* Auto-reload on update; rejected to prevent data loss.

## Risks / Trade-offs

- **Risk:** Stale cached shell assets → **Mitigation:** Use Workbox `cleanupOutdatedCaches` and prompt-based update flow.
- **Risk:** Service worker scope conflicts with sub-app routing → **Mitigation:** Keep SW scope at root and avoid aggressive navigation fallbacks for sub-app paths.
- **Trade-off:** Offline experience limited to shell only → **Mitigation:** Clear messaging in UI and future extension path.

## Migration Plan

1. Add PWA build plugin and manifest assets.
2. Register service worker in the app shell and add update prompt UI.
3. Validate in dev and production builds; ship behind standard release process.
4. Rollback by disabling PWA plugin and removing SW registration if needed.

## Open Questions

- Do we need a custom offline fallback page for shell-only mode?
- Should install prompt be exposed automatically or via settings toggle?
