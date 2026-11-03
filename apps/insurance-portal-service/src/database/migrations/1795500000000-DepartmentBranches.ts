import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A department (e.g. CLAIMS) can operate in several branches, so the single
 * departments.branch_id moves to a department_branches join table. A
 * department with no rows stays company-wide.
 */
export class DepartmentBranches1795500000000 implements MigrationInterface {
  name = 'DepartmentBranches1795500000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS department_branches (
        department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        CONSTRAINT "PK_department_branches" PRIMARY KEY (department_id, branch_id)
      );
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_department_branches_branch_id" ON department_branches (branch_id)`,
    );
    await runner.query(`
      INSERT INTO department_branches (department_id, branch_id)
      SELECT id, branch_id FROM departments WHERE branch_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await runner.query(`DROP INDEX IF EXISTS "IDX_departments_branch_id"`);
    await runner.query(
      `ALTER TABLE departments DROP COLUMN IF EXISTS branch_id`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE departments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL`,
    );
    // A multi-branch department keeps only one branch when rolled back.
    await runner.query(`
      UPDATE departments d SET branch_id = (
        SELECT db.branch_id FROM department_branches db
        WHERE db.department_id = d.id
        ORDER BY db.branch_id LIMIT 1
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_departments_branch_id" ON departments (branch_id)`,
    );
    await runner.query(`DROP TABLE IF EXISTS department_branches`);
  }
}
