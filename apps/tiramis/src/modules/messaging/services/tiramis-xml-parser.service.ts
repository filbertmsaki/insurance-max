import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

import { TiramisParsedMessage } from '../interfaces/tiramis-xml.interface';

@Injectable()
export class TiramisXmlParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): Record<string, any> {
    try {
      return this.parser.parse(xml);
    } catch {
      throw new BadRequestException('Invalid TIRAMIS XML payload');
    }
  }

  parseTiraMessage(xml: string): TiramisParsedMessage {
    const parsed = this.parse(xml);

    if (!parsed?.TiraMsg) {
      throw new BadRequestException('Invalid TIRAMIS message: TiraMsg missing');
    }

    const tiraMsg = parsed.TiraMsg;
    const signature =
      tiraMsg.MsgSignature || tiraMsg.Signature || tiraMsg.signature || null;

    const rootName =
      Object.keys(tiraMsg).find(
        (key) =>
          key !== 'MsgSignature' && key !== 'Signature' && key !== 'signature',
      ) || null;

    return {
      raw: parsed,
      rootName,
      content: rootName ? tiraMsg[rootName] : null,
      signature,
    };
  }

  getRequestId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      message.content.RequestId ||
      message.content.CoverNoteHdr?.RequestId ||
      message.content.MotorCoverNoteHdr?.RequestId ||
      message.content.PolicyHdr?.RequestId ||
      message.content.ReinsuranceHdr?.RequestId ||
      message.content.ClaimNotificationHdr?.RequestId ||
      message.content.ClaimIntimationHdr?.RequestId ||
      message.content.ClaimAssessmentHdr?.RequestId ||
      message.content.DischargeVoucherHdr?.RequestId ||
      message.content.ClaimPaymentHdr?.RequestId ||
      message.content.ClaimRejectionHdr?.RequestId ||
      null
    );
  }

  getResponseId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return message.content.ResponseId || null;
  }

  getAcknowledgementId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return message.content.AcknowledgementId || null;
  }

  getStatusCode(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      message.content.ResponseStatusCode ||
      message.content.AcknowledgementStatusCode ||
      null
    );
  }

  getStatusDesc(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      message.content.ResponseStatusDesc ||
      message.content.AcknowledgementStatusDesc ||
      null
    );
  }
}
