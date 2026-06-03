import { Injectable } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';

import { TiramisBuildMessageParams } from '../interfaces/tiramis-xml.interface';

@Injectable()
export class TiramisXmlBuilderService {
  private readonly builder = new XMLBuilder({
    ignoreAttributes: false,
    suppressEmptyNode: false,
    format: true,
    processEntities: true,
  });

  buildContentXml(rootName: string, payload: Record<string, any>): string {
    return this.builder.build({
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
  }): string {
    return this.buildTiraMessage({
      rootName: params.rootName,
      payload: params.payload,
      signature: params.signature,
    });
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
