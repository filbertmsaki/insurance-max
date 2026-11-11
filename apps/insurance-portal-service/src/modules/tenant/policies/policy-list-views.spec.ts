import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FilterPolicyDto } from './dto/filter-policy.dto';
import {
  EXPIRING_SOON_DAYS,
  POLICY_VIEW_CONDITIONS,
  tiraStateSql,
} from './policy-list-views';

describe('policy register filters', () => {
  it('treats 7 days or fewer of cover as expiring soon', () => {
    expect(EXPIRING_SOON_DAYS).toBe(7);
    expect(POLICY_VIEW_CONDITIONS.expiring).toContain(':viewExpiringDays');
  });

  it('groups final TIRAMIS outcomes as success, not "not submitted"', () => {
    const sql = tiraStateSql('policy.tira_status');
    for (const value of ['FINAL_SUCCESS', 'COMPLETED', 'SUCCESS']) {
      expect(sql).toContain(`'${value}'`);
    }
    expect(POLICY_VIEW_CONDITIONS.tira_failed).toContain("= 'failed'");
  });

  it('accepts the register query params and rejects unknown values', () => {
    const valid = plainToInstance(FilterPolicyDto, {
      view: 'expiring',
      tira_state: 'failed',
      include_summary: 'true',
    });
    expect(validateSync(valid)).toEqual([]);
    expect(valid.include_summary).toBe(true);

    const invalid = plainToInstance(FilterPolicyDto, {
      view: 'everything',
      tira_state: 'maybe',
    });
    expect(
      validateSync(invalid)
        .map((error) => error.property)
        .sort(),
    ).toEqual(['tira_state', 'view']);
  });
});
