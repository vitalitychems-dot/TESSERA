import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminContext";
import "./MoltbookPublicationPanel.css";

type PublicationStatus =
  | "draft"
  | "approved"
  | "publishing"
  | "verification_required"
  | "verifying"
  | "verification_failed"
  | "uncertain"
  | "published";

interface Publication {
  id: number;
  title: string;
  content: string;
  status: PublicationStatus;
  moderationPolicyVersion: string | null;
  moderationFindings: { code: string; message: string }[];
  createdAt: string;
  approvedAt: string | null;
  externalPostId: string | null;
  verificationExpiresAt: string | null;
  verificationAttempts: number;
  publishedAt: string | null;
}

interface VerificationChallenge {
  verificationCode: string;
  challengeText: string;
  expiresAt: string;
}

interface QueueResponse {
  ok: boolean;
  publishingEnabled: boolean;
  posts: Publication[];
}

const QUEUE_URL = "/api/tesseract-forum/moltbook-publications";

async function requestQueue<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${QUEUE_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as (T & {
    message?: string;
    error?: string;
    findings?: { message?: string }[];
  }) | null;
  if (!response.ok) {
    const findings = result?.findings?.map(finding => finding.message).filter(Boolean).join(" ");
    throw new Error(findings || result?.message || result?.error || "The publication request failed.");
  }
  if (!result) throw new Error("The publication queue returned an unreadable response.");
  return result;
}

function messageForStatus(status: PublicationStatus): string {
  switch (status) {
    case "draft": return "Draft · not approved";
    case "approved": return "Approved · not published";
    case "publishing": return "Sending · do not retry";
    case "verification_required": return "Moltbook verification required";
    case "verifying": return "Checking owner verification";
    case "verification_failed": return "Verification attempts used";
    case "uncertain": return "Unconfirmed · reconcile before acting";
    case "published": return "Confirmed on Moltbook";
  }
}

