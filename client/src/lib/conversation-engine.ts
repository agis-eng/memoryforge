// MemoryForge Conversation Engine
// Adaptive chatbot that builds a personal AI memory profile

export interface UserProfile {
  name: string;
  role: string;
  company: string;
  industry: string;
  skills: string[];
  yearsExperience: string;
  knownFor: string;
  currentProjects: string[];
  shortTermGoals: string;
  longTermGoals: string;
  aiHelpGoals: string;
  communicationStyle: string;
  detailPreference: string;
  tonePreference: string;
  tools: string[];
  keyPeople: string[];
  location: string;
  timezone: string;
  personalFacts: string[];
  rawAnswers: Record<string, string>;
}

export interface ConversationState {
  phase: Phase;
  questionIndex: number;
  profile: UserProfile;
  messageCount: number;
  completedPhases: Phase[];
  // The phase+index of the last question we asked, so we know where to extract from
  lastAskedPhase: Phase;
  lastAskedIndex: number;
}

export type Phase =
  | 'greeting'
  | 'identity'
  | 'expertise'
  | 'projects'
  | 'goals'
  | 'working-style'
  | 'tools'
  | 'people'
  | 'personal'
  | 'wrap-up'
  | 'complete';

const PHASE_ORDER: Phase[] = [
  'greeting',
  'identity',
  'expertise',
  'projects',
  'goals',
  'working-style',
  'tools',
  'people',
  'personal',
  'wrap-up',
];

interface QuestionTemplate {
  question: string;
  followUp?: (answer: string, profile: UserProfile) => string | null;
  extract: (answer: string, profile: UserProfile) => void;
}

