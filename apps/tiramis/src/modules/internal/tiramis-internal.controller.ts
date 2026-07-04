import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

import { TiramisCoverNoteService } from '../cover-notes/services/tiramis-cover-note.service';
import { TiramisMotorService } from '../motor/services/tiramis-motor.service';
import { TiramisSubmissionService } from '../submissions/services/tiramis-submission.service';
import type {
  SubmitTiramisCommandDto,
  TiramisSubmissionQueryCommandDto,
} from './dto/submit-tiramis-command.dto';

@Controller()
export class TiramisInternalController {
  private readonly logger = new Logger(TiramisInternalController.name);

  constructor(
    private readonly coverNoteService: TiramisCoverNoteService,
    private readonly motorService: TiramisMotorService,
    private readonly submissionService: TiramisSubmissionService,
  ) {}

  @MessagePattern('tiramis.non_motor.submit')
  async submitNonMotor(@Payload() command: SubmitTiramisCommandDto) {
    try {
      this.assertCommand(command, 'NON_MOTOR');

      this.logger.log(
        `Received Non-Motor submission from portal: ${
          command.businessReference || command.payload?.coverNoteNumber
        }`,
      );

      const result = await this.coverNoteService.submit(
        command.payload as any,
        {
          sourceService: command.sourceService || 'insurance-portal-service',
          sourceCompanyId: command.sourceCompanyId || null,
          sourceUserId: command.sourceUserId || null,
          sourceModule: command.sourceModule || null,
          sourceRecordId:
            command.sourceRecordId ||
            command.policyId ||
            command.quotationId ||
            null,
          policyId: command.policyId || null,
          quotationId: command.quotationId || null,
          businessReference:
            command.businessReference ||
            command.payload?.coverNoteNumber ||
            null,
          requestType: command.requestType,
        },
      );

      return this.formatSubmitResponse(result);
    } catch (error: any) {
      this.logger.error(
        `Non-Motor submission failed: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );

      throw new RpcException({
        ok: false,
        message: error?.message || 'Non-Motor submission failed',
        details: error?.response || null,
      });
    }
  }

  @MessagePattern('tiramis.motor.submit')
  async submitMotor(@Payload() command: SubmitTiramisCommandDto) {
    try {
      if (!['MOTOR', 'MOTOR_FLEET'].includes(command?.requestType)) {
        throw new Error(
          `Invalid requestType for Motor submission: ${command?.requestType}`,
        );
      }

      if (!command.payload) {
        throw new Error('payload is required');
      }

      const isFleet = command.requestType === 'MOTOR_FLEET';
      const payload: Record<string, any> = {
        ...command.payload,
        isFleet,
      };

      this.logger.log(
        `Received Motor submission from portal: ${
          command.businessReference || payload.coverNoteNumber
        }`,
      );

      const result = await this.motorService.submit(payload as any, {
        sourceService: command.sourceService || 'insurance-portal-service',
        sourceCompanyId: command.sourceCompanyId || null,
        sourceUserId: command.sourceUserId || null,
        sourceModule: command.sourceModule || null,
        sourceRecordId:
          command.sourceRecordId ||
          command.policyId ||
          command.quotationId ||
          null,
        policyId: command.policyId || null,
        quotationId: command.quotationId || null,
        businessReference:
          command.businessReference ||
          payload.coverNoteNumber ||
          payload.fleet?.fleetId ||
          null,
        requestType: command.requestType,
      });

      return this.formatSubmitResponse(result);
    } catch (error: any) {
      this.logger.error(
        `Motor submission failed: ${error?.message || 'Unknown error'}`,
        error?.stack,
      );

      throw new RpcException({
        ok: false,
        message: error?.message || 'Motor submission failed',
        details: error?.response || null,
      });
    }
  }

  @MessagePattern('tiramis.submission.status')
  async getSubmissionStatus(
    @Payload() query: TiramisSubmissionQueryCommandDto,
  ) {
    try {
      return await this.submissionService.getSubmissionStatus({
        transactionId: query.transactionId || undefined,
        requestId: query.requestId || undefined,
        businessReference: query.businessReference || undefined,
        includePayload: !!query.includePayload,
      });
    } catch (error: any) {
      throw new RpcException({
        ok: false,
        message: error?.message || 'Failed to get TIRAMIS status',
      });
    }
  }

  @MessagePattern('tiramis.submission.trace')
  async getSubmissionTrace(
    @Payload() query: TiramisSubmissionQueryCommandDto,
  ) {
    try {
      return await this.submissionService.getSubmissionTrace({
        transactionId: query.transactionId || undefined,
        requestId: query.requestId || undefined,
        businessReference: query.businessReference || undefined,
        includePayload: !!query.includePayload,
      });
    } catch (error: any) {
      throw new RpcException({
        ok: false,
        message: error?.message || 'Failed to get TIRAMIS trace',
      });
    }
  }

  private assertCommand(command: SubmitTiramisCommandDto, expectedType: string) {
    if (!command) {
      throw new Error('command payload is required');
    }

    if (command.requestType !== expectedType) {
      throw new Error(
        `Invalid requestType. Expected ${expectedType}, received ${command.requestType}`,
      );
    }

    if (!command.payload) {
      throw new Error('payload is required');
    }
  }

  private formatSubmitResponse(result: any) {
    const coverNote = result?.coverNote || null;
    const attempt = result?.attempt || null;
    const transaction = result?.transaction || null;

    return {
      ok: true,
      transaction,
      coverNote,
      attempt,
      requestId:
        coverNote?.requestId ||
        attempt?.requestId ||
        transaction?.currentRequestId ||
        null,
      tiramisTransactionId:
        transaction?.id ||
        coverNote?.transactionId ||
        attempt?.transactionId ||
        null,
      serviceType: transaction?.serviceType || null,
      rootElement: attempt?.rootElement || null,
      acknowledgementStatusCode: attempt?.acknowledgementStatusCode || null,
      acknowledgementStatusDesc: attempt?.acknowledgementStatusDesc || null,
      tiraResponse: result?.tiraResponse || null,
    };
  }
}
