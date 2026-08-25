importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ===== Custom addition: reliably log every push notification =====
// OneSignal's own script above already displays the notification.
// This listener runs IN ADDITION (service workers allow multiple listeners
// per event) and just persists the raw push payload to IndexedDB the moment
// it arrives — before it can be shown, dismissed, or missed by the OS tray.
// The page reads and clears this queue on load / when it becomes visible.
self.addEventListener('push', function (event) {
  try {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }

    const custom = payload.custom || {};
    const additionalData = custom.a || payload.data || {};

    const notif = {
      title: payload.title || payload.headings || 'Notification',
      body: payload.alert || payload.body || payload.contents || '',
      launchURL: custom.u || payload.url || additionalData.launchURL || '',
      data: additionalData,
      time: Date.now()
    };

    event.waitUntil(idbSavePendingNotif(notif));
  } catch (e) {
    // Never let logging break the actual push handling
  }
});

function idbSavePendingNotif(notif) {
  return new Promise(function (resolve) {
    try {
      const req = indexedDB.open('pending-notifs-db', 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore('queue', { autoIncrement: true });
      };
      req.onsuccess = function () {
        try {
          const db = req.result;
          const tx = db.transaction('queue', 'readwrite');
          tx.objectStore('queue').add(notif);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        } catch (e) { resolve(); }
      };
      req.onerror = function () { resolve(); };
    } catch (e) { resolve(); }
  });
}
