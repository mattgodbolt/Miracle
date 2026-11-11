// A JavaScript string for use inside an inline <script>: "<" is escaped too, so
// nothing in the value can close the element or open an HTML comment.
const scriptString = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

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
gtag("config", ${scriptString(measurementId)});`,
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
