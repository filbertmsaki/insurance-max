/**
 * Standard motor policy wording printed on the policy schedule. Kept as data so
 * the renderer stays layout-only and the wording can later move to product
 * configuration without touching the PDF code.
 */

export const VALIDITY_NOTICE =
  'VALIDITY OF THIS POLICY IS SUBJECT TO RECEIPT OF PREMIUM BY INSURER PRIOR TO INCEPTION OF RISK & SUBJECT TO REALISATON OF CHEQUE, WHEREVER APPLICABLE';

export const AUTHORIZED_DRIVERS: [string, string][] = [
  ['a)', 'The Insured'],
  [
    'b)',
    "Any person driving on the insured's order or with his permission Provided that the person driving is permitted in accordance with the licensing or other laws or regulations to drive the Motor Vehicle or has been permitted and is not disqualified by order of a Court of Law or by reason of any enactment or regulation in that behalf from driving the Motor Vehicle",
  ],
];

export const LIMITATIONS_AS_TO_USE =
  "Use in connection with insured's business Use for social domestic and pleasure purposes. The policy does not cover use for racing, pacemaking, reliability trial";

export const USE_CLAUSES: [string, string][] = [
  ['Goods carrying Vehicle:', 'Passenger carrying not permitted'],
  [
    'Passenger Vehicle:',
    'Passenger carrying permitted as per licensed by authorities',
  ],
  [
    'Geographical Area:',
    'East African Countries for own damage and theft claims and United Republic of Tanzania for Third party risks',
  ],
];

export const LEGISLATION =
  'Motor vehicle insurance(Third Party Risks) Ordinance 1945 (Tanganyika) (Section-7) and The Motor Vehicle (Third Party Risks) decree 1953 (Zanzibar) (Section 6) Warranted subject to the following endorsement(s) and slip(s) attached hereon:';

export const CONDITIONS_AND_EXTENSIONS = [
  'Loss/damage caused due to mutiny, war or nuclear risk.',
  'Driver found under the influence of liquor or drugs.',
  'Vehicle is used or brought outside of the country.',
  "Insured vehicle is used for any other purpose that doesn't mention in the limitations of usage in the agreement.",
  'Wearing of tires, tubes or any other part.',
  'Any substantial loss or mechanical breakdown.',
  'General wear or aging of the vehicle',
  'Excluding pre-existing damages if any.',
  'mines and vehicles used for test drives or races.',
  'vehicles used in construction sites',
  'buses and any fare paying passenger carrying vehicles',
  'Excluding any loss &/or damage caused due to caking and lumping.',
  'defense/army vehicles',
  'security companies',
  'Vehicles belonging to or used as taxis',
  'Excluding all internal damages unless caused by accidental means.',
  'Covers Personal accident',
  'Covers Total loss',
  'Cover damages due to natural calamities',
  'covers the theft of a car',
  'Covers issues such as mechanical or electrical failure',
  'It offers coverage for third party injuries, accidents, and even death.',
];

export const ENDORSEMENT_TITLE =
  'General, War & Terrorism Exclusion Endorsement';

