export interface TiramisHttpHeaders {
  [key: string]: string;
  'Content-Type': string;
  ClientCode: string;
  ClientKey: string;
}

export interface TiramisHttpRequest {
  url: string;
  xml: string;
  headers: TiramisHttpHeaders;
  timeout?: number;
}

export interface TiramisHttpResponse {
  statusCode: number;
  statusText: string;
  rawXml: string;
  headers: Record<string, any>;
}
