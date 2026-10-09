export interface CoverNoteRecord {
  id: string;
  quotation_id: string;
  policy_id: string | null;
  cover_note_number: string;
  cover_note_reference_number: string | null;
  sticker_number: string | null;
  entry_type: string;
  fleet_entry: number | null;
  status: string;
  regulatory_sync_status: string;
  start_date: string;
  end_date: string;
  currency_code: string;
  sum_insured: string;
  premium_including_tax: string;
  issued_at: string | null;
  expires_at: string | null;
}

export interface CoverNoteFilters {
  policy_id?: string;
  quotation_id?: string;
}