/** Schedule I: [condition, included, commercial, private, motor cycle]. */
export const SCHEDULE_I_ROWS: string[][] = [
  ['1.Third Party Injury/Death', 'Yes', 'Unlimited', 'Unlimited', 'Unlimited'],
  [
    '2.Third Party Property Damage',
    'Yes',
    '100,000,000/=',
    '100,000,000/=',
    '50,000,000/=',
  ],
  [
    '3.Passanger Liability Per Person',
    'Yes',
    '30,000,000/=',
    '30,000,000/=',
    '20,000,000/=',
  ],
  ['Per Event', 'Yes', '100,000,000/=', '100,000,000/=', 'N/A'],
  ['4.Medical Expenses Per Person', 'Yes', 'N/A', '500,000/=', '250,000/='],
  ['Per Event', 'Yes', 'N/A', '2,500,000/=', '2,500,000/='],
  [
    '5(i) Towing Charges within Dar',
    'Yes',
    '500,000/=',
    '500,000/=',
    '100,000/=',
  ],
  [
    '(ii) Towing Charges outside Dar',
    'Yes',
    '1,500,000/=',
    '1,500,000/=',
    'N/A',
  ],
  ['6. Riot / Strikes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['7.Windscreen Cover', 'Yes', '1,000,000/=', '750,000/=', 'N/A'],
  ['8. Geographical Limit - East Africa', 'Yes', 'Yes', 'Yes', 'Yes'],
];

export const SCHEDULE_I_NOTES =
  'For towing charges-city means place where the vehicle shall be towed for repairs of safe keeping & limit mentioned is maximum but subject to reasonable charges for towing the vehicle. All the limits of liabilities mentioned above are the maximum limits.\n**Towing Charges include Protection, Storage & Removal Charges.\n*Passenger means fare paying passenger';

/** Schedule II(a): [condition, included, private motor, motor cycles]. */
export const SCHEDULE_IIA_ROWS: string[][] = [
  [
    '9.1 Own Damage (a) within East Africa',
    '',
    '5% of claim min. 350,000/= (Double the Excess in case of total theft claim)',
    '5% of claim min. 350,000/= (Double the Excess in case of total theft claim)',
  ],
  [
    '(b) Outside East Africa',
    'Yes',
    'Twice as item 9.1 (a) above',
    'Twice as item 9.1 (a) above',
  ],
  [
    '9.2 Young & Inexperienced Driver',
    'Yes',
    '5% of claim min. 500,000/=',
    '5% of claim min. 200,000/=',
  ],
  ['9.3 TPPD', 'Yes', '250,000/=', '50,000/='],
];

export const SCHEDULE_IIA_NOTE =
  'Definition of young & inexperienced driver : Under 25 years of age and/or possessing Licence for less than 2 years for the respective class of vehicle';

/** Schedule II(b): [condition, included, goods, taxi, buses, special]. */
export const SCHEDULE_IIB_ROWS: string[][] = [
  [
    '9.1 Own Damage (a) Within East Africa',
    'Yes',
    '7.5% of claim minimum 500,000/=(10% of Claim, Minimum 750,000/- in case of total Theft) & 15% of Sum Insured of Tankers',
    '7.5% of claim Minimum 350,000/- (10% of Claim, Minimum 750,000/= in case of total theft',
    '10% of claim minimum 1,000,000/=(10% of Claim, minimum 2,000,000/- in case',
    '10% of claim minimum 1,000,000/= each and every claim',
  ],
  [
    '(b) Outside East Africa',
    'Yes',
    'Twice as item 9.1 (a) above',
    'Twice as item 9.1 (a) above',
    'Twice as item 9.1 (a) above',
    'Twice as item 9.1 (a) above',
  ],
  [
    '9.2 Young & Inexperienced Driver',
    'Yes',
    '10% of claim minimum 1,000,000/=',
    '10% of claim minimum 1,000,000/=',
    '10% of claim minimum 1,000,000/=',
    '',
  ],
  ['9.3 TPPD', 'Yes', '500,000/=', '500,000/=', '500,000/=', ''],
];

export const SCHEDULE_II_NOTES = [
  '1. Item No. 4 to 8 and 9.1 do not apply in case of Third Party cover.',
  '2. Excess: Either 9.1,9.2 or 9.3 will apply and not cumulatively.',
  '3. Windscreen cover if stated in the schedule is subject to deductibles/excess of Tshs 50,000 for each and every loss.',
  '4. TP cover is restricted to United Republic of Tanzania',
  '5. East Africa Means Tanzania, Kenya, Uganda, Rwanda & Burundi.',
  '6. If any of the Limits/Excess mentioned above are modified in the policy schedule such modified Limits/ Excess shall apply',
];

export const WITNESS_TEXT =
  'In witness whereof the undersigned being duly authorized by the Insurers and on behalf of the Insurers has/have hereunto set his/their hand(s)';

export const FOOTER_NOTE =
  'Note : This cover is subject to the terms and conditions and exceptions attached at the end of the policy document';
