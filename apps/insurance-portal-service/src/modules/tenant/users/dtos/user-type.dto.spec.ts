import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

const createBase = {
  first_name: 'Jane',
  last_name: 'Doe',
  phone: '+255712345678',
  email: 'jane@example.com',
  password: 'Sup3rSecret!',
  officer_title: 'Underwriter',
  branch_ids: ['3f1c1a52-2b8e-4a39-9a4c-1d6f0f6c2a11'],
  active_branch_id: '3f1c1a52-2b8e-4a39-9a4c-1d6f0f6c2a11',
};

const userTypeErrors = async (cls: new () => object, plain: object) =>
  (
    await validate(plainToInstance(cls, plain), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).filter((error) => error.property === 'user_type');

// Tenant admins always create company users; the type is never accepted from
// the request, so a tenant can never mint an OWNER or SUPER_ADMIN.
describe('tenant user type', () => {
  it.each(['OWNER', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'AGENT', 'COMPANY_USER'])(
    'rejects user_type %s on create',
    async (type) => {
      expect(
        await userTypeErrors(CreateUserDto, { ...createBase, user_type: type }),
      ).not.toHaveLength(0);
    },
  );

  it('rejects user_type on update', async () => {
    expect(
      await userTypeErrors(UpdateUserDto, { user_type: 'OWNER' }),
    ).not.toHaveLength(0);
  });
});
