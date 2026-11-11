import vm from "node:vm";
import { describe, it, expect } from "vitest";
import { analyticsPlugin } from "../tools/vite-plugin-analytics.js";

const Html = "<html><head></head><body></body></html>";

describe("analyticsPlugin", () => {
  it.each([undefined, null, ""])(
    "leaves the page alone without a measurement id (%j)",
    (id) => {
      expect(analyticsPlugin(id).transformIndexHtml(Html)).toBe(Html);
    },
  );

  it("loads gtag.js, then sets up gtag and configures the id, at the top of the head", () => {
    const { html, tags } =
      analyticsPlugin("G-TEST123").transformIndexHtml(Html);

    expect(html).toBe(Html);
    expect(tags.map((tag) => tag.injectTo)).toEqual([
      "head-prepend",
      "head-prepend",
    ]);
    expect(tags[0].attrs).toEqual({
      async: true,
      src: "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    });
    expect(tags[1].children).toContain("function gtag()");
    expect(tags[1].children).toContain('gtag("config", "G-TEST123");');
  });

  it("keeps an awkward id inside its string, in the url and in the script", () => {
    const id = 'G-A&B"</script><!--\u2028';
    const [loader, setup] = analyticsPlugin(id).transformIndexHtml(Html).tags;

    expect(loader.attrs.src).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
    );
    // Nothing in the script can end its element or start an HTML comment...
    expect(setup.children).not.toContain("<");
    // ...and it still says the id: run it and read the config call back.
    const page = {};
    page.window = page;
    vm.runInNewContext(setup.children, page);
    expect(Array.from(page.dataLayer[1])).toEqual(["config", id]);
  });
});
