export interface TiramisParsedMessage {
  raw: Record<string, unknown>;
  rootName: string | null;
  content: Record<string, unknown> | null;
  signature: string | null;
}

export interface TiramisBuildMessageParams {
  rootName: string;
  payload: Record<string, unknown>;
  signature?: string | null;
}
