import { Injectable } from '@nestjs/common';

import { TiramisConfigService } from '../../config/services/tiramis-config.service';
import { TiramisHttpClientService } from '../../messaging/services/tiramis-http-client.service';
import { TiramisSignatureService } from '../../messaging/services/tiramis-signature.service';
import { TiramisXmlBuilderService } from '../../messaging/services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from '../../messaging/services/tiramis-xml-parser.service';
import { TiramisSubmissionService } from '../../submissions/services/tiramis-submission.service';

@Injectable()
export class TiramisBusinessSubmissionService {
  constructor(
    private readonly tiramisConfigService: TiramisConfigService,
    private readonly tiramisSubmissionService: TiramisSubmissionService,
    private readonly xmlBuilder: TiramisXmlBuilderService,
    private readonly xmlParser: TiramisXmlParserService,
    private readonly signatureService: TiramisSignatureService,
    private readonly httpClient: TiramisHttpClientService,
  ) {}

  async submitSignedXml(params: {
    configuration: any;
    transactionId: string;
    requestId: string;
    rootElement: string;
    serviceType: string;
    payload: Record<string, any>;
    errorLabel?: string;
  }) {
    const contentXml = this.xmlBuilder.buildContentXml(
      params.rootElement,
      params.payload,
    );

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        params.configuration,
      );

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });

    const requestXml = this.xmlBuilder.buildSignedTiraMessage({
      rootName: params.rootElement,
      payload: params.payload,
      signature,
    });

    const attempt = await this.tiramisSubmissionService.createAttempt({
      transactionId: params.transactionId,
      requestId: params.requestId,
      rootElement: params.rootElement,
      requestXml,
      requestSignature: signature,
    });

    const endpoint =
      await this.tiramisConfigService.getFullEndpointUrlForConfiguration({
        configuration: params.configuration,
        serviceType: params.serviceType,
      });

    const headers =
      await this.tiramisConfigService.getRequestHeadersForConfiguration(
        params.configuration,
      );

    await this.tiramisSubmissionService.markSent(params.requestId);

    try {
      const response = await this.httpClient.postXml({
        url: endpoint,
        xml: requestXml,
        headers,
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const failedAttempt = await this.tiramisSubmissionService.markFailed({
          requestId: params.requestId,
          errorMessage: `TIRAMIS HTTP error: ${response.statusCode}`,
          rawPayload: response.rawXml,
          isRetryable: true,
        });

        return {
          attempt: failedAttempt,
          tiraResponse: response,
        };
      }

      const acknowledgement = this.xmlParser.extractAcknowledgement(
        response.rawXml,
      );

      if (!acknowledgement.ok || !acknowledgement.statusCode) {
        const failedAttempt = await this.tiramisSubmissionService.markFailed({
          requestId: params.requestId,
          errorMessage:
            acknowledgement.error ||
            'Invalid acknowledgement received from TIRAMIS',
          rawPayload: response.rawXml,
        });

        return {
          attempt: failedAttempt,
          tiraResponse: response,
        };
      }

      const isAcknowledgementSuccess =
        await this.tiramisConfigService.isSuccessResponse(
          acknowledgement.statusCode,
        );

      const acknowledgedAttempt =
        await this.tiramisSubmissionService.markAcknowledgementReceived({
          requestId: params.requestId,
          acknowledgementId: acknowledgement.acknowledgementId,
          statusCode: acknowledgement.statusCode,
          statusDesc: acknowledgement.statusDesc,
          rawXml: response.rawXml,
          isSuccess: isAcknowledgementSuccess,
        });

      return {
        attempt: acknowledgedAttempt,
        tiraResponse: response,
      };
    } catch (error: any) {
      const failedAttempt = await this.tiramisSubmissionService.markFailed({
        requestId: params.requestId,
        errorMessage:
          error?.message ||
          `Failed to submit ${
            params.errorLabel || params.serviceType
          } request to TIRAMIS`,
        rawPayload: error?.response?.data || null,
        isRetryable: true,
      });

      return {
        attempt: failedAttempt,
        tiraResponse: null,
      };
    }
  }

  async previewSignedXml(params: {
    configuration: any;
    rootElement: string;
    payload: Record<string, any>;
    includeSignature?: boolean;
  }) {
    const contentXml = this.xmlBuilder.buildContentXml(
      params.rootElement,
      params.payload,
    );

    if (params.includeSignature === false) {
      return {
        contentXml,
        signature: null,
        tiraMessageXml: this.xmlBuilder.buildTiraMessage({
          rootName: params.rootElement,
          payload: params.payload,
          signature: '',
        }),
      };
    }

    const pfxPaths =
      await this.tiramisConfigService.getPfxPathsForConfiguration(
        params.configuration,
      );

    const signature = this.signatureService.signXmlContent({
      contentXml,
      privateKeyPfxPath: pfxPaths.clientPrivateCertificatePath!,
      privateKeyPfxPassword: pfxPaths.clientPrivateCertificatePassword,
    });

    return {
      contentXml,
      signature,
      tiraMessageXml: this.xmlBuilder.buildSignedTiraMessage({
        rootName: params.rootElement,
        payload: params.payload,
        signature,
      }),
    };
  }
}
