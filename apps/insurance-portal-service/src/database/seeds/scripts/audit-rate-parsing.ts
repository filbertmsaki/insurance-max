import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseRateText } from '../rate-text-parser';

/**
 * One-off diagnostic (not a migration, doesn't touch the database): re-runs
 * the seed importer's rate-text parsing chain (parseRateText, the same
 * function 002-product-engine.seed.ts uses) against every rule currently in
 * the seed data file, and flags rows where the result doesn't line up with
 * what's stored — the `SP014001000003` ("2%+TPP") bug is very likely not the
 * only row a non-numeric rate-text suffix broke.
 *
 * Run with:
 *   npm run audit:rate-parsing:insurance-portal-service
 * or directly:
 *   node -r ts-node/register -r tsconfig-paths/register \
 *     apps/insurance-portal-service/src/database/seeds/scripts/audit-rate-parsing.ts
 */

interface RuleSeed {
  risk_code: string;
  rule_name: string;
  rate_type: string;
  fixed_amount?: number | null;
  formula?: string | null;
  minimum_amount?: number | null;
  source_rate_text?: string | null;
}

interface Finding {
  reason: 'UNPARSED' | 'RATE_TYPE_MISMATCH' | 'STRUCTURAL_MISMATCH';
  risk_code: string;
  rule_name: string;
  source_rate_text: string;
  current_rate_type: string;
  suggested_rate_type: string | null;
  detail: string;
}

function loadRuleSeeds(): RuleSeed[] {
  const filePath = path.resolve(
    __dirname,
    '..',
    'data',
    'product-engine.seed.data.json',
  );
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as {
    rules?: RuleSeed[];
  };
  return parsed.rules ?? [];
}

function auditRule(seed: RuleSeed): Finding | null {
  const rateText = (seed.source_rate_text ?? seed.formula ?? '').trim();
  const invalidFormulaText = /^(n\/a|#value!)$/i.test(rateText);
  if (!rateText || invalidFormulaText) {
    // Genuinely blank or an explicit TIRA placeholder ("N/A", "#VALUE!") —
    // falling through to FORMULA/fallback here is expected, not a bug.
    return null;
  }

  const parsed = parseRateText(rateText, seed.minimum_amount ?? null);
  const currentRateType = seed.rate_type;

  if (!parsed) {
    return {
      reason: 'UNPARSED',
      risk_code: seed.risk_code,
      rule_name: seed.rule_name,
      source_rate_text: rateText,
      current_rate_type: currentRateType,
      suggested_rate_type: null,
      detail:
        'No regex in the parsing chain matched this rate text at all — it silently falls back to the sheet-provided rate_type/FORMULA. Check for a non-numeric suffix (like the old "%+TPP") or an unexpected unit/format.',
    };
  }

  if (parsed.rateType !== currentRateType) {
    return {
      reason: 'RATE_TYPE_MISMATCH',
      risk_code: seed.risk_code,
      rule_name: seed.rule_name,
      source_rate_text: rateText,
      current_rate_type: currentRateType,
      suggested_rate_type: parsed.rateType,
      detail: `Stored rate_type is "${currentRateType}" but re-parsing source_rate_text with the current chain suggests "${parsed.rateType}".`,
    };
  }

  // Structural sanity check independent of the above: an additive rate text
  // (contains "+") should never have ended up on a single-component type.
  const looksAdditive = /\+/.test(rateText);
  const isSingleComponentType =
    currentRateType === 'PERCENTAGE' || currentRateType === 'FIXED';
  if (looksAdditive && isSingleComponentType) {
    return {
      reason: 'STRUCTURAL_MISMATCH',
      risk_code: seed.risk_code,
      rule_name: seed.rule_name,
      source_rate_text: rateText,
      current_rate_type: currentRateType,
      suggested_rate_type: parsed.rateType,
      detail: `Rate text contains "+" (implying an additive charge) but rate_type is the single-component "${currentRateType}".`,
    };
  }

  return null;
}

function main() {
  const rules = loadRuleSeeds();
  const findings = rules
    .map((rule) => auditRule(rule))
    .filter((finding): finding is Finding => finding !== null);

  console.log(
    `[audit-rate-parsing] Checked ${rules.length} rules, found ${findings.length} to review.\n`,
  );

  const byReason = {
    UNPARSED: findings.filter((f) => f.reason === 'UNPARSED'),
    RATE_TYPE_MISMATCH: findings.filter(
      (f) => f.reason === 'RATE_TYPE_MISMATCH',
    ),
    STRUCTURAL_MISMATCH: findings.filter(
      (f) => f.reason === 'STRUCTURAL_MISMATCH',
    ),
  };

  for (const [reason, group] of Object.entries(byReason)) {
    if (group.length === 0) continue;
    console.log(`\n=== ${reason} (${group.length}) ===`);
    console.table(
      group.map((f) => ({
        risk_code: f.risk_code,
        rule_name: f.rule_name,
        source_rate_text: f.source_rate_text,
        current_rate_type: f.current_rate_type,
        suggested_rate_type: f.suggested_rate_type ?? '(none — review manually)',
      })),
    );
  }

  if (findings.length === 0) {
    console.log('No issues found — every rule parses consistently.');
  } else {
    console.log(
      `\n${findings.length} row(s) flagged for manual review. This script does not modify data — some flagged rows may be intentionally FORMULA-only; confirm before editing the seed data.`,
    );
  }
}

main();
