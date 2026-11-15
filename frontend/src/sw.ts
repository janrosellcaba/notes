import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

// Injected by vite-plugin-pwa. The token must stay exactly `self.__WB_MANIFEST`.
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());

const navigationNetwork = new NetworkFirst({
  cacheName: "navigations",
  networkTimeoutSeconds: 3,
});
const shell = createHandlerBoundToURL("/index.html");
const navigateFallbackDenylist = [/^\/api\//];

registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        const response = await navigationNetwork.handle(options);
        if (response.ok) return response;
      } catch {
        // The network is down. The precached shell still paints.
      }
      return shell(options);
    },
    { denylist: navigateFallbackDenylist },
  ),
);