const QUESTIONS: Record<Phase, QuestionTemplate[]> = {
  greeting: [
    {
      question: "Hey there! I'm MemoryForge — think of me as your AI onboarding assistant. I'm going to help you build a personal memory file that any AI system can use to understand who you are, how you work, and what matters to you.\n\nIt takes about 5 minutes, and the result is a file you can paste into Claude, ChatGPT, Perplexity, or any other AI to give it instant context.\n\nLet's start simple — what's your name?",
      extract: (answer, profile) => {
        profile.name = extractName(answer);
        profile.rawAnswers['name'] = answer;
      },
    },
  ],
  identity: [
    {
      question: '',
      followUp: (_answer, profile) =>
        `Nice to meet you, ${profile.name}! What do you do for work? I'm looking for your role or title, and the company or industry you're in.`,
      extract: (answer, profile) => {
        profile.rawAnswers['role_company'] = answer;
        const parts = parseRoleAndCompany(answer);
        profile.role = parts.role;
        profile.company = parts.company;
        profile.industry = parts.industry;
      },
    },
    {
      question: '',
      followUp: (_answer, profile) => {
        if (profile.company && profile.industry) return null;
        if (profile.company && !profile.industry) {
          return `Got it — ${profile.role} at ${profile.company}. What industry would you say that falls under?`;
        }
        if (!profile.company && profile.role) {
          return `Interesting — ${profile.role}. Are you working for a specific company, or are you independent/freelance?`;
        }
        return null;
      },
      extract: (answer, profile) => {
        profile.rawAnswers['identity_followup'] = answer;
        if (!profile.industry) profile.industry = answer.trim();
        else if (!profile.company) profile.company = answer.trim();
      },
    },
  ],
  expertise: [
    {
      question: '',
      followUp: (_answer, profile) =>
        `What are your key skills and areas of expertise? And roughly how many years of experience do you have in ${profile.industry || 'your field'}?`,
      extract: (answer, profile) => {
        profile.rawAnswers['skills'] = answer;
        // Extract years first before splitting
        const yearsMatch = answer.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
        if (yearsMatch) profile.yearsExperience = yearsMatch[0];
        // Remove the years portion before extracting skills list
        const skillsPart = answer.replace(/\.?\s*(?:about\s+)?\d+\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?/gi, '').trim();
        profile.skills = extractList(skillsPart);
      },
    },
    {
      question: "What would you say you're known for professionally? What do people come to you for?",
      extract: (answer, profile) => {
        profile.rawAnswers['known_for'] = answer;
        profile.knownFor = answer.trim();
      },
    },
  ],
  projects: [
    {
      question: "What are you actively working on right now? Could be specific projects, initiatives, or areas of focus.",
      extract: (answer, profile) => {
        profile.rawAnswers['projects'] = answer;
        profile.currentProjects = extractList(answer);
      },
    },
    {
      question: '',
      followUp: (_answer, profile) => {
        if (profile.currentProjects.length > 0) {
          const project = profile.currentProjects[0].substring(0, 50);
          return `"${project}" sounds interesting — is there anything else you're juggling, or is that the main focus right now?`;
        }
        return null;
      },
      extract: (answer, profile) => {
        profile.rawAnswers['projects_followup'] = answer;
        const lower = answer.toLowerCase();
        if (!lower.includes('that\'s it') && !lower.includes('just that') && !lower.includes('main focus') && !lower.includes('only') && !lower.includes('nope') && !lower.includes('no ')) {
          const additional = extractList(answer);
          if (additional.length > 0) {
            profile.currentProjects.push(...additional);
          }
        }
      },
    },
  ],
  goals: [
    {
      question: "Let's talk about where you're headed. What are your main goals right now — both short-term (next few months) and longer-term?",
      extract: (answer, profile) => {
        profile.rawAnswers['goals'] = answer;
        const lower = answer.toLowerCase();
        if (lower.includes('short') && lower.includes('long')) {
          const parts = answer.split(/long[\s-]*term/i);
          profile.shortTermGoals = parts[0].replace(/short[\s-]*term[:\s]*/i, '').trim();
          profile.longTermGoals = (parts[1] || '').replace(/^[:\s]*/, '').trim();
        } else {
          profile.shortTermGoals = answer.trim();
        }
      },
    },
    {
      question: "What specifically would you want AI to help you with? Think about the tasks or areas where having an AI that really understands you would be most valuable.",
      extract: (answer, profile) => {
        profile.rawAnswers['ai_help'] = answer;
        profile.aiHelpGoals = answer.trim();
      },
    },
  ],
  'working-style': [
    {
      question: "Now let's get into how you like to work. When you interact with AI, do you prefer:\n\n• **Concise** responses (bullet points, straight to the point)\n• **Detailed** responses (thorough explanations, context)\n• **Somewhere in between**\n\nAnd what tone works best — casual, professional, technical?",
      extract: (answer, profile) => {
        profile.rawAnswers['style'] = answer;
        const lower = answer.toLowerCase();
        if (lower.includes('concise') || lower.includes('brief') || lower.includes('bullet')) {
          profile.detailPreference = 'concise';
        } else if (lower.includes('detail') || lower.includes('thorough') || lower.includes('comprehensive')) {
          profile.detailPreference = 'detailed';
        } else {
          profile.detailPreference = 'balanced';
        }
        if (lower.includes('casual') || lower.includes('informal') || lower.includes('relaxed')) {
          profile.tonePreference = 'casual';
        } else if (lower.includes('technical') || lower.includes('precise')) {
          profile.tonePreference = 'technical';
        } else if (lower.includes('professional') || lower.includes('formal')) {
          profile.tonePreference = 'professional';
        } else {
          profile.tonePreference = 'professional but approachable';
        }
      },
    },
    {
      question: "How would you describe your communication style? For instance, do you like to think out loud, prefer structured frameworks, or like to dive straight into solutions?",
      extract: (answer, profile) => {
        profile.rawAnswers['comm_style'] = answer;
        profile.communicationStyle = answer.trim();
      },
    },
  ],
  tools: [
    {
      question: "What software, tools, and platforms do you use daily? Think about everything — from your code editor to project management to communication tools.",
      extract: (answer, profile) => {
        profile.rawAnswers['tools'] = answer;
        profile.tools = extractList(answer);
      },
    },
  ],
  people: [
    {
      question: "Are there key people AI should know about — team members, clients, collaborators, or other important relationships in your work? Just names and roles are fine.",
      extract: (answer, profile) => {
        profile.rawAnswers['people'] = answer;
        const lower = answer.toLowerCase();
        if (lower.includes('none') || lower.includes('no one') || lower.includes('not really') || lower.includes('skip') || lower.includes('n/a')) {
          profile.keyPeople = [];
        } else {
          profile.keyPeople = extractPeople(answer);
        }
      },
    },
  ],
  personal: [
    {
      question: "Almost done! Where are you located and what timezone are you in? And is there anything else personal or contextual that would help AI understand you better — hobbies, values, communication quirks, anything?",
      extract: (answer, profile) => {
        profile.rawAnswers['personal'] = answer;
        const tzMatch = answer.match(/(EST|CST|MST|PST|ET|CT|MT|PT|UTC[+-]?\d*|GMT[+-]?\d*|Eastern|Central|Mountain|Pacific)/i);
        if (tzMatch) profile.timezone = tzMatch[0];
        
        const locPatterns = [
          /(?:in|from|based in|located in|live in|living in)\s+([A-Z][a-zA-Z\s,]+)/,
          /([A-Z][a-zA-Z]+(?:,\s*[A-Z]{2}))/,
        ];
        for (const pat of locPatterns) {
          const m = answer.match(pat);
          if (m) {
            profile.location = m[1].trim();
            break;
          }
        }
        
        // Store personal facts, filtering out location/tz that are already captured
        const facts = answer.trim();
        profile.personalFacts = [facts];
      },
    },
  ],
  'wrap-up': [
    {
      question: '',
      followUp: (_answer, profile) =>
        `Great — I've got a solid picture of who you are, ${profile.name}. I have everything I need to generate your AI memory file.\n\nHere's a quick summary of what I captured:\n\n• **Role:** ${profile.role}${profile.company ? ` at ${profile.company}` : ''}\n• **Skills:** ${profile.skills.slice(0, 3).join(', ')}${profile.skills.length > 3 ? '...' : ''}\n• **Projects:** ${profile.currentProjects.slice(0, 2).join(', ')}${profile.currentProjects.length > 2 ? '...' : ''}\n• **AI focus:** ${profile.aiHelpGoals ? profile.aiHelpGoals.substring(0, 80) + (profile.aiHelpGoals.length > 80 ? '...' : '') : 'General assistance'}\n• **Style:** ${profile.detailPreference}, ${profile.tonePreference}\n\nReady to generate your memory file? Just say **"Generate"** and I'll create it!`,
      extract: () => {},
    },
  ],
  complete: [],
};

