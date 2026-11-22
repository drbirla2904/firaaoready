(function () {
  const mobile = window.matchMedia("(max-width: 860px)");
  const promptDateKey = "firaao-install-prompt-date";
  const installedKey = "firaao-installed";
  const localDate = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  };
  const readPreference = key => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Could not read Firaao install preferences.", error);
      return null;
    }
  };
  const savePreference = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("Could not save Firaao install preferences.", error);
    }
  };
  const installed = () => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (standalone) savePreference(installedKey, "1");
    return standalone || readPreference(installedKey) === "1";
  };
  let deferredPrompt = null;
  let dismissed = false;

  const banner = document.createElement("aside");
  banner.className = "install-prompt";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Install Firaao");
  banner.innerHTML = '<span class="install-prompt-mark" aria-hidden="true">F</span>' +
    '<div class="install-prompt-copy"><strong>Get the Firaao app</strong>' +
    '<p>Install for quick access from your home screen.</p>' +
    '<p class="install-prompt-help" hidden></p></div>' +
    '<button class="install-prompt-action" type="button">Install</button>' +
    '<button class="install-prompt-close" type="button" aria-label="Dismiss install reminder">×</button>';
  document.body.appendChild(banner);

  const action = banner.querySelector(".install-prompt-action");
  const help = banner.querySelector(".install-prompt-help");
  const updateVisibility = () => {
    const date = localDate();
    const shouldShow = mobile.matches && !installed() && !dismissed && readPreference(promptDateKey) !== date;
    banner.hidden = !shouldShow;
    if (shouldShow) savePreference(promptDateKey, date);
  };
  const showInstructions = () => {
    const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    help.textContent = appleMobile
      ? "Tap Share, then choose Add to Home Screen."
      : "Open your browser menu and choose Install app or Add to Home screen.";
    help.hidden = false;
  };

  action.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showInstructions();
      return;
    }

    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "dismissed") showInstructions();
    } catch (error) {
      console.error("Could not open the Firaao install prompt.", error);
      showInstructions();
    }
  });
  banner.querySelector(".install-prompt-close").addEventListener("click", () => {
    dismissed = true;
    updateVisibility();
  });

  window.addEventListener("beforeinstallprompt", event => {
    if (!mobile.matches || installed()) return;
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    savePreference(installedKey, "1");
    updateVisibility();
  });
  mobile.addEventListener("change", updateVisibility);
  updateVisibility();
})();
