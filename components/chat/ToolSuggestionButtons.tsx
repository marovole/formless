import React from 'react';
import { Button } from '@/components/ui/button';

export type ToolSuggestion = {
  tool: string;
  label: string;
  params: any;
};

export function ToolSuggestionButtons(props: {
  suggestions: ToolSuggestion[];
  onChoose: (s: ToolSuggestion) => void;
}) {
  if (!props.suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {props.suggestions.map((s) => (
        <Button
          key={`${s.tool}-${s.label}`}
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => props.onChoose(s)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
