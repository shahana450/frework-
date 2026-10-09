// Everything that should make a person pause before posting a FreBook draft, gathered into ONE list (B14) —
// shown together in an in-app dialog, never as stacked browser pop-ups.
export function postWarnings(input: {
  compliance?: string[];
  questions?: { text: string }[];
  duplicate?: { entry_no: string; date: string } | null;
}): string[] {
  return [
    ...(input.compliance ?? []),
    ...(input.questions ?? []).map(q => `Unanswered: ${q.text}`),
    ...(input.duplicate ? [`Possible duplicate of ${input.duplicate.entry_no} (${input.duplicate.date})`] : []),
  ];
}
