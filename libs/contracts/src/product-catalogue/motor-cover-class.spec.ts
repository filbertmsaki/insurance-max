import {
  classifyMotorCover,
  countComprehensiveVehicles,
  MotorCoverClass,
} from './motor-cover-class';

describe('classifyMotorCover', () => {
  it('prefers the configured class over the name', () => {
    expect(
      classifyMotorCover({
        cover_class: 'THIRD_PARTY',
        risk_name: 'Comprehensive Private',
      }),
    ).toBe(MotorCoverClass.THIRD_PARTY);
  });

  it.each([
    ['Motor Comprehensive Private', MotorCoverClass.COMPREHENSIVE],
    ['Third Party Fire and Theft', MotorCoverClass.THIRD_PARTY_FIRE_THEFT],
    ['Third Party Only', MotorCoverClass.THIRD_PARTY],
    ['Oil tankers- Comprehensive:TPFT', MotorCoverClass.THIRD_PARTY_FIRE_THEFT],
    ['Oil tankers- Comprehensive:TPO', MotorCoverClass.THIRD_PARTY],
    ['Windscreen', null],
  ])('falls back to the risk name: %s', (name, expected) => {
    expect(classifyMotorCover({ risk_name: name })).toBe(expected);
  });
});

describe('countComprehensiveVehicles', () => {
  it('counts Comprehensive and TPFT, and flags unknown covers', () => {
    expect(
      countComprehensiveVehicles([
        [{ cover_class: 'COMPREHENSIVE' }],
        [{ cover_class: 'THIRD_PARTY_FIRE_THEFT' }],
        [{ cover_class: 'THIRD_PARTY' }],
        [{ risk_name: 'Mystery cover' }],
        [{ cover_class: 'THIRD_PARTY' }, { risk_name: 'Comprehensive' }],
        [],
      ]),
    ).toEqual({ comprehensive: 3, unclassified: 2, total: 6 });
  });
});
