export interface TiramisHttpHeaders {
  [key: string]: string;
  'Content-Type': string;
  ClientCode: string;
  ClientKey: string;
}

export interface TiramisHttpRequest {
  requestId: string;
  url: string;
  xml: string;
  headers: TiramisHttpHeaders;
  timeout?: number;
  // Set false to keep this exchange out of the per-request TIRA log files.
  logRequest?: boolean;
}

export interface TiramisHttpResponse {
  statusCode: number;
  statusText: string;
  rawXml: string;
  headers: Record<string, any>;
}
