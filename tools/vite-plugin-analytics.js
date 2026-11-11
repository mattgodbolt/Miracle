const gtagTags = (measurementId) => [
  {
    tag: "script",
    attrs: {
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
    },
    injectTo: "head-prepend",
  },
  {
    tag: "script",
    children: `window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", ${JSON.stringify(measurementId)});`,
    injectTo: "head-prepend",
  },
];

/** Google Analytics on the page, only when a measurement id is given. */
export function analyticsPlugin(measurementId) {
  return {
    name: "analytics",
    transformIndexHtml: (html) =>
      measurementId ? { html, tags: gtagTags(measurementId) } : html,
  };
}
