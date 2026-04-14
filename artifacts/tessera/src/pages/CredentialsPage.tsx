import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Key, Eye, EyeOff, Check, Trash2, Cloud, ShoppingBag, MessageCircle, Send, CreditCard, Globe, Server, AlertTriangle, RefreshCw, ExternalLink, Lock, ChevronRight, ArrowRight, CheckCircle2, Circle, Info, Plus, Zap, Code, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/lib/adminContext";

interface FieldDef {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
}

interface StepInstruction {
  step: number;
  text: string;
  link?: string;
  linkLabel?: string;
}

interface ServiceTemplate {
  service: string;
  label: string;
  icon: any;
  color: string;
  description: string;
  fields: FieldDef[];
  loginUrl: string;
  loginLabel: string;
  category: string;
  instructions: StepInstruction[];
  whatItUnlocks: string[];
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    service: "oracle_cloud",
    label: "Oracle Cloud",
    icon: Cloud,
    color: "text-red-400",
    description: "vGPU, CPU, and storage for AI training + autonomous operations",
    category: "Infrastructure",
    loginUrl: "https://cloud.oracle.com",
    loginLabel: "Log into Oracle Cloud Console",
    instructions: [
      { step: 1, text: "Click the button below to open Oracle Cloud Console and sign in", link: "https://cloud.oracle.com", linkLabel: "Open Oracle Cloud Console" },
      { step: 2, text: "Click the Profile icon (top right) then click 'Tenancy: [your-name]' — copy the Tenancy OCID shown there" },
      { step: 3, text: "Go to Identity > Users > click your user — copy the User OCID from the top of that page" },
      { step: 4, text: "On the same user page, scroll to 'API Keys' and click 'Add API Key'" },
      { step: 5, text: "Select 'Generate API Key Pair' — download the private key file, then click 'Add'" },
      { step: 6, text: "A 'Configuration File Preview' will appear — copy the private key PEM contents" },
      { step: 7, text: "Open the downloaded private key file in a text editor and copy the entire contents" },
      { step: 8, text: "For Region: check the top bar in the console (e.g. US East (Ashburn) = 'us-ashburn-1')" },
      { step: 9, text: "For Compartment: go to Identity > Compartments — copy the OCID of your root or target compartment" },
      { step: 10, text: "Paste everything into the fields below and click Save" },
    ],
    whatItUnlocks: [
      "Host local AI models (Llama, Mistral) on GPU instances",
      "Train custom models on all conversation data",
      "Run autonomous agent swarms on dedicated compute",
      "Store training datasets in Object Storage",
      "GPU-accelerated inference for real-time responses",
    ],
    fields: [
      { name: "tenancy_ocid", label: "Tenancy OCID", type: "text", placeholder: "ocid1.tenancy.oc1..aaaa...", required: true },
      { name: "user_ocid", label: "User OCID", type: "text", placeholder: "ocid1.user.oc1..aaaa...", required: true },
      { name: "private_key", label: "Private Key (PEM)", type: "password", placeholder: "-----BEGIN RSA PRIVATE KEY-----", required: true },
      { name: "region", label: "Region", type: "text", placeholder: "us-ashburn-1", required: true },
      { name: "compartment_ocid", label: "Compartment OCID", type: "text", placeholder: "ocid1.compartment.oc1..aaaa...", required: true },
    ],
  },
  {
    service: "shopify",
    label: "Shopify (Sovereign Store)",
    icon: ShoppingBag,
    color: "text-green-400",
    description: "Product management, orders, and blog publishing",
    category: "Revenue",
    loginUrl: "https://admin.shopify.com",
    loginLabel: "Open Shopify Admin",
    instructions: [
      { step: 1, text: "Click below to open your Shopify Admin panel and sign in", link: "https://admin.shopify.com", linkLabel: "Open Shopify Admin" },
      { step: 2, text: "Go to Settings (bottom left gear icon)" },
      { step: 3, text: "Click 'Apps and sales channels' then 'Develop apps'", linkLabel: "Go to App Development" },
      { step: 4, text: "Click 'Create an app' — name it 'Tessera Integration'" },
      { step: 5, text: "In the new app, click 'Configure Admin API scopes' — enable all read/write scopes you want (products, orders, content, etc.)" },
      { step: 6, text: "Click 'Install app' and confirm — then click 'Reveal token once' to see the Admin API access token" },
      { step: 7, text: "Copy the access token (starts with shpat_) and paste it below" },
    ],
    whatItUnlocks: [
      "Publish products to your sovereign store automatically",
      "Create and schedule blog posts for SEO",
      "Process and fulfill orders",
      "Manage inventory across channels",
    ],
    fields: [
      { name: "access_token", label: "Admin API Access Token", type: "password", placeholder: "shpat_...", required: true },
      { name: "store_url", label: "Store URL", type: "text", placeholder: "your-store.myshopify.com", required: true },
    ],
  },
  {
    service: "discord",
    label: "Discord Webhook",
    icon: MessageCircle,
    color: "text-indigo-400",
    description: "Post updates, alerts, and community content to Discord",
    category: "Community",
    loginUrl: "https://discord.com/app",
    loginLabel: "Open Discord",
    instructions: [
      { step: 1, text: "Open Discord and go to the server where you want updates", link: "https://discord.com/app", linkLabel: "Open Discord" },
      { step: 2, text: "Right-click the channel you want to post to and select 'Edit Channel'" },
      { step: 3, text: "Go to Integrations > Webhooks > click 'New Webhook'" },
      { step: 4, text: "Name it 'Tessera' — then click 'Copy Webhook URL'" },
      { step: 5, text: "Paste the webhook URL below" },
    ],
    whatItUnlocks: [
      "Auto-post TSRT price alerts to your community",
      "Share new blog posts and product launches",
      "System status and autonomy updates",
    ],
    fields: [
      { name: "webhook_url", label: "Webhook URL", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: true },
    ],
  },
  {
    service: "telegram",
    label: "Telegram Bot",
    icon: Send,
    color: "text-blue-400",
    description: "Price alerts, community updates, and automated messaging",
    category: "Community",
    loginUrl: "https://t.me/BotFather",
    loginLabel: "Open BotFather on Telegram",
    instructions: [
      { step: 1, text: "Open Telegram and message @BotFather", link: "https://t.me/BotFather", linkLabel: "Open @BotFather" },
      { step: 2, text: "Send /newbot and follow the prompts — pick a name like 'TesseraBot'" },
      { step: 3, text: "BotFather will give you an API token — copy it" },
      { step: 4, text: "Add the bot to your group/channel, then get the Chat ID by messaging the bot and checking https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" },
      { step: 5, text: "Paste both values below" },
    ],
    whatItUnlocks: [
      "Send TSRT price alerts to Telegram groups",
      "Automated community engagement",
      "System notifications on mobile",
    ],
    fields: [
      { name: "bot_token", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", required: true },
      { name: "chat_id", label: "Chat/Group ID", type: "text", placeholder: "-1001234567890", required: false },
    ],
  },
  {
    service: "twitter",
    label: "Twitter / X",
    icon: Globe,
    color: "text-sky-400",
    description: "Auto-post content, engage community, and drive traffic",
    category: "Marketing",
    loginUrl: "https://developer.x.com/en/portal/dashboard",
    loginLabel: "Open X Developer Portal",
    instructions: [
      { step: 1, text: "Go to the X Developer Portal and sign in", link: "https://developer.x.com/en/portal/dashboard", linkLabel: "Open X Developer Portal" },
      { step: 2, text: "Create a new Project and App (if you haven't already)" },
      { step: 3, text: "In your App settings, go to 'Keys and Tokens'" },
      { step: 4, text: "Generate (or regenerate) the API Key & Secret — copy both" },
      { step: 5, text: "Generate Access Token & Secret (with Read and Write permissions) — copy both" },
      { step: 6, text: "Paste all four values below" },
    ],
    whatItUnlocks: [
      "Auto-post TSRT updates, blog content, and product launches",
      "Community engagement and growth",
      "SEO backlinks from social signals",
    ],
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "Your API key", required: true },
      { name: "api_secret", label: "API Secret", type: "password", placeholder: "Your API secret", required: true },
      { name: "access_token", label: "Access Token", type: "password", placeholder: "Your access token", required: true },
      { name: "access_secret", label: "Access Token Secret", type: "password", placeholder: "Your access token secret", required: true },
    ],
  },
  {
    service: "stripe",
    label: "Stripe Payments",
    icon: CreditCard,
    color: "text-purple-400",
    description: "Accept payments for subscriptions, services, and products",
    category: "Revenue",
    loginUrl: "https://dashboard.stripe.com/apikeys",
    loginLabel: "Open Stripe API Keys",
    instructions: [
      { step: 1, text: "Open the Stripe Dashboard and go to API Keys", link: "https://dashboard.stripe.com/apikeys", linkLabel: "Open Stripe API Keys" },
      { step: 2, text: "Copy your 'Secret key' (starts with sk_live_ or sk_test_)" },
      { step: 3, text: "Copy your 'Publishable key' (starts with pk_live_ or pk_test_)" },
      { step: 4, text: "Paste both below" },
    ],
    whatItUnlocks: [
      "Accept subscription payments (Basic/Pro/Sovereign tiers)",
      "Process one-time purchases",
      "Automated invoicing and revenue tracking",
    ],
    fields: [
      { name: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_live_...", required: true },
      { name: "publishable_key", label: "Publishable Key", type: "text", placeholder: "pk_live_...", required: true },
    ],
  },
  {
    service: "elevenlabs",
    label: "ElevenLabs Voice",
    icon: Globe,
    color: "text-pink-400",
    description: "Natural AI voice synthesis for Tessera's speech (Lily voice)",
    category: "AI",
    loginUrl: "https://elevenlabs.io/app/settings/api-keys",
    loginLabel: "Open ElevenLabs API Keys",
    instructions: [
      { step: 1, text: "Open ElevenLabs and go to your API keys page", link: "https://elevenlabs.io/app/settings/api-keys", linkLabel: "Open ElevenLabs Settings" },
      { step: 2, text: "Sign in or create a free account if needed" },
      { step: 3, text: "Click 'Create API Key' or copy your existing key" },
      { step: 4, text: "Paste it below" },
    ],
    whatItUnlocks: [
      "Natural Lily voice for all Tessera speech",
      "High-quality voice responses in real-time",
      "Multilingual voice output",
    ],
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "sk_...", required: true },
    ],
  },
  {
    service: "openai",
    label: "OpenAI",
    icon: Server,
    color: "text-emerald-400",
    description: "GPT models for chat, code generation, and analysis",
    category: "AI",
    loginUrl: "https://platform.openai.com/api-keys",
    loginLabel: "Open OpenAI API Keys",
    instructions: [
      { step: 1, text: "Open OpenAI Platform and go to API Keys", link: "https://platform.openai.com/api-keys", linkLabel: "Open OpenAI API Keys" },
      { step: 2, text: "Click 'Create new secret key'" },
      { step: 3, text: "Name it 'Tessera' and click Create" },
      { step: 4, text: "Copy the key immediately (it won't be shown again)" },
      { step: 5, text: "Paste it below" },
    ],
    whatItUnlocks: [
      "GPT-4o for complex reasoning and analysis",
      "Code generation and debugging",
      "Advanced content creation",
    ],
    fields: [
      { name: "api_key", label: "API Key", type: "password", placeholder: "sk-...", required: true },
    ],
  },
  {
    service: "google_adsense",
    label: "Google AdSense",
    icon: CreditCard,
    color: "text-lime-400",
    description: "Monetize blog traffic with display ads",
    category: "Revenue",
    loginUrl: "https://www.google.com/adsense/start/",
    loginLabel: "Open Google AdSense",
    instructions: [
      { step: 1, text: "Open Google AdSense and sign in", link: "https://www.google.com/adsense/start/", linkLabel: "Open AdSense" },
      { step: 2, text: "If you don't have an account, sign up (requires a website with content)" },
      { step: 3, text: "Once approved, go to Account > Account Information" },
      { step: 4, text: "Copy your Publisher ID (starts with ca-pub-)" },
      { step: 5, text: "Paste it below" },
    ],
    whatItUnlocks: [
      "Passive income from blog and content traffic",
      "Automated ad placement optimization",
      "Revenue tracking and reporting",
    ],
    fields: [
      { name: "publisher_id", label: "Publisher ID", type: "text", placeholder: "ca-pub-XXXXXXXXXXXXXXXX", required: true },
    ],
  },
  {
    service: "klaviyo",
    label: "Klaviyo Email",
    icon: Send,
    color: "text-teal-400",
    description: "Email marketing, abandoned cart flows, and customer engagement",
    category: "Marketing",
    loginUrl: "https://www.klaviyo.com/login",
    loginLabel: "Open Klaviyo",
    instructions: [
      { step: 1, text: "Open Klaviyo and sign in", link: "https://www.klaviyo.com/login", linkLabel: "Open Klaviyo" },
      { step: 2, text: "Go to Account > Settings > API Keys" },
      { step: 3, text: "Copy your Private API Key" },
      { step: 4, text: "Paste it below" },
    ],
    whatItUnlocks: [
      "Automated email sequences for new subscribers",
      "Abandoned cart recovery emails",
      "Product launch announcements",
    ],
    fields: [
      { name: "api_key", label: "Private API Key", type: "password", placeholder: "pk_...", required: true },
    ],
  },
  {
    service: "sentry",
    label: "Sentry Error Tracking",
    icon: AlertTriangle,
    color: "text-orange-400",
    description: "Real-time error monitoring and crash reporting",
    category: "Infrastructure",
    loginUrl: "https://sentry.io/auth/login/",
    loginLabel: "Open Sentry",
    instructions: [
      { step: 1, text: "Open Sentry and sign in", link: "https://sentry.io/auth/login/", linkLabel: "Open Sentry" },
      { step: 2, text: "Go to Settings > Projects > select your project" },
      { step: 3, text: "Click 'Client Keys (DSN)' in the left menu" },
      { step: 4, text: "Copy the DSN value" },
      { step: 5, text: "Paste it below" },
    ],
    whatItUnlocks: [
      "Real-time error alerts and crash reports",
      "Performance monitoring",
      "Issue tracking and resolution",
    ],
    fields: [
      { name: "dsn", label: "DSN", type: "password", placeholder: "https://sentry.io/...", required: true },
    ],
  },
];

