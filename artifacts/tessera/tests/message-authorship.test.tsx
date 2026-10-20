import { renderToStaticMarkup } from "react-dom/server";
import { MessageAuthorshipLabel } from "../src/components/chat/MessageAuthorshipLabel";
import { lastReplyAuthorship, parseChatAuthorship } from "../src/lib/chat-authorship";

const modelAuthorship = {
  authorRole: "model-authored",
  author: "Tessera Pen",
  model: "provider/model-version-2026",
  provenance: "retrieved-evidence",
  reason: null,
};

it("restores the exact model on its own JSON-reloaded reply", () => {
  const reopened = JSON.parse(JSON.stringify([
    { role: "assistant", authorship: modelAuthorship },
    { role: "assistant", authorship: { authorRole: "local", author: "Tessera", model: null } },
  ]));
  expect(renderToStaticMarkup(<MessageAuthorshipLabel authorship={reopened[0].authorship} />))
    .toContain("Model reply · provider/model-version-2026");
  const local = renderToStaticMarkup(<MessageAuthorshipLabel authorship={reopened[1].authorship} />);
  expect(local).toContain("Local response · Tessera");
  expect(local).not.toContain("provider/model-version-2026");
  expect(lastReplyAuthorship(reopened)?.authorRole).toBe("local");
});

it("does not infer a legacy reply's author from text or an earlier model reply", () => {
  const reopened = [
    { role: "assistant", authorship: modelAuthorship },
    { role: "assistant", content: "Model attribution: newer-model" },
    { role: "user", content: "Follow up" },
  ];
  expect(lastReplyAuthorship(reopened)).toBeNull();
  expect(renderToStaticMarkup(<MessageAuthorshipLabel />)).toContain("Legacy / unknown");
  expect(lastReplyAuthorship([])).toBeNull();
});

it("distinguishes local fallback, application results and unreported providers", () => {
  for (const [authorRole, label] of [
    ["local-fallback", "Local fallback"],
    ["application-result", "Application result"],
    ["unattributed", "provider/model not reported"],
  ]) {
    const html = renderToStaticMarkup(<MessageAuthorshipLabel authorship={{
      authorRole, author: "Application", model: null,
    }} />);
    expect(html).toContain(label);
    expect(html).not.toContain("Model reply");
  }
});

it("rejects invalid roles, bounds labels and never renders untrusted markup", () => {
  expect(parseChatAuthorship({ authorRole: "invented", author: "Tessera" })).toBeNull();
  expect(parseChatAuthorship({ ...modelAuthorship, author: "" })).toBeNull();
  expect(parseChatAuthorship({ ...modelAuthorship, model: "<script>" })?.model).toBeNull();
  const value = { authorRole: "local", author: "<script>alert(1)</script>", model: null };
  const html = renderToStaticMarkup(<MessageAuthorshipLabel authorship={value} />);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(parseChatAuthorship({ ...modelAuthorship, author: "A".repeat(100) })?.author).toHaveLength(48);
});
