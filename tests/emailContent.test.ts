import { describe, expect, it } from "vitest";
import {
  EmailContentError,
  formatEmailDraft,
  normalizeOutboundEmail,
  renderPersonalizedTemplate,
  renderPlainTextEmailHtml
} from "../src/lib/emailContent";

describe("normalizeOutboundEmail", () => {
  it("extracts a human email from structured AI JSON", () => {
    const content = normalizeOutboundEmail(
      JSON.stringify({
        subject: "quick question",
        body: "Hi Morgan,\n\nWould it help if I sent over five relevant contacts?\n\nBest,\nDustin"
      })
    );

    expect(content).toEqual({
      subject: "quick question",
      body: "Hi Morgan,\n\nWould it help if I sent over five relevant contacts?\n\nBest,\nDustin"
    });
    expect(formatEmailDraft(content)).not.toContain('"body":');
  });

  it("unwraps an email field containing a Subject line", () => {
    const content = normalizeOutboundEmail({
      email: "Subject: regional contacts\n\nHi Sam,\n\nCan I send a short sample?\n\nDustin"
    });

    expect(content.subject).toBe("regional contacts");
    expect(content.body).toBe("Hi Sam,\n\nCan I send a short sample?\n\nDustin");
  });

  it("uses an explicit campaign subject instead of an embedded AI subject", () => {
    const content = normalizeOutboundEmail(
      '{"subject":"model subject","body":"Hi Lee,\\n\\nA normal email body."}',
      "approved campaign subject"
    );

    expect(content.subject).toBe("approved campaign subject");
    expect(content.body).toBe("Hi Lee,\n\nA normal email body.");
  });

  it("rejects structured output with no sendable body", () => {
    expect(() => normalizeOutboundEmail('{"subject":"orphaned subject"}')).toThrow(EmailContentError);
  });

  it("rejects an object dump that survives extraction", () => {
    expect(() => normalizeOutboundEmail('Subject: hello\n\n{"body":"nested object dump"}')).toThrow(
      "Refusing to send serialized JSON"
    );
  });
});

describe("renderPersonalizedTemplate", () => {
  it("renders tags and spintax into natural text", () => {
    const rendered = renderPersonalizedTemplate(
      "{Hi|Hello} {{firstName}}, I wanted to ask about {{companyName}}.",
      { firstName: "Morgan", companyName: "Northwind" },
      "lead-123"
    );

    expect(rendered).toMatch(/^(Hi|Hello) Morgan, I wanted to ask about Northwind\.$/);
    expect(rendered).not.toContain("{");
  });

  it("rejects missing lead data instead of substituting invented values", () => {
    expect(() =>
      renderPersonalizedTemplate(
        "Hi {{firstName}}, how is {{companyName}} doing?",
        { firstName: "Morgan", companyName: "" },
        "lead-123"
      )
    ).toThrow("non-empty companyName");
  });
});

describe("renderPlainTextEmailHtml", () => {
  it("escapes markup and wraps transformed links safely", () => {
    const html = renderPlainTextEmailHtml(
      "Hi <Morgan>\nSee https://example.com/path?a=1&b=2",
      (url) => `https://track.example/click?url=${encodeURIComponent(url)}`
    );

    expect(html).toContain("Hi &lt;Morgan&gt;<br/>");
    expect(html).toContain('href="https://track.example/click?url=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1%26b%3D2"');
    expect(html).toContain("https://example.com/path?a=1&amp;b=2");
  });
});
