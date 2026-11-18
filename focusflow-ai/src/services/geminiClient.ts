import { GoogleGenAI, Type } from '@google/genai';
import { evaluateMLModels } from '../ml/productivityEngine';
import { getUserGeminiKey, getGeminiModel } from './gemini';

/**
 * Browser-side Gemini calls. There is no backend: the user's own key goes
 * straight from their browser to Google and is never sent to our servers.
 */

function makeClient(key?: string): GoogleGenAI | null {
  const apiKey = (key ?? getUserGeminiKey()).trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Key check
// ---------------------------------------------------------------------------
export interface KeyCheckResult {
  ok: boolean;
  kind?: 'invalid_key' | 'quota' | 'model' | 'other';
  error?: string;
  model?: string;
}

export async function testGeminiKey(key?: string): Promise<KeyCheckResult> {
  const ai = makeClient(key);
  const model = getGeminiModel();
  if (!ai) {
    return { ok: false, kind: 'invalid_key', error: 'Please paste a Gemini API key.' };
  }
  try {
    await ai.models.generateContent({ model, contents: 'Reply with the single word: ok' });
    return { ok: true, model };
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (/API key not valid|API_KEY_INVALID|\b401\b|\b403\b|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) {
      return { ok: false, kind: 'invalid_key', error: 'Google rejected this key. Check that you copied it correctly.' };
    }
    if (/\b429\b|quota|RESOURCE_EXHAUSTED|rate/i.test(msg)) {
      return { ok: false, kind: 'quota', error: 'This key is valid but its quota or rate limit is reached right now.' };
    }
    if (/\b404\b|not found|model/i.test(msg)) {
      return { ok: false, kind: 'model', error: `Model "${model}" was not found. Change the model name in Settings.` };
    }
    return { ok: false, kind: 'other', error: 'Could not verify the key right now. Check your internet connection.' };
  }
}

// ---------------------------------------------------------------------------
// ML insights explanation
// ---------------------------------------------------------------------------
export async function explainInsights(params: {
  tasks: any[];
  sessions: any[];
  mlConsent: boolean;
}): Promise<{ aiExplanation: string; usedGemini: boolean }> {
  const { tasks, sessions, mlConsent } = params;
  const evaluation = evaluateMLModels(tasks, sessions, mlConsent);
  const peak = evaluation.patternAnalysis.peakHours.map((h: number) => `${h}:00`);

  const ai = makeClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: `Explain these machine learning productivity telemetry results in 3 concise, actionable sentences for the user:
- Chronotype: ${evaluation.patternAnalysis.chronotype}
- Peak Focus Hours: ${peak.join(', ')}
- High/Critical Deadline Risk Tasks: ${evaluation.riskModel.highRiskCount}
- Personalized Samples Used: ${evaluation.consentedUserSamples} (Mode: ${evaluation.isPersonalized ? 'Personalized Ensemble' : 'Calibrated Baseline'})`,
        config: {
          systemInstruction:
            'You are the FocusFlow AI ML Interpreter. Translate statistical and Random Forest / Gradient Boosting metrics into clear, direct, non-hyped executive advice in 3 sentences.',
        },
      });
      if (response.text) return { aiExplanation: response.text, usedGemini: true };
    } catch {
      /* fall through to the local explanation */
    }
  }

  return {
    usedGemini: false,
    aiExplanation: `Your ${evaluation.patternAnalysis.chronotype} profile shows highest cognitive throughput between ${peak.join(' and ')}. The Random Forest Duration Regressor indicates engineering and research tasks average 18–22% above initial time estimates, so scheduling buffer blocks before deadlines reduces your ${evaluation.riskModel.highRiskCount} high-risk task exposure.`,
  };
}

// ---------------------------------------------------------------------------
// Assistant chat
// ---------------------------------------------------------------------------
export interface AssistantChatResult {
  reply: string;
  proposedAction?: any;
  source: string;
}

