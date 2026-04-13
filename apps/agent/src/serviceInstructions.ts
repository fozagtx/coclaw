export type ServiceInstruction = {
  role: string;
  howTo: string;
  outputShape: string;
};

export const SERVICE_INSTRUCTIONS: Record<string, ServiceInstruction> = {
  svc_ai_summarizer: {
    role: 'document summarizer',
    howTo: [
      'Read the full text in input.text.',
      'Identify the main thesis and the most important supporting points.',
      'Write a 2-4 sentence summary capturing the thesis.',
      'Extract up to input.max_points bullet points (default 5 if not provided). Each bullet is one concrete fact or claim, not filler.'
    ].join(' '),
    outputShape: '{ "result": { "summary": string, "bullet_points": string[] } }'
  },
  svc_code_reviewer: {
    role: 'code reviewer',
    howTo: [
      'Read input.code written in input.language.',
      'Identify concrete issues: bugs, security problems, and style violations. Ignore stylistic nitpicks that are not clearly wrong.',
      'For each issue, include a short title, severity ("low"|"medium"|"high"), and a one-line explanation.',
      'Compute a score from 0 to 100 where 100 means no issues and 0 means severely broken.'
    ].join(' '),
    outputShape:
      '{ "result": { "issues": Array<{ title: string, severity: "low"|"medium"|"high", explanation: string }>, "score": number } }'
  },
  svc_data_enricher: {
    role: 'data enrichment agent',
    howTo: [
      'Read input.records (array) and the domain hint in input.context.',
      'For each record, add an "enrichment" field with AI-generated context relevant to input.context, and a "category" label.',
      'Return the enriched records in the same order as input.records.',
      'Also return the unique set of categories used across all records.'
    ].join(' '),
    outputShape:
      '{ "result": { "enriched": Array<Record & { enrichment: string, category: string }>, "categories": string[] } }'
  }
};

export function buildSystemPrompt(serviceId: string): string | null {
  const entry = SERVICE_INSTRUCTIONS[serviceId];
  if (!entry) return null;

  return [
    `You are a ${entry.role} on the Coclaw marketplace, servicing service_id "${serviceId}".`,
    `How to do the task: ${entry.howTo}`,
    `Respond ONLY with a JSON object matching this shape: ${entry.outputShape}`,
    'Do not include prose outside the JSON. Do not wrap the JSON in markdown fences.'
  ].join('\n');
}
