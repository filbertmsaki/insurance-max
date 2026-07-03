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

  parse(xml: string): Record<string, unknown> {
    try {
      return this.asRecord(this.parser.parse(xml));
    } catch {
      throw new BadRequestException('Invalid TIRAMIS XML payload');
    }
  }

  parseTiraMessage(xml: string): TiramisParsedMessage {
    const parsed = this.parse(xml);

    const tiraMsg = this.getRecordValue(parsed, 'TiraMsg');

    if (!tiraMsg) {
      throw new BadRequestException('Invalid TIRAMIS message: TiraMsg missing');
    }

    const rootName =
      Object.keys(tiraMsg).find(
        (key) =>
          key !== 'MsgSignature' && key !== 'Signature' && key !== 'signature',
      ) || null;

    return {
      raw: parsed,
      rootName,
      content: rootName ? this.getRecordValue(tiraMsg, rootName) : null,
      signature:
        this.getStringValue(tiraMsg, 'MsgSignature') ??
        this.getStringValue(tiraMsg, 'Signature') ??
        this.getStringValue(tiraMsg, 'signature'),
    };
  }

  getRequestId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      this.getStringValue(message.content, 'RequestId') ||
      this.getNestedStringValue(message.content, 'CoverNoteHdr', 'RequestId') ||
      this.getNestedStringValue(
        message.content,
        'MotorCoverNoteHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(message.content, 'PolicyHdr', 'RequestId') ||
      this.getNestedStringValue(
        message.content,
        'ReinsuranceHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'ClaimNotificationHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'ClaimIntimationHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'ClaimAssessmentHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'DischargeVoucherHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'ClaimPaymentHdr',
        'RequestId',
      ) ||
      this.getNestedStringValue(
        message.content,
        'ClaimRejectionHdr',
        'RequestId',
      ) ||
      null
    );
  }

  getResponseId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return this.getStringValue(message.content, 'ResponseId');
  }

  getAcknowledgementId(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return this.getStringValue(message.content, 'AcknowledgementId');
  }

  getStatusCode(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      this.getStringValue(message.content, 'ResponseStatusCode') ||
      this.getStringValue(message.content, 'AcknowledgementStatusCode') ||
      null
    );
  }

  getStatusDesc(xml: string): string | null {
    const message = this.parseTiraMessage(xml);

    if (!message.content) {
      return null;
    }

    return (
      this.getStringValue(message.content, 'ResponseStatusDesc') ||
      this.getStringValue(message.content, 'AcknowledgementStatusDesc') ||
      null
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException('Invalid TIRAMIS XML payload');
    }

    return value as Record<string, unknown>;
  }

  private getRecordValue(
    content: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | null {
    const value = content[key];

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private getStringValue(
    content: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getNestedStringValue(
    content: Record<string, unknown>,
    parentKey: string,
    childKey: string,
  ): string | null {
    const nestedContent = this.getRecordValue(content, parentKey);

    if (!nestedContent) {
      return null;
    }

    return this.getStringValue(nestedContent, childKey);
  }
}