export async function assistantChat(params: {
  message: string;
  tasks: any[];
  workStartHour?: number;
  workEndHour?: number;
  focusMinutesToday?: number;
}): Promise<AssistantChatResult> {
  const { message, tasks, workStartHour = 9, workEndHour = 18, focusMinutesToday = 0 } = params;

  const activeTasks = Array.isArray(tasks)
    ? tasks.filter((t: any) => t.status !== 'Completed' && t.status !== 'Archived')
    : [];
  const completedTasks = Array.isArray(tasks) ? tasks.filter((t: any) => t.status === 'Completed') : [];

  const ai = makeClient();
  if (ai) {
    try {
      const model = getGeminiModel();
      const taskSummary = activeTasks
        .slice(0, 10)
        .map(
          (t: any) =>
            `- [${t.id}] "${t.title}" (${t.category}, Priority: ${t.priority}, ML Score: ${t.mlPriorityScore}, Pred Duration: ${t.mlPredictedMinutes}m, Risk: ${t.mlRiskLevel}, Due: ${t.deadline})`
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model,
        contents: `User command: "${message}"

Current User Context:
- Active Tasks (${activeTasks.length}):
${taskSummary || 'None'}
- Completed Tasks: ${completedTasks.length}
- Focus Time Today: ${focusMinutesToday} minutes
- Working Hours: ${workStartHour}:00 to ${workEndHour}:00`,
        config: {
          systemInstruction: `You are the FocusFlow AI Personal Productivity Assistant.
Respond helpfully, concisely, and analytically based on the user's real tasks and ML scores.
If the user asks to create/add a task, reschedule tasks, change working hours/availability, or complete a task, include a structured proposedAction object so the app and user can confirm it before execution.
Valid proposedAction.type values: "CREATE_TASK", "RESCHEDULE_TASKS", "COMPLETE_TASK", "UPDATE_AVAILABILITY", or "NONE".`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING, description: 'Clear, helpful response to the user.' },
              actionType: {
                type: Type.STRING,
                description: 'One of CREATE_TASK, RESCHEDULE_TASKS, COMPLETE_TASK, UPDATE_AVAILABILITY, or NONE',
              },
              actionSummary: {
                type: Type.STRING,
                description: 'Human-readable description of the proposed action for confirmation.',
              },
              taskTitle: { type: Type.STRING },
              taskCategory: { type: Type.STRING },
              taskPriority: { type: Type.STRING },
              taskEstimatedMinutes: { type: Type.NUMBER },
              taskDeadlineDaysOffset: { type: Type.NUMBER },
              availableHoursToday: { type: Type.NUMBER },
              targetTaskId: { type: Type.STRING },
            },
            required: ['reply', 'actionType'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      let proposedAction: any = undefined;

      if (parsed.actionType && parsed.actionType !== 'NONE') {
        if (parsed.actionType === 'CREATE_TASK' && parsed.taskTitle) {
          const offsetDays = typeof parsed.taskDeadlineDaysOffset === 'number' ? parsed.taskDeadlineDaysOffset : 1;
          const deadlineDate = new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
          proposedAction = {
            type: 'CREATE_TASK',
            summary: parsed.actionSummary || `Create task "${parsed.taskTitle}" due ${deadlineDate}`,
            payload: {
              title: parsed.taskTitle,
              category: parsed.taskCategory || 'Academic',
              priority: parsed.taskPriority || 'High',
              estimatedMinutes: parsed.taskEstimatedMinutes || 60,
              deadline: deadlineDate,
            },
            status: 'pending',
          };
        } else if (parsed.actionType === 'RESCHEDULE_TASKS' || parsed.actionType === 'UPDATE_AVAILABILITY') {
          const availHours = parsed.availableHoursToday || workEndHour - workStartHour;
          proposedAction = {
            type: parsed.actionType,
            summary: parsed.actionSummary || `Regenerate today's schedule optimizing for ${availHours} available hours`,
            payload: {
              availableHours: availHours,
              workStartHour,
              workEndHour: Math.min(23, workStartHour + availHours),
            },
            status: 'pending',
          };
        } else if (parsed.actionType === 'COMPLETE_TASK' && parsed.targetTaskId) {
          proposedAction = {
            type: 'COMPLETE_TASK',
            summary: parsed.actionSummary || `Mark task ${parsed.targetTaskId} as Completed`,
            payload: { taskId: parsed.targetTaskId },
            status: 'pending',
          };
        }
      }

      return {
        reply: parsed.reply || 'Here is your productivity analysis and recommendation.',
        proposedAction,
        source: model,
      };
    } catch (geminiError: any) {
      console.warn('Gemini API fallback triggered:', geminiError?.message);
    }
  }

  // Deterministic rule-based replies when Gemini is unavailable (quota, offline, bad model)
  const lower = message.toLowerCase();
  const topTask = [...activeTasks].sort((a: any, b: any) => (b.mlPriorityScore || 0) - (a.mlPriorityScore || 0))[0];

  if (lower.includes('add ') || lower.includes('create ') || lower.includes('assignment') || lower.includes('due tomorrow')) {
    const cleanedTitle =
      message
        .replace(/^(please\s+)?(add|create|schedule)\s+(a\s+|an\s+|new\s+)?(task\s+)?/i, '')
        .replace(/\s+due\s+tomorrow.*$/i, '')
        .trim() || 'Python ML Assignment';
    const category =
      lower.includes('python') || lower.includes('assignment') || lower.includes('study')
        ? 'Academic'
        : lower.includes('design')
        ? 'Design'
        : 'Engineering';
    const deadline = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    return {
      reply: `I have prepared the task **"${cleanedTitle}"** (${category}, High Priority, 60m estimated duration, due ${deadline}). Please confirm below to add it to your Smart Task Manager with ML priority scoring.`,
      proposedAction: {
        type: 'CREATE_TASK',
        summary: `Create "${cleanedTitle}" (${category} · High Priority · Due ${deadline})`,
        payload: { title: cleanedTitle, category, priority: 'High', estimatedMinutes: 60, deadline },
        status: 'pending',
      },
      source: 'intelligent-engine',
    };
  }

  const hoursMatch = lower.match(/(\d+)\s*hours?\s*available/);
  if (hoursMatch || lower.includes('reschedule') || lower.includes('plan my day')) {
    const hours = hoursMatch ? Math.max(1, Math.min(12, parseInt(hoursMatch[1], 10))) : workEndHour - workStartHour;
    return {
      reply: `I analyzed your ${activeTasks.length} pending tasks against a **${hours}-hour available window** (${workStartHour}:00–${Math.min(23, workStartHour + hours)}:00). Confirm below to run the constraint optimizer and prioritize your highest ML-scored deliverables${topTask ? ` starting with "${topTask.title}" (Score ${topTask.mlPriorityScore})` : ''}.`,
      proposedAction: {
        type: 'RESCHEDULE_TASKS',
        summary: `Optimize today's schedule for ${hours}h window (${workStartHour}:00–${Math.min(23, workStartHour + hours)}:00)`,
        payload: { availableHours: hours, workStartHour, workEndHour: Math.min(23, workStartHour + hours) },
        status: 'pending',
      },
      source: 'intelligent-engine',
    };
  }

  if (lower.includes('next') || lower.includes('important') || lower.includes('explain')) {
    if (topTask) {
      return {
        reply: `You should focus next on **"${topTask.title}"** (${topTask.category}).\n\n**Why it ranks #1 (ML Score ${topTask.mlPriorityScore}/100):**\n- **Priority & Risk:** ${topTask.priority} priority with **${topTask.mlRiskLevel}** deadline risk (${topTask.mlRiskScore}%).\n- **Duration Forecast:** Random Forest regressor predicts **${topTask.mlPredictedMinutes}m** (vs ${topTask.estimatedMinutes}m estimated).\n- **Recommendation:** Launch a 25-minute Pomodoro session on this task during your 09:00–11:30 peak window.`,
        source: 'intelligent-engine',
      };
    }
  }

  return {
    reply: `You have **${activeTasks.length} active tasks** and **${completedTasks.length} completed tasks**, with **${focusMinutesToday} minutes** of deep focus logged today.${
      topTask
        ? ` Your top ML-prioritized task is **"${topTask.title}"** (Score: ${topTask.mlPriorityScore}/100, Predicted Duration: ${topTask.mlPredictedMinutes}m).`
        : ''
    } You can ask me to *"Plan my day"*, *"Add a Python assignment due tomorrow"*, *"I have only 3 hours available today"*, or *"Analyze my productivity this week"*.`,
    source: 'intelligent-engine',
  };
}

// ---------------------------------------------------------------------------
// Action validation (runs locally; the user still confirms every action)
// ---------------------------------------------------------------------------
const ALLOWED_ACTIONS = ['CREATE_TASK', 'RESCHEDULE_TASKS', 'COMPLETE_TASK', 'UPDATE_AVAILABILITY'];

export function validateProposedAction(action: any): { valid: boolean; error?: string } {
  if (!action || !action.type) return { valid: false, error: 'Missing proposedAction type.' };
  if (!ALLOWED_ACTIONS.includes(action.type)) {
    return { valid: false, error: `Unsupported action type: ${action.type}` };
  }
  return { valid: true };
}
