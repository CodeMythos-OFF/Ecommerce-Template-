// Register the service worker from an external script so CSP can block inline scripts.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("PWA offline support unavailable:", error);
    });
  });
}
