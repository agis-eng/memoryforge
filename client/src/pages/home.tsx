import { useState, useEffect, useRef, useCallback } from 'react';
import { Logo } from '@/components/Logo';
import { PerplexityAttribution } from '@/components/PerplexityAttribution';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { ArrowRight, Download, Copy, Check, Sparkles, Brain, Zap, FileText, MessageCircle, ClipboardList } from 'lucide-react';

type AppView = 'landing' | 'chat' | 'preview';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  id: number;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<AppView>('landing');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaitingForAPI, setIsWaitingForAPI] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null);
  const [memoryFile, setMemoryFile] = useState('');
  const [copied, setCopied] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgIdCounter = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedText, scrollToBottom]);

  // Typewriter effect
  const typeMessage = useCallback((text: string, msgId: number): Promise<void> => {
    return new Promise((resolve) => {
      setIsTyping(true);
      setTypingMessageId(msgId);
      setDisplayedText('');

      let index = 0;
      const speed = 18;

      const timer = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.substring(0, index + 1));
          index++;
        } else {
          clearInterval(timer);
          setIsTyping(false);
          setTypingMessageId(null);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text } : m));
          resolve();
        }
      }, speed);
    });
  }, []);

  // Call the chat API
  const callChatAPI = useCallback(async (conversationMessages: { role: string; content: string }[]) => {
    try {
      const res = await apiRequest('POST', '/api/chat', {
        messages: conversationMessages,
        collectedData: {},
      });
      const data = await res.json();
      return data as { message: string; isComplete: boolean };
    } catch (error) {
      console.error('Chat API error:', error);
      return { message: "Sorry, I'm having trouble connecting. Please try again.", isComplete: false };
    }
  }, []);

  // Call the generate-memory API
  const callGenerateMemoryAPI = useCallback(async (conversationMessages: { role: string; content: string }[]) => {
    try {
      const res = await apiRequest('POST', '/api/generate-memory', {
        messages: conversationMessages,
      });
      const data = await res.json();
      return data as { memoryFile: string };
    } catch (error) {
      console.error('Generate memory API error:', error);
      return { memoryFile: 'Failed to generate memory file. Please try again.' };
    }
  }, []);

  // Start chat — get the first bot greeting from the API
  const startChat = useCallback(async () => {
    setView('chat');
    setIsWaitingForAPI(true);

    // Add a placeholder bot message with loading dots
    const msgId = ++msgIdCounter.current;
    const botMsg: ChatMessage = { role: 'assistant', content: '', id: msgId };
    setMessages([botMsg]);

    // Call API with empty message history to get the initial greeting
    const response = await callChatAPI([]);

    setIsWaitingForAPI(false);
    await typeMessage(response.message, msgId);
  }, [typeMessage, callChatAPI]);

  // Send user message
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isTyping || isWaitingForAPI) return;

    const userText = inputValue.trim();
    setInputValue('');

    // Add user message
    const userMsgId = ++msgIdCounter.current;
    const userMsg: ChatMessage = { role: 'user', content: userText, id: userMsgId };

    setMessages(prev => [...prev, userMsg]);

    // Build conversation history for API (only completed messages, not the ones still typing)
    const currentMessages = [...messages.filter(m => m.content), { role: 'user' as const, content: userText }];
    const apiMessages = currentMessages.map(m => ({ role: m.role, content: m.content }));

    // Show loading state
    setIsWaitingForAPI(true);
    const botMsgId = ++msgIdCounter.current;
    const botMsg: ChatMessage = { role: 'assistant', content: '', id: botMsgId };
    setMessages(prev => [...prev, botMsg]);

    // Call API
    const response = await callChatAPI(apiMessages);

    setIsWaitingForAPI(false);

    if (response.isComplete) {
      setIsComplete(true);
      // Clean the response — strip the GENERATE_MEMORY_FILE marker and any JSON for display
      let cleanMessage = response.message;
      const markerIndex = cleanMessage.indexOf('GENERATE_MEMORY_FILE');
      if (markerIndex !== -1) {
        cleanMessage = cleanMessage.substring(0, markerIndex).trim();
        if (!cleanMessage) {
          cleanMessage = "I have all the information I need to generate your memory file!";
        }
      }
      await typeMessage(cleanMessage, botMsgId);
    } else {
      await typeMessage(response.message, botMsgId);
    }
  }, [inputValue, isTyping, isWaitingForAPI, messages, callChatAPI, typeMessage]);

  // Generate memory file
  const handleGenerateMemory = useCallback(async () => {
    setIsGenerating(true);

    const conversationMessages = messages
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }));

    const response = await callGenerateMemoryAPI(conversationMessages);
    setMemoryFile(response.memoryFile);
    setIsGenerating(false);
    setView('preview');
  }, [messages, callGenerateMemoryAPI]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Download file
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

  // Copy to clipboard
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

  // Render markdown-like bold and bullet points
  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const isBullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');

      const parts = line.split(/(\*\*.*?\*\*)/g);
      const rendered = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      });

      if (isBullet) {
        return <div key={lineIdx} className="pl-1 mt-0.5">{rendered}</div>;
      }
      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }
      return <div key={lineIdx}>{rendered}</div>;
    });
  };

  // Section names for the progress indicator
  const SECTION_NAMES: Record<number, string> = {
    1: 'Identity & Background',
    2: 'Business Overview',
    3: 'Brand, Positioning & Voice',
    4: 'Operations, Tools & Workflows',
    5: 'Customers, Problems & Objections',
    6: 'Current Priorities & Constraints',
    7: 'Personal AI Preferences',
    8: 'Knowledge Boundaries & Sources',
    9: 'Security, Privacy & Boundaries',
    10: 'House Rules & Meta-Preferences',
    11: 'Technical & Coding Profile',
  };

  // Detect current section from AI messages
  const currentSection = (() => {
    // Scan all assistant messages (completed ones) for section references
    const assistantMessages = messages
      .filter(m => m.role === 'assistant' && m.content)
      .map(m => m.content);
    
    let detected = 1; // default to section 1
    for (const text of assistantMessages) {
      // Match patterns like "Section 5", "section 5", "Moving on to Section 5", etc.
      const matches = text.matchAll(/(?:section|Section)\s+(\d{1,2})/gi);
      for (const match of matches) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 11 && num > detected) {
          detected = num;
        }
      }
    }
    // Also check the currently typing text
    if (typingMessageId !== null && displayedText) {
      const matches = displayedText.matchAll(/(?:section|Section)\s+(\d{1,2})/gi);
      for (const match of matches) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 11 && num > detected) {
          detected = num;
        }
      }
    }
    return detected;
  })();

  // Compute progress based on section
  const progress = isComplete ? 100 : Math.min(95, Math.round((currentSection / 11) * 100));

  // === LANDING VIEW ===
  if (view === 'landing') {
    return (
      <div className="min-h-screen animated-gradient flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo size={28} className="text-primary" />
            <span className="font-semibold text-sm tracking-tight">MemoryForge</span>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="relative mb-8">
              <div className="absolute -top-4 -left-8 w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
              <div className="absolute -top-8 right-12 w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-4 -right-4 w-2.5 h-2.5 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: '2s' }} />
              <Logo size={64} className="text-primary mx-auto" />
            </div>

            <h1
              className="text-xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-white to-primary/80 bg-clip-text text-transparent"
              style={{ fontSize: 'clamp(1.75rem, 1.2rem + 2.5vw, 2.75rem)', lineHeight: 1.1 }}
              data-testid="hero-heading"
            >
              Build your AI memory<br />in minutes
            </h1>

            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 leading-relaxed" style={{ fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 1rem)' }}>
              Have a quick conversation with MemoryForge and walk away with a personal context file
              you can paste into any AI — Claude, ChatGPT, Perplexity, or others.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={startChat}
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 glow-pulse"
                data-testid="start-conversation-btn"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with AI
              </button>
              <button
                onClick={() => navigate('/questionnaire')}
                className="inline-flex items-center justify-center gap-2 border border-border/60 text-foreground hover:bg-muted px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200"
                data-testid="start-questionnaire-btn"
              >
                <ClipboardList className="w-4 h-4" />
                Fill Out Form
              </button>
            </div>

            {/* Features */}
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
              <div className="text-center">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">AI-powered<br />conversation</p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">5 minute<br />setup</p>
              </div>
              <div className="text-center">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Works with<br />any AI</p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 text-center">
          <PerplexityAttribution />
        </footer>
      </div>
    );
  }

  // === CHAT VIEW ===
  if (view === 'chat') {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Chat header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <Logo size={24} className="text-primary" />
            <span className="font-semibold text-sm">MemoryForge</span>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{progress}%</span>
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>
        </header>

        {/* Section progress indicator */}
        <div className="px-4 py-1.5 border-b border-border/30 bg-background/60 backdrop-blur-sm shrink-0">
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full"
              data-testid="section-indicator"
            >
              <span className="text-primary">{isComplete ? '11' : currentSection}</span>
              <span className="text-muted-foreground/50">/</span>
              <span>11</span>
              <span className="text-muted-foreground/40 mx-0.5">·</span>
              <span>{isComplete ? 'Complete' : SECTION_NAMES[currentSection]}</span>
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6" data-testid="chat-messages">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => {
              const isCurrentlyTyping = typingMessageId === msg.id;
              const content = isCurrentlyTyping ? displayedText : msg.content;

              if (msg.role === 'assistant') {
                return (
                  <div key={msg.id} className="flex gap-3 message-enter">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-card border border-card-border rounded-xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                        <div className={isCurrentlyTyping ? 'typing-cursor' : ''}>
                          {content ? renderText(content) : (
                            <span className="inline-flex gap-1.5 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex justify-end message-enter">
                  <div className="max-w-[80%]">
                    <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Generate button or input */}
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
          <div className="max-w-2xl mx-auto">
            {isComplete ? (
              <div className="text-center py-2">
                <button
                  onClick={handleGenerateMemory}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed glow-pulse"
                  data-testid="generate-memory-btn"
                >
                  {isGenerating ? (
                    <>
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate my memory file
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                <div className="relative flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isTyping || isWaitingForAPI ? 'Waiting for response...' : 'Type your answer...'}
                    disabled={isTyping || isWaitingForAPI}
                    rows={1}
                    className="flex-1 bg-card border border-card-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50 placeholder:text-muted-foreground/50"
                    style={{ maxHeight: '120px', minHeight: '44px' }}
                    data-testid="chat-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isTyping || isWaitingForAPI}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground p-3 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    data-testid="send-btn"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/40 mt-2 text-center">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === PREVIEW VIEW ===
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={24} className="text-primary" />
          <span className="font-semibold text-sm">MemoryForge</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            data-testid="copy-btn"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={downloadFile}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            data-testid="download-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Download .md
          </button>
        </div>
      </header>

      {/* Success banner */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Your AI memory file is ready!</p>
            <p className="text-xs text-muted-foreground">
              Copy the text below and paste it into any AI system's memory or custom instructions.
            </p>
          </div>
        </div>
      </div>

      {/* File preview */}
      <main className="flex-1 overflow-y-auto px-4 py-6" data-testid="memory-preview">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {/* File tab */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-card-border">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">my-ai-memory.md</span>
            </div>

            {/* Content */}
            <div className="p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90" style={{ fontSize: '13px', lineHeight: '1.7' }}>
              {memoryFile.split('\n').map((line, i) => {
                if (line.startsWith('# ')) {
                  return (
                    <div key={i} className="text-primary font-bold mt-2 mb-1 text-sm">
                      {line}
                    </div>
                  );
                }
                if (line.startsWith('## ')) {
                  return (
                    <div key={i} className="text-primary/80 font-semibold mt-4 mb-1">
                      {line}
                    </div>
                  );
                }
                if (line.startsWith('Remember that')) {
                  return (
                    <div key={i} className="text-foreground/85">
                      {line}
                    </div>
                  );
                }
                if (line === '---') {
                  return <hr key={i} className="border-border/50 my-3" />;
                }
                return <div key={i}>{line || '\u00A0'}</div>;
              })}
            </div>
          </div>

          {/* How to use */}
          <div className="mt-6 p-4 rounded-xl bg-card border border-card-border">
            <h3 className="text-sm font-semibold mb-2">How to use this file</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-medium shrink-0">Claude:</span>
                <span>Go to Settings → Profile → paste into "What would you like Claude to know about you?"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-medium shrink-0">ChatGPT:</span>
                <span>Go to Settings → Personalization → Custom Instructions → paste into "What would you like ChatGPT to know about you?"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-medium shrink-0">Perplexity:</span>
                <span>Open any thread → click your profile → paste into the Memory section</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-medium shrink-0">Others:</span>
                <span>Paste into system prompt, custom instructions, or memory field</span>
              </li>
            </ul>
          </div>

          {/* Start over */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setView('landing');
                setMessages([]);
                setMemoryFile('');
                setIsComplete(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="start-over-btn"
            >
              Start over
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 text-center border-t border-border/50">
        <PerplexityAttribution />
      </footer>
    </div>
  );
}
