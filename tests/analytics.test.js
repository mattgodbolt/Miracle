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

  it("escapes the id in both the url and the script", () => {
    const [loader, setup] =
      analyticsPlugin('G-A&B"</script>').transformIndexHtml(Html).tags;

    expect(loader.attrs.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-A%26B%22%3C%2Fscript%3E",
    );
    expect(setup.children).toContain('gtag("config", "G-A&B\\"</script>");');
  });
});
