import { Injectable } from '@nestjs/common';

import type {
  CreateMotorCoverNoteDto,
  CreateMotorDetailDto,
} from '../dto/create-motor-cover-note.dto';
import type { TiramisResolvedRequestDtoFields } from '../../config/services/tiramis-config.service';

@Injectable()
export class TiramisMotorPayloadService {
  buildMotorCoverNotePayload(params: {
    dto: CreateMotorCoverNoteDto & TiramisResolvedRequestDtoFields;
    requestId: string;
  }): Record<string, any> {
    const dto = params.dto;

    const coverNoteDtl: Record<string, any> = {
      SalePointCode: dto.salePointCode,
      CoverNoteStartDate: this.formatDateTime(dto.coverNoteStartDate),
      CoverNoteEndDate: this.formatDateTime(dto.coverNoteEndDate),
      PaymentMode: dto.paymentMode,
      CurrencyCode: dto.currencyCode,
      ExchangeRate: dto.exchangeRate,
      TotalPremiumExcludingTax: dto.totalPremiumExcludingTax,
      TotalPremiumIncludingTax: dto.totalPremiumIncludingTax,
      CommisionPaid: dto.commissionPaid || '0.00',
      CommisionRate: dto.commissionRate || '0.00',
      OfficerName: dto.officerName,
      OfficerTitle: dto.officerTitle,
      ProductCode: dto.productCode,
      PolicyHolders: {
        PolicyHolder: dto.policyHolders.map((holder) => ({
          PolicyHolderName: holder.policyHolderName,
          PolicyHolderBirthDate: holder.policyHolderBirthDate
            ? this.formatDate(holder.policyHolderBirthDate)
            : '',
          PolicyHolderType: holder.policyHolderType,
          PolicyHolderIdNumber: holder.policyHolderIdNumber,
          PolicyHolderIdType: holder.policyHolderIdType,
          Gender: holder.gender || '',
          CountryCode: holder.countryCode,
          Region: holder.region,
          District: holder.district,
          Street: holder.street || '',
          PolicyHolderPhoneNumber: holder.phoneNumber,
          PolicyHolderFax: holder.fax || '',
          PostalAddress: holder.postalAddress || '',
          EmailAddress: holder.emailAddress || '',
        })),
      },
    };

    if (dto.isFleet) {
      coverNoteDtl.FleetHdr = {
        FleetId: dto.fleet?.fleetId,
        FleetType: dto.fleet?.fleetType || '',
        FleetSize: dto.fleet?.fleetSize,
        ComprehensiveInsured: dto.fleet?.comprehensiveInsured || '',
      };

      coverNoteDtl.FleetDtl = {
        FleetEntry: dto.fleet?.items.map((item) => ({
          FleetEntry: item.fleetEntry || '',
          CoverNoteNumber: item.coverNoteNumber,
          PrevCoverNoteReferenceNumber: item.prevCoverNoteReferenceNumber || '',
          CoverNoteDesc: item.coverNoteDesc || dto.coverNoteDesc,
          OperativeClause: item.operativeClause || dto.operativeClause,
          EndorsementType: item.endorsementType || '',
          EndorsementReason: item.endorsementReason || '',
          EndorsementPremiumEarned: item.endorsementPremiumEarned || '',
          MotorDtl: this.mapMotorDetail(item.motorDetail),
        })),
      };
    } else {
      coverNoteDtl.CoverNoteNumber = dto.coverNoteNumber;
      coverNoteDtl.PrevCoverNoteReferenceNumber =
        dto.prevCoverNoteReferenceNumber || '';
      coverNoteDtl.CoverNoteDesc = dto.coverNoteDesc;
      coverNoteDtl.OperativeClause = dto.operativeClause;
      coverNoteDtl.EndorsementType = dto.endorsementType || '';
      coverNoteDtl.EndorsementReason = dto.endorsementReason || '';
      coverNoteDtl.EndorsementPremiumEarned =
        dto.endorsementPremiumEarned || '';
      coverNoteDtl.MotorDtl = this.mapMotorDetail(dto.motorDetail!);
    }

    return {
      CoverNoteHdr: {
        RequestId: params.requestId,
        CompanyCode: dto.companyCode,
        SystemCode: dto.systemCode,
        CallBackUrl: dto.callbackUrl,
        InsurerCompanyCode: dto.insurerCompanyCode,
        TranCompanyCode: dto.tranCompanyCode || '',
        CoverNoteType: dto.coverNoteType,
      },
      CoverNoteDtl: coverNoteDtl,
    };
  }

  private mapMotorDetail(motor: CreateMotorDetailDto): Record<string, any> {
    return {
      MotorCategory: motor.motorCategory || '',
      MotorType: motor.motorType || '',
      RegistrationNumber: motor.registrationNumber || '',
      ChassisNumber: motor.chassisNumber,
      Make: motor.make || '',
      Model: motor.model || '',
      ModelNumber: motor.modelNumber || '',
      BodyType: motor.bodyType || '',
      Color: motor.color || '',
      EngineNumber: motor.engineNumber || '',
      EngineCapacity: motor.engineCapacity || '',
      FuelUsed: motor.fuelUsed || '',
      NumberOfAxles: motor.numberOfAxles || '',
      AxleDistance: motor.axleDistance || '',
      SittingCapacity: motor.sittingCapacity || '',
      YearOfManufacture: motor.yearOfManufacture || '',
      TareWeight: motor.tareWeight || '',
      GrossWeight: motor.grossWeight || '',
      MotorUsage: motor.motorUsage || '',
      OwnerName: motor.ownerName || '',
      OwnerCategory: motor.ownerCategory || '',
      OwnerAddress: motor.ownerAddress || '',
    };
  }

  private formatDateTime(value: Date | string): string {
    const date = new Date(value);
    return date.toISOString().slice(0, 19);
  }

  private formatDate(value: Date | string): string {
    const date = new Date(value);
    return date.toISOString().slice(0, 10);
  }
}
