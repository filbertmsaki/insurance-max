import { MigrationInterface, QueryRunner } from 'typeorm';
import { join } from 'path';

type TiramisClientConfigurationRow = {
  id: string;
  environment: string;
  client_private_certificate_path: string | null;
  tira_public_certificate_path: string | null;
};

function buildRelativeCertificatePath(
  environment: string,
  fileName: string,
): string {
  return join('src', 'assets', 'certificaties', environment, fileName);
}

function buildAbsoluteCertificatePath(
  environment: string,
  fileName: string,
): string {
  return join(
    process.cwd(),
    'apps',
    'tiramis',
    'src',
    'assets',
    'certificaties',
    environment,
    fileName,
  );
}

export class AutoMigration1780599100000 implements MigrationInterface {
  name = 'AutoMigration1780599100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const configurations = (await queryRunner.query(
      `SELECT id, environment, client_private_certificate_path, tira_public_certificate_path FROM "tiramis_client_configurations"`,
    )) as TiramisClientConfigurationRow[];

    for (const configuration of configurations) {
      const updates: string[] = [];
      const parameters: Array<string | null> = [];

      if (configuration.client_private_certificate_path) {
        updates.push(
          `client_private_certificate_path = $${updates.length + 1}`,
        );
        parameters.push(
          buildRelativeCertificatePath(
            configuration.environment,
            'clientprivate.pfx',
          ),
        );
      }

      if (configuration.tira_public_certificate_path) {
        updates.push(`tira_public_certificate_path = $${updates.length + 1}`);
        parameters.push(
          buildRelativeCertificatePath(
            configuration.environment,
            'tiramispublic.pfx',
          ),
        );
      }

      if (updates.length === 0) {
        continue;
      }

      parameters.push(configuration.id);

      await queryRunner.query(
        `UPDATE "tiramis_client_configurations" SET ${updates.join(', ')} WHERE id = $${
          updates.length + 1
        }`,
        parameters,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const configurations = (await queryRunner.query(
      `SELECT id, environment, client_private_certificate_path, tira_public_certificate_path FROM "tiramis_client_configurations"`,
    )) as TiramisClientConfigurationRow[];

    for (const configuration of configurations) {
      const updates: string[] = [];
      const parameters: Array<string | null> = [];

      if (configuration.client_private_certificate_path) {
        updates.push(
          `client_private_certificate_path = $${updates.length + 1}`,
        );
        parameters.push(
          buildAbsoluteCertificatePath(
            configuration.environment,
            'clientprivate.pfx',
          ),
        );
      }

      if (configuration.tira_public_certificate_path) {
        updates.push(`tira_public_certificate_path = $${updates.length + 1}`);
        parameters.push(
          buildAbsoluteCertificatePath(
            configuration.environment,
            'tiramispublic.pfx',
          ),
        );
      }

      if (updates.length === 0) {
        continue;
      }

      parameters.push(configuration.id);

      await queryRunner.query(
        `UPDATE "tiramis_client_configurations" SET ${updates.join(', ')} WHERE id = $${
          updates.length + 1
        }`,
        parameters,
      );
    }
  }
}
