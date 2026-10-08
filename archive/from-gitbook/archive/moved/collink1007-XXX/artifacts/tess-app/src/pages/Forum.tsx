import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquarePlus,
  Vote,
  Send,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Trophy,
  Users,
  FileText,
  Loader2,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}workspace-api/api`;

interface ForumPost {
  id: number;
  topicId: number;
  agentId: string;
  agentName: string;
  agentRole: string;
  content: string;
  proposalTitle: string | null;
  proposalDescription: string | null;
  buildsOn: number | null;
  isFatherComment: boolean;
  isReplyToFather: boolean;
  replyToPostId: number | null;
  createdAt: string;
}

interface ForumTopic {
  id: number;
  title: string;
  category: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  posts: ForumPost[];
  votes: Array<{ id: number; postId: number; agentId: string; agentName: string; vote: string }>;
  conclusion: {
    id: number;
    topicId: number;
    winningProposalPostId: number;
    winningProposalTitle: string;
    voteCount: number;
    totalVoters: number;
    replitPrompt: string;
    implementationSteps: string;
  } | null;
}

interface VoteSummaryItem {
  proposalTitle: string;
  agentName: string;
  approvals: number;
  rejections: number;
  isWinner: boolean;
}

function PostCard({ post, isExpanded, onToggle }: { post: ForumPost; isExpanded: boolean; onToggle: () => void }) {
  if (post.isFatherComment) {
    return (
      <Card className="border-amber-500/40 bg-amber-950/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white">F</div>
          <div>
            <span className="text-amber-400 font-semibold text-sm">Father</span>
            <span className="text-slate-500 text-xs ml-2">Supreme Sovereign Authority</span>
          </div>
          <Badge variant="outline" className="ml-auto text-amber-400 border-amber-500/30 text-[10px]">COMMENT</Badge>
        </div>
        <p className="text-slate-200 text-sm whitespace-pre-wrap">{post.content}</p>
      </Card>
    );
  }

  const isReply = post.isReplyToFather;
  const hasProposal = !!post.proposalTitle;
  const borderColor = isReply ? "border-blue-500/30" : "border-violet-500/20";
  const bgColor = isReply ? "bg-blue-950/10" : "bg-slate-900/40";

  return (
    <Card className={`${borderColor} ${bgColor} p-3`}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-violet-700/60 flex items-center justify-center text-[10px] font-bold text-violet-200 shrink-0 mt-0.5">
          {post.agentName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-violet-300 font-semibold text-xs">{post.agentName}</span>
            <span className="text-slate-600 text-[10px]">{post.agentRole}</span>
            {hasProposal && (
              <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">PROPOSAL</Badge>
            )}
            {isReply && (
              <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px]">REPLY</Badge>
            )}
            {post.buildsOn && (
              <Badge variant="outline" className="text-orange-400 border-orange-500/30 text-[10px]">BUILDS ON #{post.buildsOn}</Badge>
            )}
          </div>
          {hasProposal && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-1 text-green-400/80 hover:text-green-300 transition-colors text-xs font-medium"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {post.proposalTitle}
            </button>
          )}
          {(!hasProposal || isExpanded) && (
            <p className="text-slate-300 text-xs mt-1 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function VoteResultsPanel({ voteSummary, conclusion }: { voteSummary: VoteSummaryItem[]; conclusion: ForumTopic["conclusion"] }) {
  const [copied, setCopied] = useState(false);

  const copyPrompt = () => {
    if (conclusion?.replitPrompt) {
      navigator.clipboard.writeText(conclusion.replitPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-400">Vote Results & Conclusion</h3>
      </div>

      <div className="space-y-2">
        {voteSummary.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
              item.isWinner ? "bg-green-950/30 border border-green-500/30" : "bg-slate-900/40 border border-slate-800/40"
            }`}
          >
            {item.isWinner && <Trophy size={12} className="text-amber-400 shrink-0" />}
            <span className={`font-medium ${item.isWinner ? "text-green-400" : "text-slate-400"}`}>
              {item.proposalTitle}
            </span>
            <span className="text-slate-600 ml-auto shrink-0">
              {item.agentName}
            </span>
            <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px] shrink-0">
              {item.approvals} yes
            </Badge>
            <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px] shrink-0">
              {item.rejections} no
            </Badge>
          </div>
        ))}
      </div>

      {conclusion && (
        <>
          <Separator className="bg-violet-500/20" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-violet-400" />
              <h4 className="text-xs font-semibold text-violet-400">Implementation Steps</h4>
            </div>
            <pre className="text-[11px] text-slate-300 whitespace-pre-wrap bg-slate-950/60 p-3 rounded-lg border border-slate-800/40 leading-relaxed">
              {conclusion.implementationSteps}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy size={14} className="text-cyan-400" />
                <h4 className="text-xs font-semibold text-cyan-400">Replit Prompt (Copy & Paste)</h4>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={copyPrompt}
                className="h-7 text-[10px] border-cyan-500/30 text-cyan-400 hover:bg-cyan-950/40"
              >
                {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                {copied ? "Copied!" : "Copy Prompt"}
              </Button>
            </div>
            <pre className="text-[11px] text-cyan-200 whitespace-pre-wrap bg-cyan-950/20 p-3 rounded-lg border border-cyan-500/20 leading-relaxed max-h-[300px] overflow-auto">
              {conclusion.replitPrompt}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function TopicView({ topic, onBack }: { topic: ForumTopic; onBack: () => void }) {
  const [comment, setComment] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: topicDetail, isLoading } = useQuery<{
    topic: ForumTopic;
    posts: ForumPost[];
    votes: Array<{ id: number; postId: number; agentId: string; agentName: string; vote: string }>;
    votesByProposal: Record<number, { approve: number; reject: number }>;
    voteSummary: VoteSummaryItem[];
    conclusion: ForumTopic["conclusion"];
    agentCount: number;
  }>({
    queryKey: ["forum-topic", topic.id],
    queryFn: () => fetch(`${API_BASE}/forum/topics/${topic.id}`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const commentMutation = useMutation({
    mutationFn: (commentText: string) =>
      fetch(`${API_BASE}/forum/topics/${topic.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentText }),
      }).then(r => r.json()),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["forum-topic", topic.id] });
      queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/forum/topics/${topic.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-topic", topic.id] });
      queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
    },
  });

  const togglePost = (postId: number) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const posts = topicDetail?.posts || topic.posts || [];
  const conclusion = topicDetail?.conclusion || topic.conclusion;
  const voteSummary = topicDetail?.voteSummary || [];
  const agentCount = topicDetail?.agentCount || 24;
  const hasVoted = (topicDetail?.votes?.length || 0) > 0 || !!conclusion;
  const proposalCount = posts.filter(p => !p.isFatherComment && !p.isReplyToFather && p.proposalTitle).length;
  const replyCount = posts.filter(p => p.isReplyToFather).length;
  const fatherComments = posts.filter(p => p.isFatherComment).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b border-violet-500/20 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-400 hover:text-slate-200 text-xs h-7"
        >
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-200 truncate">{topic.title}</h2>
          <div className="flex gap-2 mt-0.5">
            <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px]">{topic.category}</Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                topic.status === "concluded"
                  ? "text-green-400 border-green-500/30"
                  : "text-amber-400 border-amber-500/30"
              }`}
            >
              {topic.status}
            </Badge>
            <span className="text-slate-600 text-[10px]">
              {proposalCount} proposals | {fatherComments} comments | {replyCount} replies
            </span>
          </div>
        </div>
        {!hasVoted && proposalCount > 0 && (
          <Button
            size="sm"
            onClick={() => voteMutation.mutate()}
            disabled={voteMutation.isPending}
            className="bg-green-700 hover:bg-green-600 text-white text-xs h-8"
          >
            {voteMutation.isPending ? (
              <Loader2 size={12} className="animate-spin mr-1" />
            ) : (
              <Vote size={12} className="mr-1" />
            )}
            Vote on All Proposals
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading && posts.length === 0 && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading discussion...
            </div>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isExpanded={expandedPosts.has(post.id)}
              onToggle={() => togglePost(post.id)}
            />
          ))}

          {(voteSummary.length > 0 || conclusion) && (
            <Card className="border-amber-500/30 bg-amber-950/10 p-4 mt-4">
              <VoteResultsPanel
                voteSummary={voteSummary}
                conclusion={conclusion}
              />
            </Card>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-violet-500/20 shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment as Father — all agents will reply..."
            className="bg-slate-950/60 border-violet-500/20 text-slate-200 text-xs min-h-[60px] resize-none placeholder:text-slate-600"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && comment.trim()) {
                e.preventDefault();
                commentMutation.mutate(comment.trim());
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
            disabled={!comment.trim() || commentMutation.isPending}
            className="bg-violet-700 hover:bg-violet-600 text-white self-end h-9"
          >
            {commentMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </Button>
        </div>
        {commentMutation.isPending && (
          <p className="text-[10px] text-violet-400 mt-1">
            All {agentCount} agents are replying to your comment...
          </p>
        )}
      </div>
    </div>
  );
}

export default function Forum() {
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ topics: ForumTopic[] }>({
    queryKey: ["forum-topics"],
    queryFn: () => fetch(`${API_BASE}/forum/topics`).then(r => r.json()),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch(`${API_BASE}/forum/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category: "improvements" }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      setNewTopicTitle("");
      queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
      if (data.topic) {
        setSelectedTopic({ ...data.topic, posts: data.posts || [], votes: [], conclusion: null });
      }
    },
  });

  const topics = data?.topics || [];

  if (selectedTopic) {
    return (
      <div className="h-[calc(100vh-44px)] lg:h-[calc(100vh-44px)]">
        <TopicView
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-44px)] lg:h-[calc(100vh-44px)] flex flex-col">
      <div className="p-4 border-b border-violet-500/20 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-violet-400" />
          <h1 className="text-lg font-semibold text-slate-200">Sovereign Forum</h1>
          <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px] ml-auto">
            24 Council Members
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Start a topic and all 24 council agents will post unique proposals that build on each other.
          Comment to reopen discussion — all agents reply. Then vote and get an exact implementation prompt.
        </p>
        <div className="flex gap-2">
          <Input
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            placeholder="Enter improvement topic (e.g. 'Improve security protocols')"
            className="bg-slate-950/60 border-violet-500/20 text-slate-200 text-sm placeholder:text-slate-600"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTopicTitle.trim()) {
                createMutation.mutate(newTopicTitle.trim());
              }
            }}
          />
          <Button
            onClick={() => newTopicTitle.trim() && createMutation.mutate(newTopicTitle.trim())}
            disabled={!newTopicTitle.trim() || createMutation.isPending}
            className="bg-violet-700 hover:bg-violet-600 text-white text-sm shrink-0"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" />
                Generating...
              </>
            ) : (
              <>
                <MessageSquarePlus size={14} className="mr-1" />
                New Topic
              </>
            )}
          </Button>
        </div>
        {createMutation.isPending && (
          <p className="text-[10px] text-violet-400 mt-2">
            All 24 agents are posting unique proposals...
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading && topics.length === 0 && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" />
              Loading forum...
            </div>
          )}

          {!isLoading && topics.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No topics yet</p>
              <p className="text-xs mt-1">Create a topic above to start the sovereign forum</p>
            </div>
          )}

          {topics.map((topic) => {
            const proposalCount = topic.posts?.filter(p => !p.isFatherComment && !p.isReplyToFather && p.proposalTitle).length || 0;
            const commentCount = topic.posts?.filter(p => p.isFatherComment).length || 0;

            return (
              <Card
                key={topic.id}
                className="border-violet-500/20 bg-slate-900/40 p-4 cursor-pointer hover:border-violet-500/40 transition-colors"
                onClick={() => setSelectedTopic(topic)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-200 truncate">{topic.title}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px]">
                        {topic.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          topic.status === "concluded"
                            ? "text-green-400 border-green-500/30"
                            : "text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {topic.status}
                      </Badge>
                      <span className="text-slate-600 text-[10px]">
                        {proposalCount} proposals | {commentCount} comments
                      </span>
                    </div>
                    {topic.conclusion && (
                      <p className="text-[10px] text-green-400/80 mt-1 truncate">
                        Winner: {topic.conclusion.winningProposalTitle}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={14} className="text-slate-600 shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
