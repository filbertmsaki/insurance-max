import { ConflictException, NotFoundException } from '@nestjs/common';
import { EndorsementTypesService } from './endorsement-types.service';
import { EndorsementType } from '../entities/endorsement-type.entity';

describe('EndorsementTypesService', () => {
  const companyId = 'company-1';

  function makeService(existing: Partial<EndorsementType>[] = []) {
    const records = [...existing] as EndorsementType[];

    const repository = {
      find: jest.fn(({ where }: any) =>
        Promise.resolve(
          records.filter(
            (row) =>
              row.company_id === where.company_id &&
              (where.is_active === undefined ||
                row.is_active === where.is_active),
          ),
        ),
      ),
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(
          records.find(
            (row) =>
              row.company_id === where.company_id &&
              (where.id === undefined || row.id === where.id) &&
              (where.code === undefined || row.code === where.code),
          ) ?? null,
        ),
      ),
      create: jest.fn((input: Partial<EndorsementType>) => input),
      save: jest.fn((row: EndorsementType) => {
        records.push(row);
        return Promise.resolve(row);
      }),
    };

    return { service: new EndorsementTypesService(repository as any), records };
  }

  it('creates a new endorsement type', async () => {
    const { service, records } = makeService();

    const created = await service.create(companyId, {
      code: 'INCREASE_SUM_INSURED',
      name: 'Increase Sum Insured',
    });

    expect(created).toMatchObject({
      company_id: companyId,
      code: 'INCREASE_SUM_INSURED',
      name: 'Increase Sum Insured',
      tira_endorsement_type: null,
      requires_new_cover_note: true,
      is_active: true,
    });
    expect(records).toHaveLength(1);
  });

  it('rejects creating a duplicate code for the same company', async () => {
    const { service } = makeService([
      {
        company_id: companyId,
        code: 'INCREASE_SUM_INSURED',
        name: 'Increase Sum Insured',
      },
    ]);

    await expect(
      service.create(companyId, {
        code: 'INCREASE_SUM_INSURED',
        name: 'Duplicate',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findAll returns only active types by default', async () => {
    const { service } = makeService([
      {
        company_id: companyId,
        code: 'ACTIVE_ONE',
        name: 'Active One',
        is_active: true,
      },
      {
        company_id: companyId,
        code: 'INACTIVE_ONE',
        name: 'Inactive One',
        is_active: false,
      },
    ]);

    const active = await service.findAll(companyId);
    expect(active.map((row) => row.code)).toEqual(['ACTIVE_ONE']);

    const all = await service.findAll(companyId, true);
    expect(all.map((row) => row.code).sort()).toEqual([
      'ACTIVE_ONE',
      'INACTIVE_ONE',
    ]);
  });

  it('requireActive throws when the type is missing', async () => {
    const { service } = makeService();

    await expect(
      service.requireActive(companyId, 'MISSING'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requireActive throws when the type is inactive', async () => {
    const { service } = makeService([
      {
        company_id: companyId,
        code: 'INACTIVE_ONE',
        name: 'Inactive One',
        is_active: false,
      },
    ]);

    await expect(
      service.requireActive(companyId, 'INACTIVE_ONE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requireActive resolves the active type', async () => {
    const { service } = makeService([
      {
        id: 'type-1',
        company_id: companyId,
        code: 'ACTIVE_ONE',
        name: 'Active One',
        is_active: true,
      },
    ]);

    await expect(
      service.requireActive(companyId, 'ACTIVE_ONE'),
    ).resolves.toMatchObject({ id: 'type-1' });
  });

  it('update throws when the type does not belong to the company', async () => {
    const { service } = makeService([
      {
        id: 'type-1',
        company_id: 'other-company',
        code: 'ACTIVE_ONE',
        name: 'Active One',
        is_active: true,
      },
    ]);

    await expect(
      service.update(companyId, 'type-1', { name: 'Renamed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update applies partial changes and keeps existing values otherwise', async () => {
    const { service } = makeService([
      {
        id: 'type-1',
        company_id: companyId,
        code: 'ACTIVE_ONE',
        name: 'Active One',
        tira_endorsement_type: null,
        requires_new_cover_note: true,
        is_active: true,
      },
    ]);

    const updated = await service.update(companyId, 'type-1', {
      tira_endorsement_type: 12,
    });

    expect(updated).toMatchObject({
      name: 'Active One',
      tira_endorsement_type: 12,
      requires_new_cover_note: true,
      is_active: true,
    });
  });
});
