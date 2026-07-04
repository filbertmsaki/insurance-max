import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

import { getTiramisCallbackRootDefinition } from '../../callbacks/constants/tiramis-callback-root-map.constant';
import { TiramisFinalResponseDto } from '../../callbacks/dto/tiramis-final-response.dto';
import { TiramisParsedMessage } from '../interfaces/tiramis-xml.interface';

@Injectable()
export class TiramisXmlParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  private readonly genericXmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
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

  safeParseTiraMessage(xml: string): {
    ok: boolean;
    message?: TiramisParsedMessage;
    error?: string;
  } {
    if (!xml || !xml.trim()) {
      return {
        ok: false,
        error: 'Empty response received from TIRAMIS',
      };
    }

    const trimmedXml = xml.trim();

    if (!trimmedXml.startsWith('<')) {
      return {
        ok: false,
        error: 'Response received from TIRAMIS is not XML',
      };
    }

    try {
      const message = this.parseTiraMessage(trimmedXml);

      if (!message.rootName) {
        return {
          ok: false,
          error: 'Invalid TIRAMIS XML: response root element missing',
        };
      }

      if (!message.content) {
        return {
          ok: false,
          error: 'Invalid TIRAMIS XML: response content missing',
        };
      }

      return {
        ok: true,
        message,
      };
    } catch (error: any) {
      return {
        ok: false,
        error:
          error?.message ||
          'Invalid TIRAMIS XML response received from TIRAMIS',
      };
    }
  }

  extractAcknowledgement(xml: string): {
    ok: boolean;
    acknowledgementId?: string;
    requestId?: string;
    statusCode?: string;
    statusDesc?: string;
    rawRootName?: string | null;
    error?: string;
  } {
    const parsed = this.safeParseTiraMessage(xml);

    if (!parsed.ok || !parsed.message?.content) {
      return {
        ok: false,
        error: parsed.error || 'Unable to parse TIRAMIS acknowledgement',
      };
    }

    const content = parsed.message.content;

    const acknowledgementId = this.getStringValue(
      content,
      'AcknowledgementId',
    );

    const requestId = this.getStringValue(content, 'RequestId');

    const statusCode =
      this.getStringValue(content, 'AcknowledgementStatusCode') ||
      this.getStringValue(content, 'ResponseStatusCode');

    const statusDesc =
      this.getStringValue(content, 'AcknowledgementStatusDesc') ||
      this.getStringValue(content, 'ResponseStatusDesc') ||
      undefined;

    if (!statusCode) {
      return {
        ok: false,
        rawRootName: parsed.message.rootName,
        error: `Invalid TIRAMIS acknowledgement: status code missing in ${parsed.message.rootName}`,
      };
    }

    return {
      ok: true,
      acknowledgementId: acknowledgementId || undefined,
      requestId: requestId || undefined,
      statusCode,
      statusDesc,
      rawRootName: parsed.message.rootName,
    };
  }

  extractFinalResponse(xml: string): TiramisFinalResponseDto {
    const parsed = this.genericXmlParser.parse(xml);
    const tiraMsg = parsed?.TiraMsg;

    if (!tiraMsg || typeof tiraMsg !== 'object') {
      throw new BadRequestException('Invalid TiraMsg callback payload');
    }

    const rootElement = Object.keys(tiraMsg).find(
      (key) => key !== 'MsgSignature',
    );

    if (!rootElement) {
      throw new BadRequestException('Callback response root element not found');
    }

    const definition = getTiramisCallbackRootDefinition(rootElement);

    if (!definition) {
      throw new BadRequestException(
        `Unsupported TIRAMIS callback root: ${rootElement}`,
      );
    }

    const payload = this.getRecordValue(tiraMsg, rootElement) || {};

    return {
      rootElement,
      responseAckRoot: definition.responseAckRoot,
      serviceType: definition.serviceType,
      requestId: this.getXmlValue(payload.RequestId),
      responseId: this.getXmlValue(payload.ResponseId),
      responseStatusCode: this.getXmlValue(payload.ResponseStatusCode),
      responseStatusDesc: this.getXmlValue(payload.ResponseStatusDesc),
      claimReferenceNumber: this.getOptionalXmlValue(
        payload.ClaimReferenceNumber,
      ),
      coverNoteReferenceNumber: this.getOptionalXmlValue(
        payload.CoverNoteReferenceNumber,
      ),
      stickerNumber: this.getOptionalXmlValue(payload.StickerNumber),
      payload,
      rawXml: xml,
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

  private getXmlValue(value: unknown): string {
    const result = this.getOptionalXmlValue(value);

    if (!result) {
      return '';
    }

    return result;
  }

  private getOptionalXmlValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (typeof value === 'object' && '#text' in (value as any)) {
      return String((value as any)['#text']).trim();
    }

    return String(value).trim();
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
