export function registerShellWorker(nav: Navigator | undefined = globalThis.navigator) {
  if (!nav || !("serviceWorker" in nav)) return false;
  void nav.serviceWorker.register("/sw.js");
  return true;
}