export function CredentialCard({ template, savedServices, onSave, onDelete }: {
  template: ServiceTemplate;
  savedServices: string[];
  onSave: (service: string, fields: Record<string, string>) => void;
  onDelete: (service: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const isConnected = savedServices.includes(template.service);
  const Icon = template.icon;

  const handleSave = async () => {
    setSaving(true);
    await onSave(template.service, fields);
    setSaving(false);
    setExpanded(false);
    setFields({});
    setCurrentStep(0);
  };

  const requiredFilled = template.fields.filter(f => f.required).every(f => fields[f.name]?.trim());
  const filledCount = template.fields.filter(f => f.required && fields[f.name]?.trim()).length;
  const requiredCount = template.fields.filter(f => f.required).length;

  return (
    <div
      data-testid={`credential-card-${template.service}`}
      className={cn(
        "rounded-xl border transition-all duration-300",
        isConnected
          ? "border-green-500/25 bg-green-500/5"
          : expanded
            ? "border-cyan-500/30 bg-card/40 shadow-lg shadow-cyan-500/5"
            : "border-border/40 bg-card/25 hover:border-border/60"
      )}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid={`credential-toggle-${template.service}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("p-2 rounded-lg shrink-0", isConnected ? "bg-green-500/10" : "bg-card/60")}>
            <Icon className={cn("w-5 h-5", isConnected ? "text-green-400" : template.color)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground text-sm">{template.label}</span>
              {isConnected && (
                <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-mono">
                  <CheckCircle2 className="w-3 h-3" /> ACTIVE
                </span>
              )}
              <span className="text-[11px] text-muted-foreground bg-card/60 px-2 py-0.5 rounded font-mono">{template.category}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(template.service); }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              data-testid={`credential-delete-${template.service}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-4 space-y-4">
          {isConnected ? (
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-green-400">Connected & Remembered</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Tessera will automatically use these credentials for all {template.label} tasks without asking you again.</p>
              <div className="mt-2 space-y-1">
                {template.whatItUnlocks.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <a
                href={template.loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
                data-testid={`credential-login-${template.service}`}
              >
                <ExternalLink className="w-4 h-4" />
                {template.loginLabel}
                <ArrowRight className="w-4 h-4" />
              </a>

              <div className="p-3 rounded-lg bg-card/40 border border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono">Step-by-step instructions</span>
                </div>
                <div className="space-y-1.5">
                  {template.instructions.map((inst) => {
                    const isDone = inst.step <= currentStep;
                    return (
                      <div
                        key={inst.step}
                        className={cn(
                          "flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all",
                          isDone ? "bg-green-500/5" : inst.step === currentStep + 1 ? "bg-cyan-500/5 border border-cyan-500/20" : ""
                        )}
                        onClick={() => setCurrentStep(isDone ? inst.step - 1 : inst.step)}
                        data-testid={`credential-step-${template.service}-${inst.step}`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <Circle className={cn("w-4 h-4", inst.step === currentStep + 1 ? "text-cyan-400" : "text-muted-foreground/40")} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-[11px]", isDone ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>
                            <span className="font-bold text-muted-foreground">Step {inst.step}:</span> {inst.text}
                          </span>
                          {inst.link && !isDone && (
                            <a
                              href={inst.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 mt-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {inst.linkLabel}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-2 italic font-mono">Tap each step to mark it done as you go</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider font-mono">Paste your credentials</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{filledCount}/{requiredCount} fields</span>
                </div>
                {template.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <div className="relative">
                      {field.type === "password" && field.name === "private_key" ? (
                        <textarea
                          className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:border-cyan-500 focus:outline-none font-mono text-[11px]"
                          rows={4}
                          placeholder={field.placeholder}
                          value={fields[field.name] || ""}
                          onChange={(e) => setFields({ ...fields, [field.name]: e.target.value })}
                          data-testid={`credential-input-${template.service}-${field.name}`}
                        />
                      ) : (
                        <input
                          type={field.type === "password" && !showPasswords[field.name] ? "password" : "text"}
                          className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:border-cyan-500 focus:outline-none"
                          placeholder={field.placeholder}
                          value={fields[field.name] || ""}
                          onChange={(e) => setFields({ ...fields, [field.name]: e.target.value })}
                          data-testid={`credential-input-${template.service}-${field.name}`}
                        />
                      )}
                      {field.type === "password" && field.name !== "private_key" && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPasswords({ ...showPasswords, [field.name]: !showPasswords[field.name] })}
                          type="button"
                        >
                          {showPasswords[field.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={!requiredFilled || saving}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-muted disabled:to-muted disabled:text-muted-foreground text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/10 disabled:shadow-none"
                data-testid={`credential-save-${template.service}`}
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {saving ? "Encrypting & Saving..." : "Save & Remember Forever"}
              </button>

              <div className="p-3 rounded-lg bg-card/30 border border-border/20">
                <span className="text-[11px] font-bold text-emerald-400 block mb-1.5 uppercase tracking-wider font-mono">What this unlocks:</span>
                <div className="space-y-1">
                  {template.whatItUnlocks.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <ArrowRight className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const LLM_PROVIDERS = [
  { id: "openai", label: "OpenAI", keyName: "OPENAI_API_KEY", prefix: "sk-", color: "text-emerald-400" },
  { id: "anthropic", label: "Anthropic Claude", keyName: "ANTHROPIC_API_KEY", prefix: "sk-ant-", color: "text-amber-400" },
  { id: "deepseek", label: "DeepSeek", keyName: "DEEPSEEK_API_KEY", prefix: "sk-", color: "text-teal-400" },
  { id: "cohere", label: "Cohere", keyName: "COHERE_API_KEY", prefix: "", color: "text-orange-400" },
  { id: "groq", label: "Groq", keyName: "GROQ_API_KEY", prefix: "gsk_", color: "text-purple-400" },
  { id: "xai", label: "xAI / Grok", keyName: "GROK_API_KEY", prefix: "xai-", color: "text-blue-400" },
  { id: "openrouter", label: "OpenRouter", keyName: "OPENROUTER_API_KEY", prefix: "or-v1-", color: "text-pink-400" },
  { id: "google", label: "Google Gemini", keyName: "GEMINI_API_KEY", prefix: "AIza", color: "text-yellow-400" },
  { id: "huggingface", label: "HuggingFace", keyName: "HUGGINGFACE_API_KEY", prefix: "hf_", color: "text-amber-300" },
  { id: "github", label: "GitHub", keyName: "GITHUB_TOKEN", prefix: "ghp_", color: "text-slate-300" },
  { id: "elevenlabs", label: "ElevenLabs", keyName: "ELEVENLABS_API_KEY", prefix: "", color: "text-indigo-400" },
  { id: "mistral", label: "Mistral AI", keyName: "MISTRAL_API_KEY", prefix: "mi-", color: "text-cyan-400" },
  { id: "together", label: "Together AI", keyName: "TOGETHER_API_KEY", prefix: "", color: "text-violet-400" },
];

interface StoredKey {
  id: number;
  service: string;
  keyName: string;
  keyValue: string;
  description?: string;
  active: number;
}

function ApiKeyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState(LLM_PROVIDERS[0].id);
  const [customService, setCustomService] = useState("");
  const [customKeyName, setCustomKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [description, setDescription] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  const { data: rawKeys, isLoading } = useQuery<StoredKey[]>({
    queryKey: ["/api/keys"],
    refetchInterval: 30000,
  });
  const keys = rawKeys ?? [];

  const addKey = useMutation({
    mutationFn: async () => {
      const prov = LLM_PROVIDERS.find(p => p.id === provider);
      const service = isCustom ? customService : prov!.id;
      const keyName = isCustom ? customKeyName : prov!.keyName;
      const res = await apiRequest("POST", "/api/keys", { service, keyName, keyValue: keyValue.trim(), description: description || `${service} API key` });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      setKeyValue(""); setDescription(""); setShowAdd(false);
      toast({ title: "API key saved", description: "Key is now active and will be used automatically." });
    },
    onError: () => toast({ title: "Failed to save key", variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "API key removed" });
    },
  });

  const toggleKey = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/keys/${id}/toggle`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/keys"] }),
  });

  const selectedProv = LLM_PROVIDERS.find(p => p.id === provider);

  return (
    <div className="rounded-xl border" style={{ background: "rgba(103,232,249,0.03)", borderColor: "rgba(103,232,249,0.15)" }} data-testid="panel-api-key-manager">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(103,232,249,0.1)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)" }}>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">API Key Manager</h2>
            <p className="text-[11px] text-muted-foreground font-mono">{keys.length} key{keys.length !== 1 ? "s" : ""} stored — used automatically by all agents</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
          style={{ background: showAdd ? "rgba(239,68,68,0.1)" : "rgba(103,232,249,0.1)", border: showAdd ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(103,232,249,0.3)", color: showAdd ? "#f87171" : "#67e8f9" }}
          data-testid="button-toggle-add-key"
        >
          <Plus className="w-3 h-3" style={{ transform: showAdd ? "rotate(45deg)" : "none", transition: "transform 0.2s" }} />
          {showAdd ? "Cancel" : "Add Key"}
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b space-y-3" style={{ borderColor: "rgba(103,232,249,0.08)", background: "rgba(0,0,0,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setIsCustom(false)}
              className={cn("px-3 py-1 rounded-lg text-[11px] font-mono font-bold transition-all", !isCustom ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300" : "bg-background/30 border border-border/40 text-muted-foreground")}
              data-testid="button-preset-provider"
            >Preset Provider</button>
            <button
              onClick={() => setIsCustom(true)}
              className={cn("px-3 py-1 rounded-lg text-[11px] font-mono font-bold transition-all", isCustom ? "bg-violet-500/20 border border-violet-500/40 text-violet-300" : "bg-background/30 border border-border/40 text-muted-foreground")}
              data-testid="button-custom-provider"
            >Custom</button>
          </div>

          {!isCustom ? (
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 font-mono uppercase tracking-wider">Provider</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none font-mono"
                data-testid="select-api-provider"
              >
                {LLM_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label} ({p.keyName})</option>
                ))}
              </select>
              {selectedProv && (
                <p className="text-[11px] text-muted-foreground/60 mt-1 font-mono">Key format: {selectedProv.prefix}••••••••</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-mono">Service name</label>
                <input
                  type="text"
                  placeholder="e.g. perplexity"
                  value={customService}
                  onChange={e => setCustomService(e.target.value)}
                  className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:border-violet-500 focus:outline-none"
                  data-testid="input-custom-service"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 font-mono">Env var name</label>
                <input
                  type="text"
                  placeholder="e.g. PERPLEXITY_API_KEY"
                  value={customKeyName}
                  onChange={e => setCustomKeyName(e.target.value.toUpperCase())}
                  className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:border-violet-500 focus:outline-none font-mono text-[11px]"
                  data-testid="input-custom-keyname"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5 font-mono uppercase tracking-wider">API Key Value</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                placeholder="Paste your API key here..."
                value={keyValue}
                onChange={e => setKeyValue(e.target.value)}
                className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground/40 focus:border-cyan-500 focus:outline-none font-mono"
                data-testid="input-api-key-value"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1.5 font-mono uppercase tracking-wider">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Personal key, Project key..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:border-cyan-500 focus:outline-none"
              data-testid="input-key-description"
            />
          </div>

          <button
            onClick={() => addKey.mutate()}
            disabled={!keyValue.trim() || addKey.isPending || (isCustom && (!customService || !customKeyName))}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(139,92,246,0.3))", border: "1px solid rgba(103,232,249,0.4)", color: "#67e8f9" }}
            data-testid="button-save-api-key"
          >
            {addKey.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {addKey.isPending ? "Saving..." : "Save API Key"}
          </button>
        </div>
      )}

      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {isLoading && (
          <div className="p-4 text-center">
            <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
          </div>
        )}
        {!isLoading && keys.length === 0 && (
          <div className="p-6 text-center">
            <Key className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-mono">No API keys saved yet.</p>
            <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">Add keys above to power up all agents.</p>
          </div>
        )}
        {keys.map((k) => {
          const prov = LLM_PROVIDERS.find(p => p.id === k.service);
          return (
            <div key={k.id} className="flex items-center gap-3 p-3" style={{ opacity: k.active ? 1 : 0.5 }} data-testid={`key-row-${k.id}`}>
              <div className="p-1.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Code className={cn("w-4 h-4", prov?.color || "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground">{prov?.label || k.service}</span>
                  <span className="text-[11px] font-mono text-muted-foreground/60 bg-background/40 px-1.5 py-0.5 rounded">{k.keyName}</span>
                  {k.active ? (
                    <span className="text-[11px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">ACTIVE</span>
                  ) : (
                    <span className="text-[11px] font-mono text-muted-foreground bg-background/40 px-1.5 py-0.5 rounded border border-border/30">PAUSED</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  <span className="text-muted-foreground/50">{k.keyValue || "••••••••"}</span>
                  {k.description && <span className="text-muted-foreground/40"> — {k.description}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleKey.mutate(k.id)}
                  className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-cyan-400"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  data-testid={`button-toggle-key-${k.id}`}
                  title={k.active ? "Pause" : "Activate"}
                >
                  {k.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => deleteKey.mutate(k.id)}
                  className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-red-400"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  data-testid={`button-delete-key-${k.id}`}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminKeySection() {
  const { isAdmin, authenticate, savedAdminKey, saveAdminKey, removeAdminKey } = useAdmin();
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleAuth = async () => {
    setAuthError("");
    const result = await authenticate(adminKeyInput);
    if (result) {
      saveAdminKey(adminKeyInput);
      setAdminKeyInput("");
    } else {
      setAuthError("Invalid admin key");
    }
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(6,182,212,0.04))", border: "1px solid rgba(139,92,246,0.2)" }} data-testid="admin-key-section">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-bold text-foreground">Father Protocol — Admin Key</span>
        {isAdmin && <span className="text-[11px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20" data-testid="text-admin-active">AUTHENTICATED</span>}
      </div>
      {isAdmin ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground font-mono">Sovereign access granted. Full control over all 28 agents, 12 entities, and 5 LLMs.</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-violet-300/60">Key: {savedAdminKey ? "••••••••" + savedAdminKey.slice(-4) : "session-only"}</span>
            <button onClick={removeAdminKey} className="text-[11px] text-red-400 hover:text-red-300 font-mono" data-testid="button-remove-admin-key">Remove saved key</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground font-mono">Enter your admin verification key to unlock sovereign control.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showAdminKey ? "text" : "password"}
                placeholder="Admin key..."
                value={adminKeyInput}
                onChange={e => setAdminKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && adminKeyInput && handleAuth()}
                className="w-full bg-background/60 border border-border/50 rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground/40 focus:border-violet-500 focus:outline-none font-mono"
                data-testid="input-admin-key"
              />
              <button
                type="button"
                onClick={() => setShowAdminKey(!showAdminKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleAuth}
              disabled={!adminKeyInput.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#a78bfa" }}
              data-testid="button-auth-admin"
            >
              Authenticate
            </button>
          </div>
          {authError && <p className="text-[11px] text-red-400 font-mono" data-testid="text-admin-error">{authError}</p>}
        </div>
      )}
    </div>
  );
}

export default function CredentialsPage({ embedded }: { embedded?: boolean }) {
  useEffect(() => { document.title = "Credentials | Tessera"; }, []);
  const queryClient = useQueryClient();

  const { data: rawSavedServices } = useQuery<string[]>({
    queryKey: ["/api/human-actions/saved/services"],
    select: (data: any) => {
      if (Array.isArray(data)) return data.map((s: any) => s.service || s);
      if (data && typeof data === "object") return Object.keys(data);
      return [];
    },
    refetchInterval: 30000,
  });
  const savedServices = rawSavedServices ?? [];

  const saveMutation = useMutation({
    mutationFn: async ({ service, fields }: { service: string; fields: Record<string, string> }) => {
      const template = SERVICE_TEMPLATES.find(t => t.service === service);
      const res = await fetch("/api/human-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "login",
          service,
          title: `Connect ${template?.label || service}`,
          description: `Credentials for ${template?.label || service}`,
          priority: "high",
          autoRetryable: true,
          requiredBy: "credentials-portal",
          fields: Object.entries(fields).map(([name, value]) => ({
            name,
            label: template?.fields.find(f => f.name === name)?.label || name,
            type: "text",
            required: true,
            value,
          })),
        }),
      });
      const action = await res.json();
      if (action.id) {
        await fetch(`/api/human-actions/${action.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: fields, saveForLater: true }),
        });
      }
      if (service === "oracle_cloud") {
        await fetch("/api/credentials/oracle/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
      }
      return action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/human-actions/saved/services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (service: string) => {
      await fetch(`/api/human-actions/saved/${service}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/human-actions/saved/services"] });
    },
  });

  const connectedCount = SERVICE_TEMPLATES.filter(t => savedServices.includes(t.service)).length;
  const categories = [...new Set(SERVICE_TEMPLATES.map(t => t.category))];

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden tessera-page backdrop-blur-md" data-testid="credentials-page">
      <div className="flex h-[200px] md:h-full md:w-[340px] shrink-0 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at center, transparent 30%, #05020f 75%)"
        }} />
        <div
          data-testid="img-tesseract-cube"
          className="w-full h-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,200,255,0.15) 0%, rgba(100,50,200,0.1) 40%, transparent 70%)",
            maskImage: "radial-gradient(ellipse 70% 60% at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at center, black 20%, transparent 70%)",
            opacity: 0.9,
          }}
        />
        <div className="absolute inset-0 pointer-events-none hidden md:block" style={{
          background: "linear-gradient(to right, transparent 0%, transparent 70%, #05020f 100%)"
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, #05020f 0%, transparent 15%, transparent 85%, #05020f 100%)"
        }} />
        <div className="absolute bottom-4 md:bottom-8 left-0 right-0 text-center pointer-events-none">
          <p className="text-[11px] text-cyan-400/40 font-mono tracking-[0.3em] uppercase">Tesseract</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at -20% 50%, rgba(6,182,212,0.03) 0%, transparent 50%), radial-gradient(ellipse at 120% 0%, rgba(139,92,246,0.02) 0%, transparent 50%)"
        }} />
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5 pb-20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                <Key className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground" data-testid="text-credentials-title">Credentials Portal</h1>
                <p className="text-[11px] text-cyan-400/50 font-mono">Connect once — Tessera remembers everything and works autonomously</p>
              </div>
            </div>

            <AdminKeySection />

            <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-foreground font-medium">{connectedCount} of {SERVICE_TEMPLATES.length} services connected</span>
                </div>
                <span className="text-sm text-cyan-400 font-bold font-mono">{Math.round((connectedCount / SERVICE_TEMPLATES.length) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(connectedCount / SERVICE_TEMPLATES.length) * 100}%` }}
                  data-testid="progress-credentials"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">Each connection lets Tessera handle that service fully on its own</p>
            </div>

            <div className="p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] text-amber-300 font-bold">How it works</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono leading-relaxed">
                    1. Click a service to expand it &nbsp; 2. Click the login button to open it in a new tab &nbsp; 3. Follow the step-by-step instructions &nbsp; 4. Paste credentials here &nbsp; 5. Hit Save — encrypted and remembered forever. Next time any task needs it, Tessera handles it automatically.
                  </p>
                </div>
              </div>
            </div>

            {categories.map((category) => (
              <div key={category}>
                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 font-mono">{category}</h2>
                <div className="space-y-2">
                  {SERVICE_TEMPLATES.filter(t => t.category === category).map((template) => (
                    <CredentialCard
                      key={template.service}
                      template={template}
                      savedServices={savedServices}
                      onSave={(service, fields) => saveMutation.mutate({ service, fields })}
                      onDelete={(service) => deleteMutation.mutate(service)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 font-mono">LLM & API Keys</h2>
              <ApiKeyManager />
            </div>

            <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-foreground">Security & Auto-Memory</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 font-mono">
                <li className="flex items-start gap-2"><Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> All credentials encrypted with AES-256-CBC before storage</li>
                <li className="flex items-start gap-2"><Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> Private keys never exposed after initial save</li>
                <li className="flex items-start gap-2"><Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> Saved credentials reused automatically — no re-entering, no re-asking</li>
                <li className="flex items-start gap-2"><Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> Every system (training, posting, payments, voice) checks saved credentials first</li>
                <li className="flex items-start gap-2"><Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" /> Delete anytime — removed from encrypted storage immediately</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
