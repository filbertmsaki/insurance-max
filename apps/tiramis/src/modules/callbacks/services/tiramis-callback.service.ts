import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisCoverNoteEntity } from '../../cover-notes/entities/tiramis-cover-note.entity';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisRequestIdService } from '../../submissions/services/tiramis-request-id.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';
import {
  TIRAMIS_CALLBACK_ACK_ROOTS,
  TIRAMIS_CALLBACK_ACK_STATUS,
  TIRAMIS_CALLBACK_ROOTS,
} from '../constants/tiramis-callback.constants';
import {
  ParsedTiramisCallbackDto,
  TiramisCallbackAckResultDto,
} from '../dto/tiramis-callback.dto';

@Injectable()
export class TiramisCallbackService {
  private readonly logger = new Logger(TiramisCallbackService.name);

  constructor(
    @InjectRepository(TiramisCoverNoteEntity)
    private readonly coverNoteRepository: Repository<TiramisCoverNoteEntity>,
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly tiramisRequestIdService: TiramisRequestIdService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
  ) {}

  async handleCallback(params: {
    environment: string;
    rawXml: string;
  }): Promise<TiramisCallbackAckResultDto> {
    const parsedCallback = this.parseCallback(params.rawXml);

    try {
      const isSuccess = await this.tiramisConfigService.isSuccessResponse(
        parsedCallback.responseStatusCode,
      );

      await this.tiramisSubmissionService.markFinalResponseReceived({
        requestId: parsedCallback.requestId,
        responseId: parsedCallback.responseId,
        statusCode: parsedCallback.responseStatusCode,
        statusDesc: parsedCallback.responseStatusDesc,
        rawXml: parsedCallback.rawXml,
        responseSignature: parsedCallback.signature || undefined,
        isSuccess,
      });

      await this.updateBusinessRecords(parsedCallback);

      const acknowledgement = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback,
        isSuccess: true,
      });

      await this.tiramisSubmissionService.markResponseAcknowledgementSent({
        requestId: parsedCallback.requestId,
        acknowledgementId: acknowledgement.acknowledgementId,
        statusCode: acknowledgement.acknowledgementStatusCode,
        statusDesc: acknowledgement.acknowledgementStatusDesc,
        rawXml: acknowledgement.acknowledgementXml,
      });

