import { renderToStaticMarkup } from "react-dom/server";
import { MessageCitationList } from "../src/components/chat/MessageCitationList";
import { parseMessageCitations } from "../src/lib/message-citations";

const citation = {
  id: "catalog:planck",
  idx: 1,
  source: "NIST CODATA",
  score: 1,
  sourceUrl: "https://physics.nist.gov/cgi-bin/cuu/Value?h",
  documentReference: "catalog:quantum-physics",
  retrievedAt: "2026-10-20T00:00:00.000Z",
  publishedAt: "2022",
  trustStatus: "verified",
  trustNote: "Check the linked original.",
};

it("displays a saved and JSON-reloaded message's exact structured citation", () => {
  const saved = JSON.stringify({
    id: 12, role: "assistant", content: "A sourced answer.", citations: [citation],
  });
  const reopened = JSON.parse(saved);
  const html = renderToStaticMarkup(<MessageCitationList citations={reopened.citations} />);
  expect(html).toContain('href="https://physics.nist.gov/cgi-bin/cuu/Value?h"');
  expect(html).toContain("Verified source");
  expect(html).toContain("Published: 2022");
  expect(html).toContain("Retrieved: 2026-10-20T00:00:00.000Z");
  expect(html).toContain("Record: catalog:quantum-physics");
});

it("does not infer sources or trust from unrelated chat text or legacy records", () => {
  const messages = JSON.parse(JSON.stringify([
    { content: "verified [1](https://example.com)" },
    { content: "Next answer", citations: null },
    { content: "Sourced answer", citations: [citation] },
  ]));
  expect(renderToStaticMarkup(<MessageCitationList citations={messages[0].citations} />)).toBe("");
  expect(renderToStaticMarkup(<MessageCitationList citations={messages[1].citations} />)).toBe("");
  expect(parseMessageCitations(messages[2].citations)).toEqual([citation]);
});

it("rejects executable or credential-bearing links and escapes source labels", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "https://user:pass@example.com"]) {
    const html = renderToStaticMarkup(<MessageCitationList citations={[{
      ...citation, source: "<script>alert(1)</script>", sourceUrl: url, trustStatus: "invented",
    }]} />);
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Unverified note");
  }
});

it("keeps reduced publication precision and bounds malformed citation records", () => {
  expect(parseMessageCitations([{ ...citation, publishedAt: "1948-10" }])[0].publishedAt).toBe("1948-10");
  expect(parseMessageCitations([{ ...citation, publishedAt: "1948-99" }])[0].publishedAt).toBeNull();
  expect(parseMessageCitations([null, {}, "verified"])).toEqual([]);
  expect(parseMessageCitations(Array.from({ length: 30 }, () => citation))).toHaveLength(24);
});
