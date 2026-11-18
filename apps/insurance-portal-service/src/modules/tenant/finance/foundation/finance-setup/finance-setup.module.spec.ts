import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AuditModule } from '../../../../shared/audit/audit.module';
import { AuditService } from '../../../../shared/audit/audit.service';
import { InsuranceDocumentsModule } from '../../../insurance-documents/insurance-documents.module';
import { DocumentStorageService } from '../../../insurance-documents/document-storage.service';
import { FinanceFoundationModule } from '../finance-foundation.module';
import { FinanceLedgerFoundationService } from '../../accounting/general-ledger/finance-ledger-foundation.service';
import { FinanceSetupController } from './finance-setup.controller';
import { FinanceSetupModule } from './finance-setup.module';

@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: {} }],
  exports: [getDataSourceToken()],
})
class TestDatabaseModule {}

@Module({
  providers: [{ provide: AuditService, useValue: {} }],
  exports: [AuditService],
})
class TestAuditModule {}

@Module({
  providers: [{ provide: DocumentStorageService, useValue: {} }],
  exports: [DocumentStorageService],
})
class TestDocumentsModule {}

@Module({
  providers: [{ provide: FinanceLedgerFoundationService, useValue: {} }],
  exports: [FinanceLedgerFoundationService],
})
class TestFoundationModule {}

describe('FinanceSetupModule', () => {
  it('resolves the setup controller with its module dependencies', async () => {
    const module = await Test.createTestingModule({
      imports: [TestDatabaseModule, FinanceSetupModule],
    })
      .overrideModule(AuditModule)
      .useModule(TestAuditModule)
      .overrideModule(InsuranceDocumentsModule)
      .useModule(TestDocumentsModule)
      .overrideModule(FinanceFoundationModule)
      .useModule(TestFoundationModule)
      .compile();

    expect(module.get(FinanceSetupController)).toBeInstanceOf(
      FinanceSetupController,
    );
    await module.close();
  });
});
