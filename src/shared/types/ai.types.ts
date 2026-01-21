export const AI_OPERATIONS = ['classify', 'extract', 'identify_delay'] as const;

export type AIOperationType = typeof AI_OPERATIONS[number];

export function isValidAIOperation(operation: string): operation is AIOperationType {
    return AI_OPERATIONS.includes(operation as AIOperationType);
}

