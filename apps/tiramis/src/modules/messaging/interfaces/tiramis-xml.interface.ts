export interface TiramisParsedMessage {
  raw: Record<string, any>;
  rootName: string | null;
  content: Record<string, any> | null;
  signature: string | null;
}

export interface TiramisBuildMessageParams {
  rootName: string;
  payload: Record<string, any>;
  signature?: string | null;
}
