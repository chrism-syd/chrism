export type MemberFormValues = {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_phone: string;
  home_phone: string;
  other_phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state_province: string;
  postal_code: string;
  council_activity_level_code: string;
  council_activity_context_code: string;
  council_reengagement_status_code: string;
};

export type MemberFormState = {
  error: string | null;
  values: MemberFormValues;
};

export type DeleteMemberState = {
  error: string | null;
};

const EMPTY_MEMBER_FORM_VALUES: MemberFormValues = {
  member_id: '',
  first_name: '',
  last_name: '',
  email: '',
  cell_phone: '',
  home_phone: '',
  other_phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state_province: '',
  postal_code: '',
  council_activity_level_code: '',
  council_activity_context_code: '',
  council_reengagement_status_code: '',
};

export const EMPTY_MEMBER_FORM_STATE: MemberFormState = {
  error: null,
  values: EMPTY_MEMBER_FORM_VALUES,
};

export const EMPTY_DELETE_MEMBER_STATE: DeleteMemberState = {
  error: null,
};
