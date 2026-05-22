// wishbeat Service Worker
// Empfängt Web-Push-Notifications auch wenn die Seite/der Browser geschlossen ist.

self.addEventListener("install", (event) => {
  // Sofort aktivieren — keine Wartezeit auf alten SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Übernimm Kontrolle für alle offenen Clients
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "wishbeat", body: "Neue Nachricht" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data = { title: "wishbeat", body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    image: data.image,
    vibrate: [180, 80, 180, 80, 320],
    tag: data.tag || "wishbeat-notification",
    requireInteraction: false,
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Wenn ein Tab schon offen ist auf der URL → fokussieren
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Sonst neuen Tab öffnen
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