      return acknowledgement;
    } catch (error) {
      this.logger.error(
        `Failed to process TIRAMIS callback for requestId ${parsedCallback.requestId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      const acknowledgement = await this.buildAcknowledgement({
        environment: params.environment,
        parsedCallback,
        isSuccess: false,
      });

      await this.tiramisSubmissionService.markResponseAcknowledgementSent({
        requestId: parsedCallback.requestId,
        acknowledgementId: acknowledgement.acknowledgementId,
        statusCode: acknowledgement.acknowledgementStatusCode,
        statusDesc: acknowledgement.acknowledgementStatusDesc,
        rawXml: acknowledgement.acknowledgementXml,
      });

      return acknowledgement;
    }
  }

  private parseCallback(rawXml: string): ParsedTiramisCallbackDto {
    const parsedMessage = this.xmlParser.parseTiraMessage(rawXml);

    if (!parsedMessage.rootName || !parsedMessage.content) {
      throw new BadRequestException(
        'Invalid TIRAMIS callback message: root payload missing',
      );
    }

    if (!TIRAMIS_CALLBACK_ACK_ROOTS[parsedMessage.rootName]) {
      throw new BadRequestException(
        `Unsupported TIRAMIS callback root: ${parsedMessage.rootName}`,
      );
    }

    const content = parsedMessage.content;
    const requestId = this.getStringValue(content, 'RequestId');
    const responseId = this.getStringValue(content, 'ResponseId');
    const responseStatusCode = this.getStringValue(
      content,
      'ResponseStatusCode',
    );
    const responseStatusDesc = this.getStringValue(
      content,
      'ResponseStatusDesc',
    );

    if (
      !requestId ||
      !responseId ||
      !responseStatusCode ||
      !responseStatusDesc
    ) {
      throw new BadRequestException(
        'Invalid TIRAMIS callback payload: RequestId, ResponseId, ResponseStatusCode, and ResponseStatusDesc are required',
      );
    }

    return {
      rootName: parsedMessage.rootName,
      requestId,
      responseId,
      responseStatusCode,
      responseStatusDesc,
      coverNoteReferenceNumber: this.getOptionalStringValue(
        content,
        'CoverNoteReferenceNumber',
      ),
      stickerNumber: this.getOptionalStringValue(content, 'StickerNumber'),
      rawXml,
      signature: parsedMessage.signature,
      content,
    };
  }

  private async updateBusinessRecords(
    parsedCallback: ParsedTiramisCallbackDto,
  ) {
    if (
      parsedCallback.rootName !== TIRAMIS_CALLBACK_ROOTS.COVER_NOTE_RESPONSE &&
      parsedCallback.rootName !==
        TIRAMIS_CALLBACK_ROOTS.MOTOR_COVER_NOTE_RESPONSE
    ) {
      return;
    }

    const coverNote = await this.coverNoteRepository.findOne({
      where: {
        requestId: parsedCallback.requestId,
      },
    });

    if (!coverNote) {
      return;
    }

    if (parsedCallback.coverNoteReferenceNumber) {
      coverNote.coverNoteReferenceNumber =
        parsedCallback.coverNoteReferenceNumber;
    }

    if (parsedCallback.stickerNumber) {
      coverNote.stickerNumber = parsedCallback.stickerNumber;
    }

    await this.coverNoteRepository.save(coverNote);
  }

  private async buildAcknowledgement(params: {
    environment: string;
    parsedCallback: ParsedTiramisCallbackDto;
    isSuccess: boolean;
  }): Promise<TiramisCallbackAckResultDto> {
    const acknowledgementId = this.tiramisRequestIdService.generate('ACK');
    const acknowledgementRoot =
      TIRAMIS_CALLBACK_ACK_ROOTS[params.parsedCallback.rootName];

    if (!acknowledgementRoot) {
      throw new BadRequestException(
        `TIRAMIS callback acknowledgement root not found for ${params.parsedCallback.rootName}`,
      );
    }

    const acknowledgementStatusCode = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_CODE
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_CODE;

    const acknowledgementStatusDesc = params.isSuccess
      ? TIRAMIS_CALLBACK_ACK_STATUS.SUCCESS_DESC
      : TIRAMIS_CALLBACK_ACK_STATUS.FAILED_DESC;

    const acknowledgementPayload = {
      AcknowledgementId: acknowledgementId,
      ResponseId: params.parsedCallback.responseId,
      AcknowledgementStatusCode: acknowledgementStatusCode,
      AcknowledgementStatusDesc: acknowledgementStatusDesc,
    };

    const contentXml = this.xmlBuilder.buildContentXml(
      acknowledgementRoot,
      acknowledgementPayload,
    );

    const pfxPaths = await this.tiramisConfigService.getPfxPaths(
      params.environment,
    );

    const signature = pfxPaths.clientPrivateCertificatePath
      ? this.signatureService.signXmlContent({
          contentXml,
          privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath,
          privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
        })
      : '';

    const acknowledgementXml = this.xmlBuilder.buildAcknowledgementMessage({
      rootName: acknowledgementRoot,
      acknowledgementId,
      responseId: params.parsedCallback.responseId,
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
      signature,
    });

    return {
      acknowledgementId,
      responseId: params.parsedCallback.responseId,
      acknowledgementStatusCode,
      acknowledgementStatusDesc,
      acknowledgementXml,
    };
  }

  private getStringValue(
    content: Record<string, any>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getOptionalStringValue(
    content: Record<string, any>,
    key: string,
  ): string | null {
    const value = content[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
