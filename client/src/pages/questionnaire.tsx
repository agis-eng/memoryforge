import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, SkipForward, Download, Copy, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { apiRequest } from "@/lib/queryClient";

interface Section {
  id: string;
  title: string;
  subtitle: string;
  questions: { id: string; label: string; placeholder: string; type: 'text' | 'textarea' }[];
}

const SECTIONS: Section[] = [
  {
    id: "identity",
    title: "Identity",
    subtitle: "The basics — who you are",
    questions: [
      { id: "name", label: "What's your name?", placeholder: "e.g., Erik Laine", type: "text" },
      { id: "role_company", label: "What do you do for work? (Role/title and company or industry)", placeholder: "e.g., Founder at a digital marketing agency, SaaS entrepreneur, Product Manager at a tech company...", type: "textarea" },
    ],
  },
  {
    id: "expertise",
    title: "Expertise & Skills",
    subtitle: "What you bring to the table",
    questions: [
      { id: "skills", label: "What are your key skills and areas of expertise?", placeholder: "e.g., Full-stack development, e-commerce operations, digital marketing, API integrations...", type: "textarea" },
      { id: "years_experience", label: "How many years of experience do you have in your field?", placeholder: "e.g., 8 years", type: "text" },
      { id: "known_for", label: "What are you known for professionally? What do people come to you for?", placeholder: "e.g., Building automated workflows, scaling e-commerce stores, troubleshooting complex technical setups...", type: "textarea" },
    ],
  },
  {
    id: "projects",
    title: "Current Work",
    subtitle: "What's on your plate right now",
    questions: [
      { id: "current_projects", label: "What are you actively working on right now? (Projects, initiatives, areas of focus)", placeholder: "e.g., Building a SaaS product, scaling my agency, launching a new e-commerce brand...", type: "textarea" },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    subtitle: "Where you're headed",
    questions: [
      { id: "short_term_goals", label: "What are your main short-term goals? (next few months)", placeholder: "e.g., Launch MVP, close 10 new clients, automate lead generation...", type: "textarea" },
      { id: "long_term_goals", label: "What are your long-term goals?", placeholder: "e.g., Build a self-sustaining business, scale to 7 figures, exit the business...", type: "textarea" },
      { id: "ai_help", label: "What specifically would you want AI to help you with?", placeholder: "e.g., Content creation, customer support automation, data analysis, code review...", type: "textarea" },
    ],
  },
  {
    id: "working-style",
    title: "Communication Preferences",
    subtitle: "How you like to work with AI",
    questions: [
      { id: "detail_preference", label: "When interacting with AI, do you prefer concise responses (bullet points, straight to the point), detailed responses (thorough explanations), or somewhere in between?", placeholder: "e.g., Concise — I want the answer fast. Or: Detailed — I like thorough explanations with context.", type: "textarea" },
      { id: "tone_preference", label: "What tone works best for you — casual, professional, or technical?", placeholder: "e.g., Casual but competent, professional, technical and precise...", type: "text" },
      { id: "comm_style", label: "How would you describe your communication style?", placeholder: "e.g., I think out loud, prefer structured frameworks, dive straight into solutions, like visual explanations...", type: "textarea" },
    ],
  },
  {
    id: "tools",
    title: "Tools & Stack",
    subtitle: "Your daily software and platforms",
    questions: [
      { id: "daily_tools", label: "What software, tools, and platforms do you use daily?", placeholder: "e.g., VS Code, Notion, Slack, Google Workspace, Shopify, GoHighLevel, GitHub, Vercel...", type: "textarea" },
    ],
  },
  {
    id: "people",
    title: "Key People",
    subtitle: "Important relationships in your work",
    questions: [
      { id: "key_people", label: "Are there key people AI should know about — team members, clients, collaborators? (Names and roles)", placeholder: "e.g., Anton — business partner. Sarah — VA. Mike — lead developer. Or: Solo operator, no team yet.", type: "textarea" },
    ],
  },
  {
    id: "personal",
    title: "Personal Context",
    subtitle: "Location, timezone, and anything else",
    questions: [
      { id: "location", label: "Where are you located?", placeholder: "e.g., Atlanta, GA", type: "text" },
      { id: "timezone", label: "What timezone are you in?", placeholder: "e.g., Eastern (EST/EDT)", type: "text" },
      { id: "personal_facts", label: "Anything else that would help AI understand you better? (Hobbies, values, communication quirks, anything)", placeholder: "e.g., Early riser (5am), prefer async communication, big on efficiency, hobby: travel with family...", type: "textarea" },
    ],
  },
];

type PageView = 'form' | 'generating' | 'preview';

export default function QuestionnairePage() {
  const [, navigate] = useLocation();
  const [pageView, setPageView] = useState<PageView>('form');
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);
  const [memoryFile, setMemoryFile] = useState('');
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const section = SECTIONS[currentSection];
  const progress = Math.round(((currentSection) / SECTIONS.length) * 100);
  const isLastSection = currentSection === SECTIONS.length - 1;

  useEffect(() => {
    formRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentSection]);

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const sectionHasAnswers = () => {
    return section.questions.some(q => (answers[q.id] || "").trim().length > 0);
  };

  const goNext = () => {
    if (isLastSection) {
      generateMemory();
    } else {
      setDirection(1);
      setCurrentSection(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (currentSection > 0) {
      setDirection(-1);
      setCurrentSection(prev => prev - 1);
    }
  };

  const skipSection = () => {
    if (!isLastSection) {
      setDirection(1);
      setCurrentSection(prev => prev + 1);
    }
  };

  const generateMemory = useCallback(async () => {
    setPageView('generating');

    // Build conversation-like message history from form answers
    const messages: { role: string; content: string }[] = [];

    for (const sec of SECTIONS) {
      const sectionAnswers = sec.questions
        .map(q => {
          const answer = (answers[q.id] || "").trim();
          if (!answer) return null;
          return `${q.label}\n${answer}`;
        })
        .filter(Boolean);

      if (sectionAnswers.length > 0) {
        messages.push({
          role: "assistant",
          content: `Let's talk about your ${sec.title.toLowerCase()}. ${sec.questions.map(q => q.label).join(" ")}`,
        });
        messages.push({
          role: "user",
          content: sectionAnswers.join("\n\n"),
        });
      }
    }

    try {
      const res = await apiRequest("POST", "/api/generate-memory", { messages });
      const data = await res.json();
      setMemoryFile(data.memoryFile);
      setPageView('preview');
    } catch (error) {
      console.error("Memory generation failed:", error);
      setPageView('form');
    }
  }, [answers]);

  const downloadFile = useCallback(() => {
    const blob = new Blob([memoryFile], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-ai-memory.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [memoryFile]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(memoryFile);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = memoryFile;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [memoryFile]);

  // === GENERATING VIEW ===
  if (pageView === 'generating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 px-6 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Generating Your Memory File</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Building your personalized AI memory profile from your answers...
          </p>
        </motion.div>
      </div>
    );
  }

  // === PREVIEW VIEW ===
  if (pageView === 'preview') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex-shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/")}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-2">
                <Logo size={24} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">MemoryForge</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={downloadFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download .md
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Your AI Memory File</h2>
              <p className="text-xs text-muted-foreground">Copy and paste this into any AI system's memory or instructions.</p>
            </div>
            <pre className="text-sm text-foreground/90 bg-card border border-border/60 rounded-xl p-6 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
              {memoryFile}
            </pre>
          </div>
        </div>

        <footer className="px-6 py-4 text-center border-t border-border/60">
          <PerplexityAttribution />
        </footer>
      </div>
    );
  }

  // === FORM VIEW ===
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <Logo size={24} className="text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground leading-tight">MemoryForge</div>
                <div className="text-[11px] text-muted-foreground leading-tight">Questionnaire Mode</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {currentSection + 1} of {SECTIONS.length}
          </div>
        </div>
        <div className="px-4 pb-2 max-w-2xl mx-auto">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={formRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25 }}
            >
              {/* Section header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-primary tracking-wider">
                    {String(currentSection + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.subtitle}</p>
              </div>

              {/* Questions */}
              <div className="space-y-6">
                {section.questions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {q.label}
                    </label>
                    {q.type === "textarea" ? (
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex-shrink-0 border-t border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={currentSection === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {!isLastSection && (
              <button
                onClick={skipSection}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Skip
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!sectionHasAnswers() && !isLastSection}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isLastSection
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 px-6"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isLastSection ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate My Memory File
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Section dots */}
      <div className="flex-shrink-0 bg-background border-t border-border/30 py-2">
        <div className="max-w-2xl mx-auto px-4 flex justify-center gap-1.5">
          {SECTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentSection ? 1 : -1);
                setCurrentSection(i);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentSection
                  ? "bg-primary w-6"
                  : i < currentSection
                  ? "bg-primary/40"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
