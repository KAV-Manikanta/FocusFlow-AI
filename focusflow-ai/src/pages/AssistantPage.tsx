import React, { useState } from 'react';
import { Bot, Send, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';

const QUICK_PROMPTS = [
  'Plan my day',
  'What should I work on next?',
  'Add a Python assignment due tomorrow',
  'I have only 3 hours available today',
  'Reschedule my unfinished tasks',
  'Explain why my top task is important',
  'Analyze my productivity this week',
];

export const AssistantPage: React.FC = () => {
  const {
    aiMessages,
    isAssistantThinking,
    sendAssistantMessage,
    confirmProposedAction,
    rejectProposedAction,
  } = useFocusFlow();

  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAssistantThinking) return;
    const text = input;
    setInput('');
    await sendAssistantMessage(text);
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-[#ECEDF5]">
        <h1 className="font-display text-2xl font-bold text-[#14142B]">AI Personal Assistant</h1>
        <p className="text-sm text-[#7A7D96] mt-0.5">
          Context-aware Gemini assistant connected to your task backlog and constraint scheduler. All structural changes require your confirmation.
        </p>
      </div>

      {/* Quick Prompt Commands */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendAssistantMessage(prompt)}
            disabled={isAssistantThinking}
            className="py-1.5 px-3 rounded-lg bg-white shadow-card border border-[#ECEDF5] hover:border-[#5B3FE0] text-xs text-[#5A5C78] hover:text-[#14142B] transition-colors whitespace-nowrap shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Viewport */}
      <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl flex flex-col h-[540px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {aiMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 text-xs text-[#7A7D96] mb-1 font-mono tabular-nums">
                {msg.role === 'assistant' && <Bot className="w-3.5 h-3.5 text-[#5B3FE0]" />}
                <span>{msg.role === 'user' ? 'You' : 'FocusFlow AI Assistant'}</span>
                <span>·</span>
                <span>{msg.createdAt.slice(11, 16)}</span>
              </div>

              <div
                className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#5B3FE0] text-white'
                    : 'bg-[#F4F5FB] border border-[#ECEDF5] text-[#3B3D58]'
                }`}
              >
                {msg.content}

                {/* Backend-Validated Action Proposal Confirmation Box */}
                {msg.proposedAction && (
                  <div className="mt-4 pt-3 border-t border-[#E2E4F0] space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5B3FE0]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Proposed Action ({msg.proposedAction.type})</span>
                    </div>
                    <p className="text-xs text-[#14142B] font-medium">{msg.proposedAction.summary}</p>

                    {msg.proposedAction.status === 'confirmed' ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#16A34A] font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmed &amp; Executed</span>
                      </div>
                    ) : msg.proposedAction.status === 'rejected' ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#7A7D96]">
                        <XCircle className="w-4 h-4" />
                        <span>Action Dismissed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => confirmProposedAction(msg.id, msg.proposedAction!)}
                          className="py-1.5 px-3.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                        >
                          Confirm &amp; Execute
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectProposedAction(msg.id)}
                          className="py-1.5 px-3 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-[#5A5C78] text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isAssistantThinking && (
            <div className="flex items-center gap-2 text-xs text-[#7A7D96] font-mono">
              <Bot className="w-4 h-4 text-[#5B3FE0] animate-spin" />
              <span>FocusFlow AI is analyzing your tasks &amp; schedule...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[#ECEDF5] flex items-center gap-3">
          <input
            type="text"
            aria-label="Message FocusFlow AI Assistant"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask e.g. 'Add a Python assignment due tomorrow' or 'I have only 3 hours available today'..."
            className="flex-1 px-4 py-2.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] placeholder-[#9A9CB3] focus:outline-none focus:border-[#5B3FE0]"
          />
          <button
            type="submit"
            disabled={isAssistantThinking || !input.trim()}
            className="py-2.5 px-5 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
