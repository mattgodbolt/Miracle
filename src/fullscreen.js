const FullscreenClass = "fullscreen";
const FullscreenQuery = "(display-mode: fullscreen)";

// Hides the page's header while it is fullscreen, however it got there: the
// browser's own F11, which a page is only told about by the display-mode media
// query, or the Fullscreen API that the menu button and a double click on the
// screen use.
export const initFullscreen = (doc = document, win = window) => {
  const query = win.matchMedia(FullscreenQuery);
  const update = () =>
    doc.body.classList.toggle(
      FullscreenClass,
      query.matches || !!doc.fullscreenElement,
    );
  query.addEventListener("change", update);
  doc.addEventListener("fullscreenchange", update);
  update();

  const supported = !!doc.fullscreenEnabled;
  const toggle = () => {
    const change = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();
    // The browser has already refused it visibly, or there was nothing to do.
    return change.catch(() => {});
  };

  doc.querySelectorAll(".menu_fullscreen").forEach((button) => {
    if (supported) button.addEventListener("click", toggle);
    else button.hidden = true;
  });
  if (supported)
    doc.getElementById("screen").addEventListener("dblclick", toggle);
  return { toggle, supported };
};