export function MoltbookPublicationPanel() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const [posts, setPosts] = useState<Publication[]>([]);
  const [publishingEnabled, setPublishingEnabled] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [challenges, setChallenges] = useState<Record<number, VerificationChallenge>>({});
  const [answerById, setAnswerById] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!isAdmin) {
      setPosts([]);
      setPublishingEnabled(false);
      setChallenges({});
      return;
    }
    setQueueLoading(true);
    try {
      const data = await requestQueue<QueueResponse>("");
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setPublishingEnabled(data.publishingEnabled === true);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load the owner queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAdmin) {
      setChallenges({});
      setAnswerById({});
    }
  }, [isAdmin]);

  async function runAction(id: number, action: "approve" | "publish" | "verify" | "reconcile" | "delete", body?: unknown) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      if (action === "delete") {
        await requestQueue<{ ok: boolean }>(`/${id}`, "DELETE");
        setNotice("Local draft or receipt removed. Any Moltbook post remains public.");
        setChallenges(previous => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
      } else {
        const response = await requestQueue<{
          ok: boolean;
          post?: Publication;
          status?: string;
          confirmed?: boolean;
          verification?: VerificationChallenge;
          message?: string;
        }>(`/${id}/${action}`, "POST", body);
        if (response.post) {
          setPosts(previous => [response.post!, ...previous.filter(post => post.id !== id)]);
        }
        if (action === "publish" && response.verification) {
          setChallenges(previous => ({ ...previous, [id]: response.verification! }));
          setNotice("Moltbook is holding this post for owner verification. Solve the displayed challenge yourself; TESSERA will not solve it.");
        } else if (action === "reconcile" && response.confirmed) {
          setNotice("Moltbook’s verified public feed confirms this post.");
        } else if (action === "reconcile") {
          setNotice(response.message ?? "No verified public post was found yet. No new post was sent.");
        } else if (response.message) {
          setNotice(response.message);
        } else if (action === "approve") {
          setNotice("Approved after the moderation checks. This did not publish the post.");
        } else if (action === "verify") {
          setChallenges(previous => {
            const next = { ...previous };
            delete next[id];
            return next;
          });
          setAnswerById(previous => {
            const next = { ...previous };
            delete next[id];
            return next;
          });
          setNotice("Moltbook confirmed the verification. The post is now marked confirmed.");
        }
      }
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The publication action failed.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setQueueLoading(true);
    try {
      const response = await requestQueue<{ ok: boolean; post: Publication }>("/drafts", "POST", { title, content });
      setTitle("");
      setContent("");
      setPosts(previous => [response.post, ...previous]);
      setNotice("Draft saved. It has not been approved or sent.");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The draft could not be saved.");
    } finally {
      setQueueLoading(false);
    }
  }

  const drafts = posts.filter(post => post.status === "draft");
  const approved = posts.filter(post => ["approved", "publishing", "verification_required", "verifying", "verification_failed", "uncertain"].includes(post.status));
  const confirmed = posts.filter(post => post.status === "published");

  return (
    <article className="tw-moltbook-publish rounded-xl border border-border/30 bg-background/40 p-3" data-testid="moltbook-publication-panel" aria-labelledby="moltbook-publish-title">
      <header className="tw-moltbook-publish-heading">
        <div>
          <h3 id="moltbook-publish-title">Owner-reviewed publishing</h3>
          <p>Separate from the anonymous read-only feed</p>
        </div>
        <span className={`tw-moltbook-publish-switch ${publishingEnabled ? "is-enabled" : ""}`}>
          {publishingEnabled ? "OWNER ENABLED" : "DISABLED"}
        </span>
      </header>

      {!publishingEnabled && (
        <p className="tw-moltbook-publish-lock" role="status">
          Publishing is off by default. Only the owner can explicitly enable it with server-side configuration; drafts and reviews never send posts.
        </p>
      )}

      {authLoading ? (
        <p className="tw-moltbook-publish-note" role="status">Checking owner session…</p>
      ) : !isAdmin ? (
        <p className="tw-moltbook-publish-note" role="status">
          Sign in with the owner session to view drafts, approvals, and publication receipts.
        </p>
      ) : (
        <>
          <form className="tw-moltbook-draft-form" onSubmit={saveDraft}>
            <label htmlFor="moltbook-draft-title">Draft title</label>
            <input
              id="moltbook-draft-title"
              name="title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={300}
              required
              autoComplete="off"
            />
            <label htmlFor="moltbook-draft-content">Draft text</label>
            <textarea
              id="moltbook-draft-content"
              name="content"
              value={content}
              onChange={event => setContent(event.target.value)}
              maxLength={5000}
              rows={4}
              required
            />
            <p className="tw-moltbook-publish-note">
              Checks reject oversized text, hidden control characters, likely credentials, and personal email addresses. The owner must approve the exact text before publishing.
            </p>
            <button className="tw-moltbook-action" type="submit" disabled={queueLoading}>
              {queueLoading ? "Saving…" : "Save draft"}
            </button>
          </form>

          <div className="tw-moltbook-queue-tools">
            <span>{posts.length} of 50 recent local records</span>
            <button type="button" onClick={() => void refresh()} disabled={queueLoading}>
              {queueLoading ? "Refreshing…" : "Refresh queue"}
            </button>
          </div>

          {error && <p className="tw-moltbook-publish-message is-error" role="alert">{error}</p>}
          {notice && <p className="tw-moltbook-publish-message" role="status" aria-live="polite">{notice}</p>}

          <PublicationGroup
            title="Drafts"
            posts={drafts}
            emptyText="No drafts are waiting for owner review."
            busyId={busyId}
            onAction={(id, action) => {
              if (action === "approve" && !window.confirm("Approve this exact title and text? This will not publish it.")) return;
              if (action === "delete" && !window.confirm("Remove this local draft?")) return;
              void runAction(id, action);
            }}
          />
          <PublicationGroup
            title="Approved / awaiting verification"
            posts={approved}
            emptyText="No approved posts are waiting to publish or reconcile."
            busyId={busyId}
            challenges={challenges}
            answerById={answerById}
            setAnswer={(id, answer) => setAnswerById(previous => ({ ...previous, [id]: answer }))}
            onAction={(id, action) => {
              if (action === "publish" && !window.confirm("Publish this exact approved post to Moltbook now?")) return;
              if (action === "delete" && !window.confirm("Remove this local record? This does not delete any Moltbook post.")) return;
              void runAction(id, action, action === "verify" ? {
                verificationCode: challenges[id]?.verificationCode,
                answer: answerById[id],
              } : undefined);
            }}
            publishingEnabled={publishingEnabled}
          />
          <PublicationGroup
            title="Confirmed on Moltbook"
            posts={confirmed}
            emptyText="No publications have been confirmed."
            busyId={busyId}
            onAction={(id, action) => {
              if (action === "delete" && !window.confirm("Remove only the local receipt? The Moltbook post will remain public.")) return;
              void runAction(id, action);
            }}
          />
        </>
      )}
    </article>
  );
}

