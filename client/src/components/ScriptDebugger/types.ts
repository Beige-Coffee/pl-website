export interface StackItem {
  value: string;
  color: "blue" | "green" | "gray" | "gold" | "purple" | "red";
}

export interface ExecutionStep {
  scriptLine: number; // which line of the script is being executed (0-indexed)
  opcode: string; // e.g., "OP_DUP", "OP_HASH160"
  action: string; // plain English explanation
  stackBefore: StackItem[];
  stackAfter: StackItem[];
  consumed: number; // how many witness items consumed at this step
  branchTaken?: "IF" | "ELSE" | "ENDIF";
  skipLines?: number[]; // script lines to dim (skipped branches)
}

export interface ScriptPath {
  name: string;
  description: string;
  witnessItems: { label: string; color: StackItem["color"] }[];
  scriptLines: string[];
  steps: ExecutionStep[];
}
