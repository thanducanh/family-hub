const CACHE_NAME = "family-hub-v6";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Family Hub", body: event.data.text() };
  }

  const title = data.title || "Family Hub";
  const options = {
    body: data.body || data.message || "",
    icon: "/icon-192x192.png", // Next.js default typically or adjust based on actual manifest
    badge: "/icon-192x192.png",
    data: data.data || { url: "/?screen=notifications" },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(title, options));

  if (typeof data.unreadCount === "number") {
    if (navigator.setAppBadge) {
      if (data.unreadCount > 0) {
        navigator.setAppBadge(data.unreadCount).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || "/?screen=notifications";
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url.includes(self.location.origin)) {
          matchingClient = windowClient;
          if (windowClient.url === urlToOpen) break;
        }
      }

      if (matchingClient) {
        return matchingClient.focus().then(() => matchingClient.navigate(urlToOpen));
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
