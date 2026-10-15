import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { CoverNotesController } from './cover-notes.controller';
import { CoverNoteListQueryDto } from './dto/cover-note-list-query.dto';

const user = { id: 'user-1', companyId: 'company-1' } as AuthenticatedUser;
const policyId = '6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6';

describe('CoverNotesController.findAll', () => {
  const service = {
    findAll: jest.fn().mockResolvedValue([{ id: 'cn-1' }]),
    findPage: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
  };
  const controller = new CoverNotesController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('keeps the legacy array response without page', async () => {
    await expect(
      controller.findAll(user, { policy_id: policyId }),
    ).resolves.toEqual([{ id: 'cn-1' }]);
    expect(service.findAll).toHaveBeenCalledWith(user, {
      policyId,
      quotationId: undefined,
    });
    expect(service.findPage).not.toHaveBeenCalled();
  });

  it('pages within the requested policy when page is sent', async () => {
    const query = { policy_id: policyId, page: 3, limit: 10, search: 'STK' };
    await controller.findAll(user, query);
    expect(service.findPage).toHaveBeenCalledWith(
      user,
      { policyId, quotationId: undefined },
      query,
    );
  });

  it('accepts record filters together with table params', async () => {
    const dto = plainToInstance(CoverNoteListQueryDto, {
      policy_id: policyId,
      page: '2',
      limit: '10',
    });
    expect(
      await validate(dto, { forbidNonWhitelisted: true, whitelist: true }),
    ).toEqual([]);
  });

  it('rejects non-UUID record filters and oversized pages', async () => {
    const dto = plainToInstance(CoverNoteListQueryDto, {
      quotation_id: 'abc',
      limit: '1000',
    });
    expect((await validate(dto)).map((e) => e.property).sort()).toEqual([
      'limit',
      'quotation_id',
    ]);
  });
});
