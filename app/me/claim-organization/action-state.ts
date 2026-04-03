export type ClaimOrganizationActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export const initialClaimOrganizationActionState: ClaimOrganizationActionState = {
  status: 'idle',
  message: '',
}