function PublicationGroup({
  title,
  posts,
  emptyText,
  busyId,
  challenges = {},
  answerById = {},
  setAnswer,
  onAction,
  publishingEnabled = false,
}: {
  title: string;
  posts: Publication[];
  emptyText: string;
  busyId: number | null;
  challenges?: Record<number, VerificationChallenge>;
  answerById?: Record<number, string>;
  setAnswer?: (id: number, value: string) => void;
  onAction: (id: number, action: "approve" | "publish" | "verify" | "reconcile" | "delete") => void;
  publishingEnabled?: boolean;
}) {
  return (
    <section className="tw-moltbook-group" aria-label={title}>
      <h4>{title} <span>{posts.length}</span></h4>
      {posts.length === 0 ? (
        <p className="tw-moltbook-publish-note">{emptyText}</p>
      ) : (
        <ul className="tw-moltbook-queue-list">
          {posts.map(post => {
            const challenge = challenges[post.id];
            const challengeExpired = post.verificationExpiresAt
              ? Date.parse(post.verificationExpiresAt) <= Date.now()
              : false;
            return (
              <li key={post.id} className="tw-moltbook-queue-item" data-testid={`moltbook-publication-${post.id}`}>
                <div className="tw-moltbook-queue-top">
                  <strong>{post.title}</strong>
                  <span className={`tw-moltbook-status is-${post.status}`}>{messageForStatus(post.status)}</span>
                </div>
                <p className="tw-moltbook-queue-content">{post.content}</p>
                {post.moderationFindings.length > 0 && (
                  <ul className="tw-moltbook-findings">
                    {post.moderationFindings.map(finding => <li key={finding.code}>{finding.message}</li>)}
                  </ul>
                )}
                {post.status === "approved" && post.moderationPolicyVersion && (
                  <p className="tw-moltbook-publish-note">Moderator checks passed · {post.moderationPolicyVersion}. Approval applies to this exact text.</p>
                )}
                {post.status === "published" && (
                  <p className="tw-moltbook-publish-note">
                    {post.publishedAt ? `Confirmed ${new Date(post.publishedAt).toLocaleString()}` : "Publication confirmed"}
                    {post.externalPostId ? ` · Moltbook ID ${post.externalPostId}` : ""}
                  </p>
                )}
                {post.status === "uncertain" && (
                  <p className="tw-moltbook-publish-note">No automatic retry is allowed. Check the public account; TESSERA will only reconcile with a verified public-feed match.</p>
                )}
                {post.status === "verification_required" && (
                  challenge && !challengeExpired ? (
                    <form
                      className="tw-moltbook-verification"
                      onSubmit={event => {
                        event.preventDefault();
                        onAction(post.id, "verify");
                      }}
                    >
                      <p><b>Moltbook challenge:</b> {challenge.challengeText}</p>
                      <p className="tw-moltbook-publish-note">Expires {new Date(challenge.expiresAt).toLocaleTimeString()}. The one-time code stays in this page’s memory and is not saved.</p>
                      <label htmlFor={`moltbook-answer-${post.id}`}>Your answer (two decimal places)</label>
                      <input
                        id={`moltbook-answer-${post.id}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={answerById[post.id] ?? ""}
                        onChange={event => setAnswer?.(post.id, event.target.value)}
                        placeholder="15.00"
                        required
                      />
                      <button className="tw-moltbook-action" type="submit" disabled={busyId === post.id || !answerById[post.id]}>
                        {busyId === post.id ? "Verifying…" : "Submit my answer"}
                      </button>
                    </form>
                  ) : (
                    <p className="tw-moltbook-publish-note">
                      {challengeExpired ? "The challenge expired." : "Challenge details were not saved. Complete verification on Moltbook, then check the verified feed here."}
                    </p>
                  )
                )}
                <div className="tw-moltbook-queue-actions">
                  {post.status === "draft" && (
                    <button type="button" className="tw-moltbook-action" disabled={busyId === post.id} onClick={() => onAction(post.id, "approve")}>
                      {busyId === post.id ? "Reviewing…" : "Approve exact text"}
                    </button>
                  )}
                  {post.status === "approved" && (
                    <button type="button" className="tw-moltbook-action" disabled={!publishingEnabled || busyId === post.id} onClick={() => onAction(post.id, "publish")}>
                      {busyId === post.id ? "Sending…" : publishingEnabled ? "Publish to Moltbook" : "Publishing disabled"}
                    </button>
                  )}
                  {(post.status === "verification_required" || post.status === "uncertain") && post.externalPostId && (
                    <button type="button" className="tw-moltbook-action is-secondary" disabled={busyId === post.id} onClick={() => onAction(post.id, "reconcile")}>
                      {busyId === post.id ? "Checking…" : "Check verified public feed"}
                    </button>
                  )}
                  {post.status !== "publishing" && post.status !== "verifying" && (
                    <button type="button" className="tw-moltbook-delete" disabled={busyId === post.id} onClick={() => onAction(post.id, "delete")}>
                      Remove local record
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
