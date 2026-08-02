import { Injectable } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';

import { TiramisBuildMessageParams } from '../interfaces/tiramis-xml.interface';

@Injectable()
export class TiramisXmlBuilderService {
  private readonly builder = new XMLBuilder({
    ignoreAttributes: false,
    suppressEmptyNode: false,
    format: false,
    processEntities: true,
  });

  private readonly compactBuilder = new XMLBuilder({
    ignoreAttributes: false,
    suppressEmptyNode: false,
    format: false,
    processEntities: true,
  });

  buildContentXml(rootName: string, payload: Record<string, any>): string {
    return this.builder.build({
      [rootName]: payload,
    });
  }

  buildCompactContentXml(
    rootName: string,
    payload: Record<string, any>,
  ): string {
    return this.compactBuilder.build({
      [rootName]: payload,
    });
  }

  buildTiraMessage(params: TiramisBuildMessageParams): string {
    return this.builder.build({
      TiraMsg: {
        [params.rootName]: params.payload,
        MsgSignature: params.signature || '',
      },
    });
  }

  buildSignedTiraMessage(params: {
    rootName: string;
    payload: Record<string, any>;
    signature: string;
    includeXmlDeclaration?: boolean;
  }): string {
    const contentXml = this.buildCompactContentXml(
      params.rootName,
      params.payload,
    );

    return this.buildSignedTiraMessageFromContent({
      contentXml,
      signature: params.signature,
      includeXmlDeclaration: params.includeXmlDeclaration,
    });
  }

  buildSignedTiraMessageFromContent(params: {
    contentXml: string;
    signature: string;
    includeXmlDeclaration?: boolean;
  }): string {
    const declaration = params.includeXmlDeclaration
      ? '<?xml version="1.0" encoding="UTF-8"?>\n'
      : '';

    // PHP uses trim($content) before signing and sends that same content.
    const contentXml = String(params.contentXml || '').trim();
    const signature = String(params.signature || '').trim();

    return `${declaration}<TiraMsg>${contentXml}<MsgSignature>${signature}</MsgSignature></TiraMsg>`;
  }

  buildAcknowledgementMessage(params: {
    rootName: string;
    acknowledgementId: string;
    responseId?: string;
    requestId?: string;
    acknowledgementStatusCode: string;
    acknowledgementStatusDesc: string;
    signature?: string | null;
  }): string {
    const payload: Record<string, any> = {
      AcknowledgementId: params.acknowledgementId,
      AcknowledgementStatusCode: params.acknowledgementStatusCode,
      AcknowledgementStatusDesc: params.acknowledgementStatusDesc,
    };

    if (params.responseId) {
      payload.ResponseId = params.responseId;
    }

    if (params.requestId) {
      payload.RequestId = params.requestId;
    }

    return this.buildTiraMessage({
      rootName: params.rootName,
      payload,
      signature: params.signature || '',
    });
  }
}
