export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_scope_source_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      access_scope_types: {
        Row: {
          code: string
          description: string | null
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action_code: string
          actor_auth_user_id: string | null
          council_id: string | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: number
          payload: Json
        }
        Insert: {
          action_code: string
          actor_auth_user_id?: string | null
          council_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: number
          payload?: Json
        }
        Update: {
          action_code?: string
          actor_auth_user_id?: string | null
          council_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: number
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          code: string
          created_at: string
          created_by_auth_user_id: string | null
          display_name: string
          id: string
          logo_alt_text: string | null
          logo_storage_bucket: string
          logo_storage_path: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name: string
          id?: string
          logo_alt_text?: string | null
          logo_storage_bucket?: string
          logo_storage_path?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string
          id?: string
          logo_alt_text?: string | null
          logo_storage_bucket?: string
          logo_storage_path?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: []
      }
      council_activity_context_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      council_activity_level_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      council_admin_assignments: {
        Row: {
          council_id: string
          created_at: string
          created_by_user_id: string | null
          grantee_email: string | null
          id: string
          is_active: boolean
          notes: string | null
          person_id: string | null
          updated_at: string
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          council_id: string
          created_at?: string
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          person_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          council_id?: string
          created_at?: string
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          person_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_admin_assignments_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_admin_assignments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_admin_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_admin_assignments_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_admin_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      council_reengagement_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      councils: {
        Row: {
          council_number: string
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          council_number: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          council_number?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "councils_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_list_access: {
        Row: {
          created_at: string
          custom_list_id: string
          granted_at: string
          granted_by_auth_user_id: string | null
          grantee_email: string | null
          id: string
          person_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_list_id: string
          granted_at?: string
          granted_by_auth_user_id?: string | null
          grantee_email?: string | null
          id?: string
          person_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_list_id?: string
          granted_at?: string
          granted_by_auth_user_id?: string | null
          grantee_email?: string | null
          id?: string
          person_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_list_access_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "custom_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_access_granted_by_auth_user_id_fkey"
            columns: ["granted_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_access_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_list_members: {
        Row: {
          added_at: string
          added_by_auth_user_id: string | null
          claimed_at: string | null
          claimed_by_person_id: string | null
          created_at: string
          custom_list_id: string
          id: string
          last_contact_at: string | null
          last_contact_by_person_id: string | null
          person_id: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          added_by_auth_user_id?: string | null
          claimed_at?: string | null
          claimed_by_person_id?: string | null
          created_at?: string
          custom_list_id: string
          id?: string
          last_contact_at?: string | null
          last_contact_by_person_id?: string | null
          person_id: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          added_by_auth_user_id?: string | null
          claimed_at?: string | null
          claimed_by_person_id?: string | null
          created_at?: string
          custom_list_id?: string
          id?: string
          last_contact_at?: string | null
          last_contact_by_person_id?: string | null
          person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_list_members_added_by_auth_user_id_fkey"
            columns: ["added_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_members_claimed_by_person_id_fkey"
            columns: ["claimed_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_members_custom_list_id_fkey"
            columns: ["custom_list_id"]
            isOneToOne: false
            referencedRelation: "custom_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_members_last_contact_by_person_id_fkey"
            columns: ["last_contact_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_list_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_lists: {
        Row: {
          archived_at: string | null
          archived_by_auth_user_id: string | null
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_lists_archived_by_auth_user_id_fkey"
            columns: ["archived_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_lists_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_lists_created_by_auth_user_id_fkey"
            columns: ["created_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_lists_updated_by_auth_user_id_fkey"
            columns: ["updated_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      designation_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      distinction_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_archives: {
        Row: {
          council_id: string
          created_at: string
          deleted_at: string
          deleted_by_user_id: string | null
          description: string | null
          ends_at: string | null
          event_kind_code: string | null
          id: string
          location_address: string | null
          location_name: string | null
          original_event_id: string | null
          reminder_days_before: number | null
          reminder_enabled: boolean
          reminder_scheduled_for: string | null
          requires_rsvp: boolean
          rsvp_deadline_at: string | null
          scope_code: string | null
          starts_at: string | null
          status_code: string | null
          title: string
        }
        Insert: {
          council_id: string
          created_at?: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind_code?: string | null
          id?: string
          location_address?: string | null
          location_name?: string | null
          original_event_id?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean
          reminder_scheduled_for?: string | null
          requires_rsvp?: boolean
          rsvp_deadline_at?: string | null
          scope_code?: string | null
          starts_at?: string | null
          status_code?: string | null
          title: string
        }
        Update: {
          council_id?: string
          created_at?: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind_code?: string | null
          id?: string
          location_address?: string | null
          location_name?: string | null
          original_event_id?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean
          reminder_scheduled_for?: string | null
          requires_rsvp?: boolean
          rsvp_deadline_at?: string | null
          scope_code?: string | null
          starts_at?: string | null
          status_code?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_archives_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_archives_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_council_rsvps: {
        Row: {
          created_at: string
          event_id: string
          event_invited_council_id: string
          first_responded_at: string
          id: string
          last_responded_at: string
          responding_contact_email: string | null
          responding_contact_name: string | null
          responding_contact_phone: string | null
          responding_council_name: string
          responding_council_number: string | null
          response_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_invited_council_id: string
          first_responded_at?: string
          id?: string
          last_responded_at?: string
          responding_contact_email?: string | null
          responding_contact_name?: string | null
          responding_contact_phone?: string | null
          responding_council_name: string
          responding_council_number?: string | null
          response_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_invited_council_id?: string
          first_responded_at?: string
          id?: string
          last_responded_at?: string
          responding_contact_email?: string | null
          responding_contact_name?: string | null
          responding_contact_phone?: string | null
          responding_council_name?: string
          responding_council_number?: string | null
          response_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_council_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_council_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_council_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_council_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_council_rsvps_event_invited_council_id_fkey"
            columns: ["event_invited_council_id"]
            isOneToOne: true
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_invited_council_id"]
          },
          {
            foreignKeyName: "event_council_rsvps_event_invited_council_id_fkey"
            columns: ["event_invited_council_id"]
            isOneToOne: true
            referencedRelation: "event_invited_councils"
            referencedColumns: ["id"]
          },
        ]
      }
      event_external_invitees: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          event_id: string
          id: string
          invitee_email: string | null
          invitee_name: string
          invitee_phone: string | null
          invitee_role_label: string | null
          notes: string | null
          sort_order: number
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          event_id: string
          id?: string
          invitee_email?: string | null
          invitee_name: string
          invitee_phone?: string | null
          invitee_role_label?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          event_id?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string
          invitee_phone?: string | null
          invitee_role_label?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_external_invitees_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_external_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_external_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_external_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_external_invitees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_external_invitees_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invited_council_types: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_invited_councils: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invite_contact_name: string | null
          invite_email: string | null
          invited_council_id: string | null
          invited_council_name: string
          invited_council_number: string | null
          invited_council_type_code: string
          is_host: boolean
          rsvp_link_token: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invite_contact_name?: string | null
          invite_email?: string | null
          invited_council_id?: string | null
          invited_council_name: string
          invited_council_number?: string | null
          invited_council_type_code: string
          is_host?: boolean
          rsvp_link_token: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invite_contact_name?: string | null
          invite_email?: string | null
          invited_council_id?: string | null
          invited_council_name?: string
          invited_council_number?: string | null
          invited_council_type_code?: string
          is_host?: boolean
          rsvp_link_token?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invited_councils_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_invited_councils_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_invited_councils_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_invited_councils_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invited_councils_invited_council_id_fkey"
            columns: ["invited_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invited_councils_invited_council_type_code_fkey"
            columns: ["invited_council_type_code"]
            isOneToOne: false
            referencedRelation: "event_invited_council_types"
            referencedColumns: ["code"]
          },
        ]
      }
      event_message_jobs: {
        Row: {
          body_html: string | null
          body_text: string
          created_at: string
          created_by_user_id: string | null
          error_text: string | null
          event_id: string
          event_invited_council_id: string
          failed_at: string | null
          id: string
          message_type_code: string
          payload_snapshot: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status_code: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text: string
          created_at?: string
          created_by_user_id?: string | null
          error_text?: string | null
          event_id: string
          event_invited_council_id: string
          failed_at?: string | null
          id?: string
          message_type_code: string
          payload_snapshot?: Json
          provider_message_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          scheduled_for: string
          sent_at?: string | null
          status_code?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string
          created_at?: string
          created_by_user_id?: string | null
          error_text?: string | null
          event_id?: string
          event_invited_council_id?: string
          failed_at?: string | null
          id?: string
          message_type_code?: string
          payload_snapshot?: Json
          provider_message_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status_code?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_message_jobs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_invited_council_id_fkey"
            columns: ["event_invited_council_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_invited_council_id"]
          },
          {
            foreignKeyName: "event_message_jobs_event_invited_council_id_fkey"
            columns: ["event_invited_council_id"]
            isOneToOne: false
            referencedRelation: "event_invited_councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_message_jobs_message_type_code_fkey"
            columns: ["message_type_code"]
            isOneToOne: false
            referencedRelation: "event_message_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "event_message_jobs_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "event_message_status_types"
            referencedColumns: ["code"]
          },
        ]
      }
      event_message_status_types: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_message_types: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_person_rsvp_attendees: {
        Row: {
          attendee_email: string | null
          attendee_name: string
          attendee_phone: string | null
          created_at: string
          event_person_rsvp_id: string
          id: string
          is_primary: boolean
          matched_person_id: string | null
          sort_order: number
          updated_at: string
          uses_primary_contact: boolean
        }
        Insert: {
          attendee_email?: string | null
          attendee_name: string
          attendee_phone?: string | null
          created_at?: string
          event_person_rsvp_id: string
          id?: string
          is_primary?: boolean
          matched_person_id?: string | null
          sort_order?: number
          updated_at?: string
          uses_primary_contact?: boolean
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string
          attendee_phone?: string | null
          created_at?: string
          event_person_rsvp_id?: string
          id?: string
          is_primary?: boolean
          matched_person_id?: string | null
          sort_order?: number
          updated_at?: string
          uses_primary_contact?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_person_rsvp_attendees_event_person_rsvp_id_fkey"
            columns: ["event_person_rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_person_rsvp_attendees_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      event_person_rsvps: {
        Row: {
          cancelled_at: string | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          event_id: string
          first_responded_at: string
          id: string
          last_responded_at: string
          matched_person_id: string | null
          primary_email: string | null
          primary_name: string
          primary_phone: string | null
          response_notes: string | null
          source_code: string
          status_code: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          event_id: string
          first_responded_at?: string
          id?: string
          last_responded_at?: string
          matched_person_id?: string | null
          primary_email?: string | null
          primary_name: string
          primary_phone?: string | null
          response_notes?: string | null
          source_code?: string
          status_code?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          event_id?: string
          first_responded_at?: string
          id?: string
          last_responded_at?: string
          matched_person_id?: string | null
          primary_email?: string | null
          primary_name?: string
          primary_phone?: string | null
          response_notes?: string | null
          source_code?: string
          status_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_person_rsvps_claimed_by_user_id_fkey"
            columns: ["claimed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_person_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_person_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_person_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_person_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_person_rsvps_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvp_volunteers: {
        Row: {
          created_at: string
          event_council_rsvp_id: string
          event_id: string
          id: string
          sort_order: number
          updated_at: string
          volunteer_email: string | null
          volunteer_name: string
          volunteer_notes: string | null
          volunteer_phone: string | null
        }
        Insert: {
          created_at?: string
          event_council_rsvp_id: string
          event_id: string
          id?: string
          sort_order?: number
          updated_at?: string
          volunteer_email?: string | null
          volunteer_name: string
          volunteer_notes?: string | null
          volunteer_phone?: string | null
        }
        Update: {
          created_at?: string
          event_council_rsvp_id?: string
          event_id?: string
          id?: string
          sort_order?: number
          updated_at?: string
          volunteer_email?: string | null
          volunteer_name?: string
          volunteer_notes?: string | null
          volunteer_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_volunteers_event_council_rsvp_id_fkey"
            columns: ["event_council_rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_council_rsvp_id"]
          },
          {
            foreignKeyName: "event_rsvp_volunteers_event_council_rsvp_id_fkey"
            columns: ["event_council_rsvp_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvp_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvp_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvp_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_person_rsvp_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvp_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_scope_types: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_status_types: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          council_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          display_timezone: string
          ends_at: string
          event_kind_code: string
          id: string
          location_address: string | null
          location_name: string | null
          reminder_days_before: number | null
          reminder_enabled: boolean
          reminder_scheduled_for: string | null
          requires_rsvp: boolean
          rsvp_deadline_at: string | null
          scope_code: string
          starts_at: string
          status_code: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          council_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          display_timezone?: string
          ends_at: string
          event_kind_code?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean
          reminder_scheduled_for?: string | null
          requires_rsvp?: boolean
          rsvp_deadline_at?: string | null
          scope_code?: string
          starts_at: string
          status_code?: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          council_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          display_timezone?: string
          ends_at?: string
          event_kind_code?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean
          reminder_scheduled_for?: string | null
          requires_rsvp?: boolean
          rsvp_deadline_at?: string | null
          scope_code?: string
          starts_at?: string
          status_code?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_scope_code_fkey"
            columns: ["scope_code"]
            isOneToOne: false
            referencedRelation: "event_scope_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "events_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "event_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "events_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      note_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      officer_role_emails: {
        Row: {
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          email: string
          id: string
          is_active: boolean
          login_enabled: boolean
          office_code: string
          office_rank: number | null
          office_scope_code: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          email: string
          id?: string
          is_active?: boolean
          login_enabled?: boolean
          office_code: string
          office_rank?: number | null
          office_scope_code: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          email?: string
          id?: string
          is_active?: boolean
          login_enabled?: boolean
          office_code?: string
          office_rank?: number | null
          office_scope_code?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officer_role_emails_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      official_import_batch_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      official_import_batches: {
        Row: {
          batch_status_code: string
          council_id: string
          created_at: string
          file_sha256: string | null
          id: string
          imported_at: string
          notes: string | null
          retention_until: string
          row_count: number
          source_filename: string | null
          storage_object_path: string | null
          updated_at: string
          uploaded_by_auth_user_id: string | null
        }
        Insert: {
          batch_status_code: string
          council_id: string
          created_at?: string
          file_sha256?: string | null
          id?: string
          imported_at?: string
          notes?: string | null
          retention_until?: string
          row_count?: number
          source_filename?: string | null
          storage_object_path?: string | null
          updated_at?: string
          uploaded_by_auth_user_id?: string | null
        }
        Update: {
          batch_status_code?: string
          council_id?: string
          created_at?: string
          file_sha256?: string | null
          id?: string
          imported_at?: string
          notes?: string | null
          retention_until?: string
          row_count?: number
          source_filename?: string | null
          storage_object_path?: string | null
          updated_at?: string
          uploaded_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_import_batches_batch_status_code_fkey"
            columns: ["batch_status_code"]
            isOneToOne: false
            referencedRelation: "official_import_batch_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "official_import_batches_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      official_import_review_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      official_import_row_action_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      official_import_rows: {
        Row: {
          applied_at: string | null
          batch_id: string
          council_id: string
          created_at: string
          id: string
          matched_official_member_record_id: string | null
          matched_person_id: string | null
          member_number: string | null
          missing_from_import: boolean
          proposed_action_code: string
          proposed_changes: Json
          raw_payload: Json
          review_notes: string | null
          review_status_code: string
          reviewed_at: string | null
          reviewed_by_auth_user_id: string | null
          row_number: number | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          batch_id: string
          council_id: string
          created_at?: string
          id?: string
          matched_official_member_record_id?: string | null
          matched_person_id?: string | null
          member_number?: string | null
          missing_from_import?: boolean
          proposed_action_code: string
          proposed_changes?: Json
          raw_payload?: Json
          review_notes?: string | null
          review_status_code: string
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          row_number?: number | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          batch_id?: string
          council_id?: string
          created_at?: string
          id?: string
          matched_official_member_record_id?: string | null
          matched_person_id?: string | null
          member_number?: string | null
          missing_from_import?: boolean
          proposed_action_code?: string
          proposed_changes?: Json
          raw_payload?: Json
          review_notes?: string | null
          review_status_code?: string
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          row_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "official_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_import_rows_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_import_rows_matched_official_member_record_id_fkey"
            columns: ["matched_official_member_record_id"]
            isOneToOne: false
            referencedRelation: "official_member_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_import_rows_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_import_rows_proposed_action_code_fkey"
            columns: ["proposed_action_code"]
            isOneToOne: false
            referencedRelation: "official_import_row_action_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "official_import_rows_review_status_code_fkey"
            columns: ["review_status_code"]
            isOneToOne: false
            referencedRelation: "official_import_review_status_types"
            referencedColumns: ["code"]
          },
        ]
      }
      official_member_records: {
        Row: {
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          last_imported_at: string | null
          member_number: string | null
          official_membership_status_code: string
          person_id: string
          raw_member_class: string | null
          raw_member_type: string | null
          raw_payload: Json
          raw_status_text: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          last_imported_at?: string | null
          member_number?: string | null
          official_membership_status_code: string
          person_id: string
          raw_member_class?: string | null
          raw_member_type?: string | null
          raw_payload?: Json
          raw_status_text?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          last_imported_at?: string | null
          member_number?: string | null
          official_membership_status_code?: string
          person_id?: string
          raw_member_class?: string | null
          raw_member_type?: string | null
          raw_payload?: Json
          raw_status_text?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_member_records_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_member_records_official_membership_status_code_fkey"
            columns: ["official_membership_status_code"]
            isOneToOne: false
            referencedRelation: "official_membership_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "official_member_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      official_membership_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      organization_admin_assignments: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          grantee_email: string | null
          id: string
          is_active: boolean
          organization_id: string
          person_id: string | null
          updated_at: string
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          person_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          person_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_admin_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admin_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_kofc_profiles: {
        Row: {
          council_number: string
          created_at: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          council_number: string
          created_at?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          council_number?: string
          created_at?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_kofc_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_membership_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      organization_memberships: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          ended_at: string | null
          id: string
          is_primary_membership: boolean
          joined_at: string | null
          membership_number: string | null
          membership_status_code: string
          notes: string | null
          organization_id: string
          person_id: string
          source_code: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          is_primary_membership?: boolean
          joined_at?: string | null
          membership_number?: string | null
          membership_status_code: string
          notes?: string | null
          organization_id: string
          person_id: string
          source_code?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          is_primary_membership?: boolean
          joined_at?: string | null
          membership_number?: string | null
          membership_status_code?: string
          notes?: string | null
          organization_id?: string
          person_id?: string
          source_code?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_membership_status_code_fkey"
            columns: ["membership_status_code"]
            isOneToOne: false
            referencedRelation: "organization_membership_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_relationship_type_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      organization_relationships: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          from_organization_id: string
          id: string
          relationship_type_code: string
          to_organization_id: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          from_organization_id: string
          id?: string
          relationship_type_code: string
          to_organization_id: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          from_organization_id?: string
          id?: string
          relationship_type_code?: string
          to_organization_id?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_relationships_from_organization_id_fkey"
            columns: ["from_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_relationships_relationship_type_code_fkey"
            columns: ["relationship_type_code"]
            isOneToOne: false
            referencedRelation: "organization_relationship_type_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organization_relationships_to_organization_id_fkey"
            columns: ["to_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_type_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      organizations: {
        Row: {
          brand_profile_id: string
          created_at: string
          created_by_auth_user_id: string | null
          display_name: string
          id: string
          logo_alt_text: string | null
          logo_storage_bucket: string
          logo_storage_path: string | null
          organization_type_code: string
          preferred_name: string | null
          primary_color_hex: string | null
          secondary_color_hex: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          brand_profile_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name: string
          id?: string
          logo_alt_text?: string | null
          logo_storage_bucket?: string
          logo_storage_path?: string | null
          organization_type_code: string
          preferred_name?: string | null
          primary_color_hex?: string | null
          secondary_color_hex?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          brand_profile_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string
          id?: string
          logo_alt_text?: string | null
          logo_storage_bucket?: string
          logo_storage_path?: string | null
          organization_type_code?: string
          preferred_name?: string | null
          primary_color_hex?: string | null
          secondary_color_hex?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_organization_type_code_fkey"
            columns: ["organization_type_code"]
            isOneToOne: false
            referencedRelation: "organization_type_types"
            referencedColumns: ["code"]
          },
        ]
      }
      people: {
        Row: {
          address_line_1: string | null
          address_line_1_hash: string | null
          address_line_2: string | null
          address_line_2_hash: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by_auth_user_id: string | null
          birth_date: string | null
          birth_date_hash: string | null
          cell_phone: string | null
          cell_phone_hash: string | null
          city: string | null
          city_hash: string | null
          council_activity_context_code: string | null
          council_activity_level_code: string | null
          council_id: string | null
          council_reengagement_status_code: string | null
          country_code: string | null
          country_code_hash: string | null
          created_at: string
          created_by_auth_user_id: string | null
          created_source_code: string
          directory_display_name_override: string | null
          email: string | null
          email_hash: string | null
          first_name: string
          home_phone: string | null
          home_phone_hash: string | null
          id: string
          is_provisional_member: boolean
          last_name: string
          merged_into_person_id: string | null
          middle_name: string | null
          name_prefix: string | null
          nickname: string | null
          other_phone: string | null
          other_phone_hash: string | null
          pii_key_version: string | null
          postal_code: string | null
          postal_code_hash: string | null
          primary_relationship_code: string
          prospect_status_code: string | null
          state_province: string | null
          state_province_hash: string | null
          suffix: string | null
          title: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
          volunteer_context_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_1_hash?: string | null
          address_line_2?: string | null
          address_line_2_hash?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          birth_date?: string | null
          birth_date_hash?: string | null
          cell_phone?: string | null
          cell_phone_hash?: string | null
          city?: string | null
          city_hash?: string | null
          council_activity_context_code?: string | null
          council_activity_level_code?: string | null
          council_id?: string | null
          council_reengagement_status_code?: string | null
          country_code?: string | null
          country_code_hash?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          created_source_code: string
          directory_display_name_override?: string | null
          email?: string | null
          email_hash?: string | null
          first_name: string
          home_phone?: string | null
          home_phone_hash?: string | null
          id?: string
          is_provisional_member?: boolean
          last_name: string
          merged_into_person_id?: string | null
          middle_name?: string | null
          name_prefix?: string | null
          nickname?: string | null
          other_phone?: string | null
          other_phone_hash?: string | null
          pii_key_version?: string | null
          postal_code?: string | null
          postal_code_hash?: string | null
          primary_relationship_code: string
          prospect_status_code?: string | null
          state_province?: string | null
          state_province_hash?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
          volunteer_context_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_1_hash?: string | null
          address_line_2?: string | null
          address_line_2_hash?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          birth_date?: string | null
          birth_date_hash?: string | null
          cell_phone?: string | null
          cell_phone_hash?: string | null
          city?: string | null
          city_hash?: string | null
          council_activity_context_code?: string | null
          council_activity_level_code?: string | null
          council_id?: string | null
          council_reengagement_status_code?: string | null
          country_code?: string | null
          country_code_hash?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          created_source_code?: string
          directory_display_name_override?: string | null
          email?: string | null
          email_hash?: string | null
          first_name?: string
          home_phone?: string | null
          home_phone_hash?: string | null
          id?: string
          is_provisional_member?: boolean
          last_name?: string
          merged_into_person_id?: string | null
          middle_name?: string | null
          name_prefix?: string | null
          nickname?: string | null
          other_phone?: string | null
          other_phone_hash?: string | null
          pii_key_version?: string | null
          postal_code?: string | null
          postal_code_hash?: string | null
          primary_relationship_code?: string
          prospect_status_code?: string | null
          state_province?: string | null
          state_province_hash?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
          volunteer_context_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_council_activity_context_code_fkey"
            columns: ["council_activity_context_code"]
            isOneToOne: false
            referencedRelation: "council_activity_context_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_council_activity_level_code_fkey"
            columns: ["council_activity_level_code"]
            isOneToOne: false
            referencedRelation: "council_activity_level_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_council_reengagement_status_code_fkey"
            columns: ["council_reengagement_status_code"]
            isOneToOne: false
            referencedRelation: "council_reengagement_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_created_source_code_fkey"
            columns: ["created_source_code"]
            isOneToOne: false
            referencedRelation: "person_source_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_primary_relationship_code_fkey"
            columns: ["primary_relationship_code"]
            isOneToOne: false
            referencedRelation: "primary_relationship_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_prospect_status_code_fkey"
            columns: ["prospect_status_code"]
            isOneToOne: false
            referencedRelation: "prospect_status_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_volunteer_context_code_fkey"
            columns: ["volunteer_context_code"]
            isOneToOne: false
            referencedRelation: "volunteer_context_types"
            referencedColumns: ["code"]
          },
        ]
      }
      person_assignments: {
        Row: {
          assigned_at: string
          assigned_by_auth_user_id: string | null
          council_id: string
          created_at: string
          ended_at: string | null
          ended_by_auth_user_id: string | null
          id: string
          notes: string | null
          person_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_auth_user_id?: string | null
          council_id: string
          created_at?: string
          ended_at?: string | null
          ended_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          person_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_auth_user_id?: string | null
          council_id?: string
          created_at?: string
          ended_at?: string | null
          ended_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_assignments_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      person_contact_change_log: {
        Row: {
          changed_at: string
          changed_by_auth_user_id: string | null
          changed_fields: Json
          council_id: string
          id: string
          new_values: Json
          old_values: Json
          person_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_auth_user_id?: string | null
          changed_fields?: Json
          council_id: string
          id?: string
          new_values?: Json
          old_values?: Json
          person_id: string
        }
        Update: {
          changed_at?: string
          changed_by_auth_user_id?: string | null
          changed_fields?: Json
          council_id?: string
          id?: string
          new_values?: Json
          old_values?: Json
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_contact_change_log_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_contact_change_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_designations: {
        Row: {
          appointed_on: string | null
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          designation_code: string
          fraternal_year: number
          id: string
          notes: string | null
          person_id: string
          vacated_on: string | null
        }
        Insert: {
          appointed_on?: string | null
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          designation_code: string
          fraternal_year: number
          id?: string
          notes?: string | null
          person_id: string
          vacated_on?: string | null
        }
        Update: {
          appointed_on?: string | null
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          designation_code?: string
          fraternal_year?: number
          id?: string
          notes?: string | null
          person_id?: string
          vacated_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_designations_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_designations_designation_code_fkey"
            columns: ["designation_code"]
            isOneToOne: false
            referencedRelation: "designation_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "person_designations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_distinctions: {
        Row: {
          awarded_on: string | null
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          distinction_code: string
          id: string
          notes: string | null
          person_id: string
        }
        Insert: {
          awarded_on?: string | null
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          distinction_code: string
          id?: string
          notes?: string | null
          person_id: string
        }
        Update: {
          awarded_on?: string | null
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          distinction_code?: string
          id?: string
          notes?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_distinctions_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_distinctions_distinction_code_fkey"
            columns: ["distinction_code"]
            isOneToOne: false
            referencedRelation: "distinction_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "person_distinctions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_kofc_profiles: {
        Row: {
          assembly_number: string | null
          created_at: string
          first_degree_date: string | null
          member_class: string | null
          member_type: string | null
          person_id: string
          second_degree_date: string | null
          third_degree_date: string | null
          updated_at: string
          years_in_service: number | null
        }
        Insert: {
          assembly_number?: string | null
          created_at?: string
          first_degree_date?: string | null
          member_class?: string | null
          member_type?: string | null
          person_id: string
          second_degree_date?: string | null
          third_degree_date?: string | null
          updated_at?: string
          years_in_service?: number | null
        }
        Update: {
          assembly_number?: string | null
          created_at?: string
          first_degree_date?: string | null
          member_class?: string | null
          member_type?: string | null
          person_id?: string
          second_degree_date?: string | null
          third_degree_date?: string | null
          updated_at?: string
          years_in_service?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "person_kofc_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_merges: {
        Row: {
          council_id: string
          field_resolution: Json
          id: string
          merged_at: string
          merged_by_auth_user_id: string
          notes: string | null
          source_person_id: string
          target_person_id: string
        }
        Insert: {
          council_id: string
          field_resolution?: Json
          id?: string
          merged_at?: string
          merged_by_auth_user_id: string
          notes?: string | null
          source_person_id: string
          target_person_id: string
        }
        Update: {
          council_id?: string
          field_resolution?: Json
          id?: string
          merged_at?: string
          merged_by_auth_user_id?: string
          notes?: string | null
          source_person_id?: string
          target_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_merges_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merges_source_person_id_fkey"
            columns: ["source_person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merges_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_notes: {
        Row: {
          body: string
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          note_type_code: string
          person_id: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          body: string
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          note_type_code: string
          person_id: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          body?: string
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          note_type_code?: string
          person_id?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_notes_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_notes_note_type_code_fkey"
            columns: ["note_type_code"]
            isOneToOne: false
            referencedRelation: "note_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "person_notes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_officer_terms: {
        Row: {
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          notes: string | null
          office_code: string
          office_label: string
          office_rank: number | null
          office_scope_code: string
          person_id: string
          service_end_year: number | null
          service_start_year: number
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          office_code: string
          office_label: string
          office_rank?: number | null
          office_scope_code: string
          person_id: string
          service_end_year?: number | null
          service_start_year: number
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          office_code?: string
          office_label?: string
          office_rank?: number | null
          office_scope_code?: string
          person_id?: string
          service_end_year?: number | null
          service_start_year?: number
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_officer_terms_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_officer_terms_created_by_auth_user_id_fkey"
            columns: ["created_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_officer_terms_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_officer_terms_updated_by_auth_user_id_fkey"
            columns: ["updated_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      person_profile_change_requests: {
        Row: {
          cell_phone_change_requested: boolean
          created_at: string
          decision_notice_cleared_at: string | null
          email_change_requested: boolean
          home_phone_change_requested: boolean
          id: string
          person_id: string
          pii_key_version: string | null
          proposed_cell_phone: string | null
          proposed_cell_phone_hash: string | null
          proposed_email: string | null
          proposed_email_hash: string | null
          proposed_home_phone: string | null
          proposed_home_phone_hash: string | null
          proposed_preferred_name: string | null
          requested_at: string
          requested_by_auth_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_auth_user_id: string | null
          status_code: string
          updated_at: string
        }
        Insert: {
          cell_phone_change_requested?: boolean
          created_at?: string
          decision_notice_cleared_at?: string | null
          email_change_requested?: boolean
          home_phone_change_requested?: boolean
          id?: string
          person_id: string
          pii_key_version?: string | null
          proposed_cell_phone?: string | null
          proposed_cell_phone_hash?: string | null
          proposed_email?: string | null
          proposed_email_hash?: string | null
          proposed_home_phone?: string | null
          proposed_home_phone_hash?: string | null
          proposed_preferred_name?: string | null
          requested_at?: string
          requested_by_auth_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          status_code?: string
          updated_at?: string
        }
        Update: {
          cell_phone_change_requested?: boolean
          created_at?: string
          decision_notice_cleared_at?: string | null
          email_change_requested?: boolean
          home_phone_change_requested?: boolean
          id?: string
          person_id?: string
          pii_key_version?: string | null
          proposed_cell_phone?: string | null
          proposed_cell_phone_hash?: string | null
          proposed_email?: string | null
          proposed_email_hash?: string | null
          proposed_home_phone?: string | null
          proposed_home_phone_hash?: string | null
          proposed_preferred_name?: string | null
          requested_at?: string
          requested_by_auth_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          status_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_profile_change_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_source_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      primary_relationship_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      prospect_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      supreme_update_queue: {
        Row: {
          change_summary: Json
          changed_fields: Json
          cleared_at: string | null
          cleared_by_auth_user_id: string | null
          council_id: string
          created_at: string
          created_by_auth_user_id: string | null
          dismissed_reason: string | null
          id: string
          person_id: string
          status_code: string
          updated_at: string
        }
        Insert: {
          change_summary?: Json
          changed_fields?: Json
          cleared_at?: string | null
          cleared_by_auth_user_id?: string | null
          council_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          dismissed_reason?: string | null
          id?: string
          person_id: string
          status_code: string
          updated_at?: string
        }
        Update: {
          change_summary?: Json
          changed_fields?: Json
          cleared_at?: string | null
          cleared_by_auth_user_id?: string | null
          council_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          dismissed_reason?: string | null
          id?: string
          person_id?: string
          status_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supreme_update_queue_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supreme_update_queue_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supreme_update_queue_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "supreme_update_status_types"
            referencedColumns: ["code"]
          },
        ]
      }
      supreme_update_status_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_access_scopes: {
        Row: {
          confirmed_at: string | null
          council_id: string
          created_at: string
          ends_at: string | null
          granted_by_auth_user_id: string | null
          id: string
          notes: string | null
          scope_code: string
          source_designation_code: string | null
          source_type_code: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          council_id: string
          created_at?: string
          ends_at?: string | null
          granted_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          scope_code: string
          source_designation_code?: string | null
          source_type_code: string
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          council_id?: string
          created_at?: string
          ends_at?: string | null
          granted_by_auth_user_id?: string | null
          id?: string
          notes?: string | null
          scope_code?: string
          source_designation_code?: string | null
          source_type_code?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_scopes_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_scopes_scope_code_fkey"
            columns: ["scope_code"]
            isOneToOne: false
            referencedRelation: "access_scope_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_access_scopes_source_designation_code_fkey"
            columns: ["source_designation_code"]
            isOneToOne: false
            referencedRelation: "designation_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_access_scopes_source_type_code_fkey"
            columns: ["source_type_code"]
            isOneToOne: false
            referencedRelation: "access_scope_source_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_access_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_admin_grants: {
        Row: {
          council_id: string
          created_at: string
          granted_at: string
          granted_by_auth_user_id: string | null
          id: string
          reason: string | null
          revoked_at: string | null
          revoked_by_auth_user_id: string | null
          user_id: string
        }
        Insert: {
          council_id: string
          created_at?: string
          granted_at?: string
          granted_by_auth_user_id?: string | null
          id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by_auth_user_id?: string | null
          user_id: string
        }
        Update: {
          council_id?: string
          created_at?: string
          granted_at?: string
          granted_by_auth_user_id?: string | null
          id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by_auth_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_admin_grants_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          council_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_super_admin: boolean
          person_id: string | null
          updated_at: string
        }
        Insert: {
          council_id?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          is_super_admin?: boolean
          person_id?: string | null
          updated_at?: string
        }
        Update: {
          council_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          person_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_context_types: {
        Row: {
          code: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      event_council_rsvp_rollups: {
        Row: {
          event_council_rsvp_id: string | null
          event_id: string | null
          event_invited_council_id: string | null
          first_responded_at: string | null
          has_responded: boolean | null
          host_council_id: string | null
          invite_email: string | null
          invited_council_id: string | null
          invited_council_name: string | null
          invited_council_number: string | null
          invited_council_type_code: string | null
          is_host: boolean | null
          last_responded_at: string | null
          volunteer_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invited_councils_invited_council_id_fkey"
            columns: ["invited_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invited_councils_invited_council_type_code_fkey"
            columns: ["invited_council_type_code"]
            isOneToOne: false
            referencedRelation: "event_invited_council_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "events_council_id_fkey"
            columns: ["host_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      event_host_summary: {
        Row: {
          event_id: string | null
          host_council_id: string | null
          invited_council_count: number | null
          responded_council_count: number | null
          total_volunteer_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_council_id_fkey"
            columns: ["host_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      event_person_rsvp_summary: {
        Row: {
          active_submission_count: number | null
          event_id: string | null
          host_council_id: string | null
          last_responded_at: string | null
          total_volunteer_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_council_id_fkey"
            columns: ["host_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_supreme_import_row: {
        Args: {
          p_address_line_1?: string
          p_address_line_1_hash?: string
          p_assembly_number?: string
          p_auth_user_id: string
          p_birth_date?: string
          p_birth_date_hash?: string
          p_cell_phone?: string
          p_cell_phone_hash?: string
          p_city?: string
          p_city_hash?: string
          p_council_activity_level_code?: string
          p_council_id: string
          p_council_number?: string
          p_email?: string
          p_email_hash?: string
          p_existing_person_id?: string
          p_first_degree_date?: string
          p_first_name?: string
          p_import_mode: string
          p_last_name?: string
          p_member_class?: string
          p_member_number?: string
          p_member_type?: string
          p_middle_name?: string
          p_organization_id: string
          p_pii_key_version?: string
          p_postal_code?: string
          p_postal_code_hash?: string
          p_second_degree_date?: string
          p_state_province?: string
          p_state_province_hash?: string
          p_suffix?: string
          p_third_degree_date?: string
          p_title?: string
          p_years_in_service?: number
        }
        Returns: Json
      }
      current_user_council_id: { Args: never; Returns: string }
      generate_rsvp_token: { Args: never; Returns: string }
      user_belongs_to_council: {
        Args: { target_council_id: string }
        Returns: boolean
      }
      user_can_access_event: { Args: { event_uuid: string }; Returns: boolean }
      user_can_manage_event: { Args: { event_uuid: string }; Returns: boolean }
      user_is_council_admin: {
        Args: { target_council_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
