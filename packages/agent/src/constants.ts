/**
 * Named, UNVALIDATED settings for the chat agent. The daily token budgets live in the admin AI settings
 * (chatTokenBudget, chatTokensPerUserPerDay), not here.
 */
export const AGENT_LIMITS = {
  /** Tool calls the agent may make to answer one message. Then it must answer or give up. */
  maxToolCalls: 5,
  /** A reply that is not valid JSON in the expected shape is retried this many times, then the turn ends. */
  maxBadOutputs: 2,
  /** A tool result longer than this (as JSON) is not shown to the model at all. Tools also cap their own lists. */
  maxToolResultChars: 6000,
  maxUserMessageChars: 2000,
  maxAssistantChars: 2000,
  /** Earlier messages sent back to the model as context. Text only, never tool results. */
  historyMessages: 12,
  /** A single conversation stops accepting messages at this size. */
  maxMessagesPerConversation: 200,
  maxUserMessagesPerDay: 200,
} as const;

export const FALLBACK = {
  badOutput: 'Sorry, I could not put together an answer to that. Please try rephrasing.',
  maxSteps: 'I could not finish looking that up within my limits. Please ask something narrower.',
  llmError: 'The assistant is unavailable right now. Please try again in a moment.',
  empty: 'I do not have anything to add.',
} as const;