// Helper functions
function extractName(answer: string): string {
  let name = answer
    .replace(/^(my name is|i'm|i am|it's|call me|hey,?\s*i'm)\s*/i, '')
    .replace(/[.!,].*$/, '')
    .trim();
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseRoleAndCompany(answer: string): { role: string; company: string; industry: string } {
  let role = '';
  let company = '';
  let industry = '';
  
  const atMatch = answer.match(/(?:i'm|i am|i work as)?\s*(?:a|an)?\s*(.+?)\s+(?:at|@|for)\s+(.+?)(?:\s+in\s+(?:the\s+)?(.+?))?[.!]?$/i);
  if (atMatch) {
    role = atMatch[1].trim();
    company = atMatch[2].trim().replace(/[.!,]$/, '');
    if (atMatch[3]) industry = atMatch[3].trim().replace(/[.!,]$/, '');
  } else {
    role = answer.replace(/^(i'm|i am|i work as)\s*(a|an)?\s*/i, '').trim().replace(/[.!]$/, '');
  }
  
  return { role, company, industry };
}

function extractList(answer: string): string[] {
  const items = answer
    .split(/[,\n•\-]|\band\b/gi)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 100);
  return items.length > 0 ? items : [answer.trim()];
}

function extractPeople(answer: string): string[] {
  const lines = answer.split(/[,\n•\-;]|(?:\band\b)/gi).map(s => s.trim()).filter(Boolean);
  return lines.filter(l => l.length > 1 && l.length < 100);
}

export function createInitialState(): ConversationState {
  return {
    phase: 'greeting',
    questionIndex: 0,
    messageCount: 0,
    completedPhases: [],
    lastAskedPhase: 'greeting',
    lastAskedIndex: 0,
    profile: {
      name: '',
      role: '',
      company: '',
      industry: '',
      skills: [],
      yearsExperience: '',
      knownFor: '',
      currentProjects: [],
      shortTermGoals: '',
      longTermGoals: '',
      aiHelpGoals: '',
      communicationStyle: '',
      detailPreference: '',
      tonePreference: '',
      tools: [],
      keyPeople: [],
      location: '',
      timezone: '',
      personalFacts: [],
      rawAnswers: {},
    },
  };
}

export function getNextBotMessage(state: ConversationState, userMessage?: string): { message: string; newState: ConversationState; isComplete: boolean } {
  const newState: ConversationState = {
    ...state,
    profile: { ...state.profile, rawAnswers: { ...state.profile.rawAnswers } },
  };
  
  // Extract info from user message using the LAST ASKED question (not current position)
  if (userMessage) {
    const extractPhase = state.lastAskedPhase;
    const extractIndex = state.lastAskedIndex;
    const questions = QUESTIONS[extractPhase];
    if (questions && questions[extractIndex]) {
      questions[extractIndex].extract(userMessage, newState.profile);
    }
    newState.messageCount++;
    
    // Check if user wants to generate (wrap-up phase)
    if (state.lastAskedPhase === 'wrap-up') {
      const lower = userMessage.toLowerCase();
      if (lower.includes('generate') || lower.includes('yes') || lower.includes('ready') || lower.includes('go') || lower.includes('let\'s do') || lower.includes('create') || lower.includes('sure')) {
        newState.phase = 'complete';
        return {
          message: "Generating your AI memory file now... ✨",
          newState,
          isComplete: true,
        };
      }
    }
  }
  
  // Now figure out which question to ask next
  return findNextQuestion(newState, userMessage);
}

function findNextQuestion(state: ConversationState, userMessage?: string): { message: string; newState: ConversationState; isComplete: boolean } {
  const newState = { ...state };
  const phase = newState.phase;
  const questions = QUESTIONS[phase];
  
  if (!questions || questions.length === 0) {
    return { message: '', newState, isComplete: true };
  }
  
  // Check if we've exhausted questions in this phase
  if (newState.questionIndex >= questions.length) {
    return advancePhase(newState, userMessage);
  }
  
  const currentQ = questions[newState.questionIndex];
  let message: string | null = null;
  
  // Try followUp first if there's a user message
  if (currentQ.followUp) {
    message = currentQ.followUp(userMessage || '', newState.profile);
    if (!message) {
      // followUp returned null = skip this question
      newState.questionIndex++;
      return findNextQuestion(newState, userMessage);
    }
  } else if (currentQ.question) {
    message = currentQ.question;
  }
  
  if (!message) {
    newState.questionIndex++;
    return findNextQuestion(newState, userMessage);
  }
  
  // Record what we asked so extraction works on the next user response
  newState.lastAskedPhase = phase;
  newState.lastAskedIndex = newState.questionIndex;
  
  // Advance index for next call
  newState.questionIndex++;
  
  return { message, newState, isComplete: false };
}

function advancePhase(state: ConversationState, userMessage?: string): { message: string; newState: ConversationState; isComplete: boolean } {
  const newState = { ...state };
  newState.completedPhases.push(state.phase);
  
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  if (currentIndex >= PHASE_ORDER.length - 1) {
    newState.phase = 'complete';
    return { message: '', newState, isComplete: true };
  }
  
  newState.phase = PHASE_ORDER[currentIndex + 1];
  newState.questionIndex = 0;
  
  return findNextQuestion(newState, userMessage);
}

export function getProgress(state: ConversationState): number {
  const phaseIndex = PHASE_ORDER.indexOf(state.phase);
  if (phaseIndex === -1) return 100;
  return Math.round((phaseIndex / (PHASE_ORDER.length - 1)) * 100);
}

export function generateMemoryFile(profile: UserProfile): string {
  const lines: string[] = [];
  
  lines.push('# My AI Memory File');
  lines.push(`# Generated by MemoryForge on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');
  
  // Quick summary
  lines.push('## Quick Summary');
  lines.push('');
  const summaryParts = [];
  if (profile.name) summaryParts.push(`${profile.name}`);
  if (profile.role) summaryParts.push(`a ${profile.role}`);
  if (profile.company) summaryParts.push(`at ${profile.company}`);
  if (profile.industry) summaryParts.push(`in the ${profile.industry} space`);
  
  let summary = summaryParts.join(', ');
  if (profile.knownFor) summary += `. Known for ${profile.knownFor}`;
  if (profile.skills.length > 0) summary += `. Core skills include ${profile.skills.slice(0, 4).join(', ')}`;
  if (profile.yearsExperience) {
    const yrs = profile.yearsExperience.replace(/^about\s+/i, '');
    summary += ` with ${yrs} of experience`;
  }
  if (profile.detailPreference) summary += `. Prefers ${profile.detailPreference} responses`;
  if (profile.tonePreference) summary += ` in a ${profile.tonePreference} tone`;
  summary += '.';
  
  lines.push(summary);
  lines.push('');
  
  // Identity
  lines.push('## Identity & Role');
  lines.push('');
  if (profile.name) lines.push(`Remember that my name is ${profile.name}.`);
  if (profile.role) lines.push(`Remember that I work as a ${profile.role}.`);
  if (profile.company) lines.push(`Remember that I work at ${profile.company}.`);
  if (profile.industry) lines.push(`Remember that I'm in the ${profile.industry} industry.`);
  lines.push('');
  
  // Expertise
  if (profile.skills.length > 0 || profile.knownFor || profile.yearsExperience) {
    lines.push('## Expertise & Skills');
    lines.push('');
    if (profile.skills.length > 0) lines.push(`Remember that my key skills are: ${profile.skills.join(', ')}.`);
    if (profile.yearsExperience) {
      const yrsStr = profile.yearsExperience.toLowerCase().includes('experience') 
        ? profile.yearsExperience 
        : `${profile.yearsExperience} of experience`;
      lines.push(`Remember that I have ${yrsStr}.`);
    }
    if (profile.knownFor) lines.push(`Remember that I'm known for ${profile.knownFor}.`);
    lines.push('');
  }
  
  // Current Work
  if (profile.currentProjects.length > 0) {
    lines.push('## Current Work');
    lines.push('');
    profile.currentProjects.forEach(p => {
      lines.push(`Remember that I'm currently working on ${p}.`);
    });
    lines.push('');
  }
  
  // Goals
  if (profile.shortTermGoals || profile.longTermGoals || profile.aiHelpGoals) {
    lines.push('## Goals');
    lines.push('');
    if (profile.shortTermGoals) lines.push(`Remember that my short-term goals include: ${profile.shortTermGoals}`);
    if (profile.longTermGoals) lines.push(`Remember that my long-term goals include: ${profile.longTermGoals}`);
    if (profile.aiHelpGoals) lines.push(`Remember that I want AI to help me with: ${profile.aiHelpGoals}`);
    lines.push('');
  }
  
  // Preferences
  if (profile.detailPreference || profile.tonePreference || profile.communicationStyle) {
    lines.push('## Communication Preferences');
    lines.push('');
    if (profile.detailPreference) lines.push(`Remember that I prefer ${profile.detailPreference} responses.`);
    if (profile.tonePreference) lines.push(`Remember that I prefer a ${profile.tonePreference} tone.`);
    if (profile.communicationStyle) lines.push(`Remember that my communication style is: ${profile.communicationStyle}`);
    lines.push('');
  }
  
  // Tools
  if (profile.tools.length > 0) {
    lines.push('## Tools & Stack');
    lines.push('');
    lines.push(`Remember that I use these tools daily: ${profile.tools.join(', ')}.`);
    lines.push('');
  }
  
  // People
  if (profile.keyPeople.length > 0) {
    lines.push('## Key People');
    lines.push('');
    profile.keyPeople.forEach(p => {
      lines.push(`Remember that ${p} is an important person in my work.`);
    });
    lines.push('');
  }
  
  // Personal
  if (profile.location || profile.timezone || profile.personalFacts.length > 0) {
    lines.push('## Personal Context');
    lines.push('');
    if (profile.location) lines.push(`Remember that I'm located in ${profile.location}.`);
    if (profile.timezone) lines.push(`Remember that my timezone is ${profile.timezone}.`);
    profile.personalFacts.forEach(f => {
      if (f) {
        // Remove already-captured location and tz references from the personal fact
        let cleaned = f;
        if (profile.location) {
          const locEscaped = profile.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp('(?:based|located|live|living)\\s+in\\s+' + locEscaped, 'gi'), '').trim();
        }
        if (profile.timezone) {
          cleaned = cleaned.replace(new RegExp(profile.timezone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
          cleaned = cleaned.replace(/,?\s*timezone\.?/gi, '').trim();
        }
        cleaned = cleaned.replace(/^[,\s.]+|[,\s]+$/g, '').trim();
        if (cleaned && cleaned.length > 3) {
          lines.push(`Remember: ${cleaned}`);
        }
      }
    });
    lines.push('');
  }
  
  lines.push('---');
  lines.push('# End of AI Memory File');
  lines.push('# Paste this into any AI system\'s memory/instructions to give it context about who you are.');
  
  return lines.join('\n');
}
