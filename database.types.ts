export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _archive_council_admin_assignments: {
        Row: {
          council_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          grantee_email: string | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          person_id: string | null
          updated_at: string | null
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          council_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          person_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          council_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          grantee_email?: string | null
          id?: string | null
          is_active?: boolean | null
          notes?: string | null
          person_id?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      _archive_custom_list_access: {
        Row: {
          created_at: string | null
          custom_list_id: string | null
          granted_at: string | null
          granted_by_auth_user_id: string | null
          grantee_email: string | null
          id: string | null
          person_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          custom_list_id?: string | null
          granted_at?: string | null
          granted_by_auth_user_id?: string | null
          grantee_email?: string | null
          id?: string | null
          person_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          custom_list_id?: string | null
          granted_at?: string | null
          granted_by_auth_user_id?: string | null
          grantee_email?: string | null
          id?: string | null
          person_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      _archive_organization_admin_assignments: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          grant_notes: string | null
          grantee_email: string | null
          id: string | null
          is_active: boolean | null
          organization_claim_request_id: string | null
          organization_id: string | null
          person_id: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          revoked_notes: string | null
          source_code: string | null
          updated_at: string | null
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          grant_notes?: string | null
          grantee_email?: string | null
          id?: string | null
          is_active?: boolean | null
          organization_claim_request_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_notes?: string | null
          source_code?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          grant_notes?: string | null
          grantee_email?: string | null
          id?: string | null
          is_active?: boolean | null
          organization_claim_request_id?: string | null
          organization_id?: string | null
          person_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_notes?: string | null
          source_code?: string | null
          updated_at?: string | null
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      area_access_grants: {
        Row: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          area_code: Database["public"]["Enums"]["member_area_code"]
          created_at: string
          created_by_auth_user_id: string | null
          expires_at: string | null
          granted_at: string
          id: string
          local_unit_id: string
          member_record_id: string
          revoked_at: string | null
          source_code: Database["public"]["Enums"]["grant_source_code"]
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          area_code: Database["public"]["Enums"]["member_area_code"]
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          local_unit_id: string
          member_record_id: string
          revoked_at?: string | null
          source_code?: Database["public"]["Enums"]["grant_source_code"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["area_access_level"]
          area_code?: Database["public"]["Enums"]["member_area_code"]
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          local_unit_id?: string
          member_record_id?: string
          revoked_at?: string | null
          source_code?: Database["public"]["Enums"]["grant_source_code"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_access_grants_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_access_grants_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
            referencedColumns: ["id"]
          },
        ]
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
      catechism_references: {
        Row: {
          body_excerpt: string | null
          created_at: string
          id: string
          is_active: boolean
          reference_code: string
          slug: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body_excerpt?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          reference_code: string
          slug: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body_excerpt?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          reference_code?: string
          slug?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catechism_topics: {
        Row: {
          catechism_reference_id: string
          created_at: string
          relevance_score: number | null
          topic_id: string
        }
        Insert: {
          catechism_reference_id: string
          created_at?: string
          relevance_score?: number | null
          topic_id: string
        }
        Update: {
          catechism_reference_id?: string
          created_at?: string
          relevance_score?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catechism_topics_catechism_reference_id_fkey"
            columns: ["catechism_reference_id"]
            isOneToOne: false
            referencedRelation: "catechism_references"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catechism_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "spiritual_topics"
            referencedColumns: ["id"]
          },
        ]
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
          council_id: string | null
          created_at: string
          created_by_auth_user_id: string | null
          description: string | null
          id: string
          local_unit_id: string
          name: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          council_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          description?: string | null
          id?: string
          local_unit_id: string
          name: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by_auth_user_id?: string | null
          council_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          description?: string | null
          id?: string
          local_unit_id?: string
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
            foreignKeyName: "custom_lists_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
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
      daily_reading_entries: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reading_date: string
          scripture_passage_id: string | null
          spiritual_content_item_id: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reading_date: string
          scripture_passage_id?: string | null
          spiritual_content_item_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reading_date?: string
          scripture_passage_id?: string | null
          spiritual_content_item_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reading_entries_scripture_passage_id_fkey"
            columns: ["scripture_passage_id"]
            isOneToOne: false
            referencedRelation: "scripture_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reading_entries_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
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
          created_at: string
          deleted_at: string
          deleted_by_user_id: string | null
          description: string | null
          ends_at: string | null
          event_kind_code: string | null
          id: string
          local_unit_id: string
          location_address: string | null
          location_name: string | null
          needs_volunteers: boolean
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
          volunteer_deadline_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind_code?: string | null
          id?: string
          local_unit_id: string
          location_address?: string | null
          location_name?: string | null
          needs_volunteers?: boolean
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
          volunteer_deadline_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind_code?: string | null
          id?: string
          local_unit_id?: string
          location_address?: string | null
          location_name?: string | null
          needs_volunteers?: boolean
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
          volunteer_deadline_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_archives_deleted_by_user_id_fkey"
            columns: ["deleted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_archives_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      event_assignment_roles: {
        Row: {
          code: string
          label: string
          precedence: number
        }
        Insert: {
          code: string
          label: string
          precedence?: number
        }
        Update: {
          code?: string
          label?: string
          precedence?: number
        }
        Relationships: []
      }
      event_assignments: {
        Row: {
          assignment_scope: Database["public"]["Enums"]["event_assignment_scope_code"]
          created_at: string
          created_by_auth_user_id: string | null
          event_id: string | null
          id: string
          legacy_event_kind_code: string | null
          local_unit_id: string
          member_record_id: string
          notes: string | null
          role_code: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          assignment_scope: Database["public"]["Enums"]["event_assignment_scope_code"]
          created_at?: string
          created_by_auth_user_id?: string | null
          event_id?: string | null
          id?: string
          legacy_event_kind_code?: string | null
          local_unit_id: string
          member_record_id: string
          notes?: string | null
          role_code?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          assignment_scope?: Database["public"]["Enums"]["event_assignment_scope_code"]
          created_at?: string
          created_by_auth_user_id?: string | null
          event_id?: string | null
          id?: string
          legacy_event_kind_code?: string | null
          local_unit_id?: string
          member_record_id?: string
          notes?: string | null
          role_code?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "event_assignment_roles"
            referencedColumns: ["code"]
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
          is_volunteer: boolean
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
          is_volunteer?: boolean
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
          is_volunteer?: boolean
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
          created_at: string
          created_by_user_id: string
          description: string | null
          display_timezone: string
          ends_at: string | null
          event_kind_code: string
          id: string
          local_unit_id: string
          location_address: string | null
          location_name: string | null
          needs_volunteers: boolean
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
          volunteer_deadline_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          display_timezone?: string
          ends_at?: string | null
          event_kind_code?: string
          id?: string
          local_unit_id: string
          location_address?: string | null
          location_name?: string | null
          needs_volunteers?: boolean
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
          volunteer_deadline_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          display_timezone?: string
          ends_at?: string | null
          event_kind_code?: string
          id?: string
          local_unit_id?: string
          location_address?: string | null
          location_name?: string | null
          needs_volunteers?: boolean
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
          volunteer_deadline_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
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
      legacy_fossil_resolutions: {
        Row: {
          id: string
          notes: string | null
          resolution_code: string
          resolved_at: string
          resolved_by_auth_user_id: string | null
          source_row_id: string
          source_table: string
        }
        Insert: {
          id?: string
          notes?: string | null
          resolution_code?: string
          resolved_at?: string
          resolved_by_auth_user_id?: string | null
          source_row_id: string
          source_table: string
        }
        Update: {
          id?: string
          notes?: string | null
          resolution_code?: string
          resolved_at?: string
          resolved_by_auth_user_id?: string | null
          source_row_id?: string
          source_table?: string
        }
        Relationships: []
      }
      local_role_definitions: {
        Row: {
          code: string | null
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          is_active: boolean
          is_single_seat: boolean
          label: string
          local_unit_id: string
          precedence: number
          role_kind: Database["public"]["Enums"]["role_kind"]
          source_template_id: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          is_single_seat?: boolean
          label: string
          local_unit_id: string
          precedence?: number
          role_kind: Database["public"]["Enums"]["role_kind"]
          source_template_id?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          is_single_seat?: boolean
          label?: string
          local_unit_id?: string
          precedence?: number
          role_kind?: Database["public"]["Enums"]["role_kind"]
          source_template_id?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_role_definitions_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_external_links: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          is_active: boolean
          label: string
          local_unit_id: string
          sort_order: number
          updated_at: string
          updated_by_auth_user_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          label: string
          local_unit_id: string
          sort_order?: number
          updated_at?: string
          updated_by_auth_user_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          label?: string
          local_unit_id?: string
          sort_order?: number
          updated_at?: string
          updated_by_auth_user_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_external_links_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_message_routes: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          is_active: boolean
          local_unit_id: string
          recipient_email: string | null
          recipient_label: string | null
          recipient_person_id: string | null
          route_key: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          local_unit_id: string
          recipient_email?: string | null
          recipient_label?: string | null
          recipient_person_id?: string | null
          route_key: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          local_unit_id?: string
          recipient_email?: string | null
          recipient_label?: string | null
          recipient_person_id?: string | null
          route_key?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_message_routes_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_message_routes_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_people: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          ended_at: string | null
          id: string
          linked_at: string
          linked_by_auth_user_id: string | null
          local_unit_id: string
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
          linked_at?: string
          linked_by_auth_user_id?: string | null
          local_unit_id: string
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
          linked_at?: string
          linked_by_auth_user_id?: string | null
          local_unit_id?: string
          person_id?: string
          source_code?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_people_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_public_contact_message_jobs: {
        Row: {
          body_text: string
          cleared_at: string | null
          cleared_by_auth_user_id: string | null
          created_at: string
          failed_at: string | null
          failure_message: string | null
          id: string
          inquiry_type_code: string
          local_unit_id: string
          payload_snapshot: Json
          recipient_email: string
          recipient_label: string | null
          reply_to_email: string
          route_key: string
          scheduled_for: string
          sent_at: string | null
          status_code: string
          subject: string
          submitter_name: string
          submitter_phone: string | null
          updated_at: string
        }
        Insert: {
          body_text: string
          cleared_at?: string | null
          cleared_by_auth_user_id?: string | null
          created_at?: string
          failed_at?: string | null
          failure_message?: string | null
          id?: string
          inquiry_type_code: string
          local_unit_id: string
          payload_snapshot?: Json
          recipient_email: string
          recipient_label?: string | null
          reply_to_email: string
          route_key?: string
          scheduled_for?: string
          sent_at?: string | null
          status_code?: string
          subject: string
          submitter_name: string
          submitter_phone?: string | null
          updated_at?: string
        }
        Update: {
          body_text?: string
          cleared_at?: string | null
          cleared_by_auth_user_id?: string | null
          created_at?: string
          failed_at?: string | null
          failure_message?: string | null
          id?: string
          inquiry_type_code?: string
          local_unit_id?: string
          payload_snapshot?: Json
          recipient_email?: string
          recipient_label?: string | null
          reply_to_email?: string
          route_key?: string
          scheduled_for?: string
          sent_at?: string | null
          status_code?: string
          subject?: string
          submitter_name?: string
          submitter_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_public_contact_message_jobs_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_public_gallery_images: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          is_active: boolean
          local_unit_id: string
          sort_order: number
          storage_bucket: string
          storage_path: string
          title: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          local_unit_id: string
          sort_order?: number
          storage_bucket?: string
          storage_path: string
          title?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          is_active?: boolean
          local_unit_id?: string
          sort_order?: number
          storage_bucket?: string
          storage_path?: string
          title?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_public_gallery_images_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_reporting_year_settings: {
        Row: {
          created_at: string
          local_unit_id: string
          updated_at: string
          year_label: string
          year_start_day: number
          year_start_month: number
        }
        Insert: {
          created_at?: string
          local_unit_id: string
          updated_at?: string
          year_label?: string
          year_start_day?: number
          year_start_month?: number
        }
        Update: {
          created_at?: string
          local_unit_id?: string
          updated_at?: string
          year_label?: string
          year_start_day?: number
          year_start_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_reporting_year_settings_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: true
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_volunteer_hour_adjustments: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          credited_on: string
          event_id: string | null
          hours_delta: number
          id: string
          local_unit_id: string
          note: string | null
          person_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          credited_on?: string
          event_id?: string | null
          hours_delta: number
          id?: string
          local_unit_id: string
          note?: string | null
          person_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          credited_on?: string
          event_id?: string | null
          hours_delta?: number
          id?: string
          local_unit_id?: string
          note?: string | null
          person_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_council_rsvp_rollups"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_host_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_unit_volunteer_hour_adjustments_voided_by_user_id_fkey"
            columns: ["voided_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      local_units: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          created_by_auth_user_id: string | null
          display_name: string
          id: string
          legacy_council_id: string | null
          legacy_organization_id: string | null
          local_unit_kind: Database["public"]["Enums"]["local_unit_kind"]
          official_name: string
          organization_family_id: string
          postal_code: string | null
          province_state: string | null
          public_address_line1: string | null
          public_address_line2: string | null
          public_city: string | null
          public_country: string | null
          public_email: string | null
          public_location_name: string | null
          public_location_url: string | null
          public_postal_code: string | null
          public_region: string | null
          status: Database["public"]["Enums"]["local_unit_status"]
          timezone: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
          visibility: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name: string
          id?: string
          legacy_council_id?: string | null
          legacy_organization_id?: string | null
          local_unit_kind: Database["public"]["Enums"]["local_unit_kind"]
          official_name: string
          organization_family_id: string
          postal_code?: string | null
          province_state?: string | null
          public_address_line1?: string | null
          public_address_line2?: string | null
          public_city?: string | null
          public_country?: string | null
          public_email?: string | null
          public_location_name?: string | null
          public_location_url?: string | null
          public_postal_code?: string | null
          public_region?: string | null
          status?: Database["public"]["Enums"]["local_unit_status"]
          timezone?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
          visibility?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string
          id?: string
          legacy_council_id?: string | null
          legacy_organization_id?: string | null
          local_unit_kind?: Database["public"]["Enums"]["local_unit_kind"]
          official_name?: string
          organization_family_id?: string
          postal_code?: string | null
          province_state?: string | null
          public_address_line1?: string | null
          public_address_line2?: string | null
          public_city?: string | null
          public_country?: string | null
          public_email?: string | null
          public_location_name?: string | null
          public_location_url?: string | null
          public_postal_code?: string | null
          public_region?: string | null
          status?: Database["public"]["Enums"]["local_unit_status"]
          timezone?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_units_legacy_council_id_fkey"
            columns: ["legacy_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_units_legacy_organization_id_fkey"
            columns: ["legacy_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_units_organization_family_id_fkey"
            columns: ["organization_family_id"]
            isOneToOne: false
            referencedRelation: "organization_families"
            referencedColumns: ["id"]
          },
        ]
      }
      member_records: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          archived_at: string | null
          city: string | null
          country_code: string | null
          created_at: string
          created_by_auth_user_id: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          legacy_council_id: string | null
          legacy_people_id: string | null
          lifecycle_state: Database["public"]["Enums"]["member_record_lifecycle_state"]
          local_unit_id: string
          member_number: string | null
          middle_name: string | null
          phone: string | null
          postal_code: string | null
          preferred_display_name: string | null
          province_state: string | null
          suffix: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          legacy_council_id?: string | null
          legacy_people_id?: string | null
          lifecycle_state?: Database["public"]["Enums"]["member_record_lifecycle_state"]
          local_unit_id: string
          member_number?: string | null
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_display_name?: string | null
          province_state?: string | null
          suffix?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          archived_at?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          legacy_council_id?: string | null
          legacy_people_id?: string | null
          lifecycle_state?: Database["public"]["Enums"]["member_record_lifecycle_state"]
          local_unit_id?: string
          member_number?: string | null
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_display_name?: string | null
          province_state?: string | null
          suffix?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_records_legacy_council_id_fkey"
            columns: ["legacy_council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_records_legacy_people_id_fkey"
            columns: ["legacy_people_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_records_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_claim_requests: {
        Row: {
          created_at: string
          id: string
          local_unit_id: string
          member_number: string | null
          requester_email: string
          requester_name: string
          requester_phone: string | null
          requester_user_id: string | null
          reviewed_at: string | null
          reviewed_by_auth_user_id: string | null
          reviewer_notes: string | null
          status_code: Database["public"]["Enums"]["membership_claim_status_code"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_unit_id: string
          member_number?: string | null
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          requester_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          reviewer_notes?: string | null
          status_code?: Database["public"]["Enums"]["membership_claim_status_code"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          local_unit_id?: string
          member_number?: string | null
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          requester_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          reviewer_notes?: string | null
          status_code?: Database["public"]["Enums"]["membership_claim_status_code"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_claim_requests_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_review_queue: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payload: Json
          resolved_at: string | null
          resolved_by_auth_user_id: string | null
          review_type: string
          source_row_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json
          resolved_at?: string | null
          resolved_by_auth_user_id?: string | null
          review_type: string
          source_row_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json
          resolved_at?: string | null
          resolved_by_auth_user_id?: string | null
          review_type?: string
          source_row_id?: string
          source_table?: string
        }
        Relationships: []
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
          created_at: string
          created_by_auth_user_id: string | null
          email: string
          id: string
          is_active: boolean
          local_unit_id: string
          login_enabled: boolean
          office_code: string
          office_rank: number | null
          office_scope_code: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          email: string
          id?: string
          is_active?: boolean
          local_unit_id: string
          login_enabled?: boolean
          office_code: string
          office_rank?: number | null
          office_scope_code: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          email?: string
          id?: string
          is_active?: boolean
          local_unit_id?: string
          login_enabled?: boolean
          office_code?: string
          office_rank?: number | null
          office_scope_code?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officer_role_emails_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
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
          grant_notes: string | null
          grantee_email: string | null
          id: string
          is_active: boolean
          organization_claim_request_id: string | null
          organization_id: string
          person_id: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          revoked_notes: string | null
          source_code: string
          updated_at: string
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          grant_notes?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          organization_claim_request_id?: string | null
          organization_id: string
          person_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_notes?: string | null
          source_code?: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          grant_notes?: string | null
          grantee_email?: string | null
          id?: string
          is_active?: boolean
          organization_claim_request_id?: string | null
          organization_id?: string
          person_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          revoked_notes?: string | null
          source_code?: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_admin_assignment_organization_claim_request_i_fkey"
            columns: ["organization_claim_request_id"]
            isOneToOne: false
            referencedRelation: "organization_claim_requests"
            referencedColumns: ["id"]
          },
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
      organization_admin_invitations: {
        Row: {
          accepted_assignment_id: string | null
          accepted_at: string | null
          accepted_by_auth_user_id: string | null
          challenge_response_hash: string | null
          council_id: string | null
          created_at: string
          created_by_auth_user_id: string | null
          expires_at: string
          id: string
          invited_by_auth_user_id: string | null
          invitee_email: string
          invitee_name: string | null
          notes: string | null
          organization_id: string
          revoked_at: string | null
          revoked_by_auth_user_id: string | null
          revoked_notes: string | null
          selector: string
          status_code: string
          token_hash: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          accepted_assignment_id?: string | null
          accepted_at?: string | null
          accepted_by_auth_user_id?: string | null
          challenge_response_hash?: string | null
          council_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at: string
          id?: string
          invited_by_auth_user_id?: string | null
          invitee_email: string
          invitee_name?: string | null
          notes?: string | null
          organization_id: string
          revoked_at?: string | null
          revoked_by_auth_user_id?: string | null
          revoked_notes?: string | null
          selector: string
          status_code?: string
          token_hash: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          accepted_assignment_id?: string | null
          accepted_at?: string | null
          accepted_by_auth_user_id?: string | null
          challenge_response_hash?: string | null
          council_id?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string
          id?: string
          invited_by_auth_user_id?: string | null
          invitee_email?: string
          invitee_name?: string | null
          notes?: string | null
          organization_id?: string
          revoked_at?: string | null
          revoked_by_auth_user_id?: string | null
          revoked_notes?: string | null
          selector?: string
          status_code?: string
          token_hash?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_admin_invitations_accepted_assignment_id_fkey"
            columns: ["accepted_assignment_id"]
            isOneToOne: false
            referencedRelation: "organization_admin_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admin_invitations_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admin_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_claim_requests: {
        Row: {
          approved_assignment_id: string | null
          claimant_official_name: string | null
          claimant_preferred_name: string | null
          council_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          initiated_via_code: string
          organization_id: string | null
          request_notes: string | null
          requested_at: string
          requested_by_auth_user_id: string | null
          requested_by_person_id: string | null
          requested_city: string | null
          requested_council_name: string | null
          requested_council_number: string | null
          requester_email: string | null
          requester_name: string | null
          requester_notice_dismissed_at: string | null
          requester_notice_dismissed_by_auth_user_id: string | null
          requester_phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_auth_user_id: string | null
          status_code: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          approved_assignment_id?: string | null
          claimant_official_name?: string | null
          claimant_preferred_name?: string | null
          council_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          initiated_via_code?: string
          organization_id?: string | null
          request_notes?: string | null
          requested_at?: string
          requested_by_auth_user_id?: string | null
          requested_by_person_id?: string | null
          requested_city?: string | null
          requested_council_name?: string | null
          requested_council_number?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_notice_dismissed_at?: string | null
          requester_notice_dismissed_by_auth_user_id?: string | null
          requester_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          status_code?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          approved_assignment_id?: string | null
          claimant_official_name?: string | null
          claimant_preferred_name?: string | null
          council_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          initiated_via_code?: string
          organization_id?: string | null
          request_notes?: string | null
          requested_at?: string
          requested_by_auth_user_id?: string | null
          requested_by_person_id?: string | null
          requested_city?: string | null
          requested_council_name?: string | null
          requested_council_number?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_notice_dismissed_at?: string | null
          requester_notice_dismissed_by_auth_user_id?: string | null
          requester_phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          status_code?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_claim_requests_approved_assignment_id_fkey"
            columns: ["approved_assignment_id"]
            isOneToOne: false
            referencedRelation: "organization_admin_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_claim_requests_claimant_person_id_fkey"
            columns: ["requested_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_claim_requests_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_claim_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_families: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by_auth_user_id: string | null
          display_name: string
          id: string
          legacy_organization_id: string | null
          terminology_json: Json
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name: string
          id?: string
          legacy_organization_id?: string | null
          terminology_json?: Json
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string
          id?: string
          legacy_organization_id?: string | null
          terminology_json?: Json
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_families_legacy_organization_id_fkey"
            columns: ["legacy_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_type_code: string | null
          organization_type_code: string
          preferred_name: string | null
          primary_color_hex: string | null
          public_contact_form_enabled: boolean
          public_description: string | null
          public_page_enabled: boolean
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
          org_type_code?: string | null
          organization_type_code: string
          preferred_name?: string | null
          primary_color_hex?: string | null
          public_contact_form_enabled?: boolean
          public_description?: string | null
          public_page_enabled?: boolean
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
          org_type_code?: string | null
          organization_type_code?: string
          preferred_name?: string | null
          primary_color_hex?: string | null
          public_contact_form_enabled?: boolean
          public_description?: string | null
          public_page_enabled?: boolean
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
          council_id: string | null
          id: string
          new_values: Json
          old_values: Json
          person_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_auth_user_id?: string | null
          changed_fields?: Json
          council_id?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          person_id: string
        }
        Update: {
          changed_at?: string
          changed_by_auth_user_id?: string | null
          changed_fields?: Json
          council_id?: string | null
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
      person_identities: {
        Row: {
          created_at: string
          created_by_auth_user_id: string | null
          display_name: string | null
          id: string
          normalized_email_hash: string | null
          normalized_phone_hash: string | null
          primary_user_id: string | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string | null
          id?: string
          normalized_email_hash?: string | null
          normalized_phone_hash?: string | null
          primary_user_id?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_auth_user_id?: string | null
          display_name?: string | null
          id?: string
          normalized_email_hash?: string | null
          normalized_phone_hash?: string | null
          primary_user_id?: string | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_identities_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      person_identity_links: {
        Row: {
          confidence_code: string
          created_at: string
          created_by_auth_user_id: string | null
          ended_at: string | null
          id: string
          link_source: string
          linked_at: string
          notes: string | null
          person_id: string
          person_identity_id: string
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          confidence_code?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          link_source?: string
          linked_at?: string
          notes?: string | null
          person_id: string
          person_identity_id: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          confidence_code?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          link_source?: string
          linked_at?: string
          notes?: string | null
          person_id?: string
          person_identity_id?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_identity_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_identity_links_person_identity_id_fkey"
            columns: ["person_identity_id"]
            isOneToOne: false
            referencedRelation: "person_identities"
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
          created_at: string
          created_by_auth_user_id: string | null
          end_reason: string | null
          ended_by_auth_user_id: string | null
          id: string
          local_unit_id: string
          manual_end_effective_date: string | null
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
          created_at?: string
          created_by_auth_user_id?: string | null
          end_reason?: string | null
          ended_by_auth_user_id?: string | null
          id?: string
          local_unit_id: string
          manual_end_effective_date?: string | null
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
          created_at?: string
          created_by_auth_user_id?: string | null
          end_reason?: string | null
          ended_by_auth_user_id?: string | null
          id?: string
          local_unit_id?: string
          manual_end_effective_date?: string | null
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
            foreignKeyName: "person_officer_terms_created_by_auth_user_id_fkey"
            columns: ["created_by_auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_officer_terms_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
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
          proposed_first_name: string | null
          proposed_home_phone: string | null
          proposed_home_phone_hash: string | null
          proposed_last_name: string | null
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
          proposed_first_name?: string | null
          proposed_home_phone?: string | null
          proposed_home_phone_hash?: string | null
          proposed_last_name?: string | null
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
          proposed_first_name?: string | null
          proposed_home_phone?: string | null
          proposed_home_phone_hash?: string | null
          proposed_last_name?: string | null
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
      public_registration_intakes: {
        Row: {
          admin_review_status: string
          consent_accepted_at: string
          consent_text: string
          consent_version: string
          created_at: string
          email: string
          email_verification_status: string
          first_name: string
          id: string
          last_name: string
          matched_at: string | null
          matched_person_id: string | null
          metadata: Json
          normalized_email: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          admin_review_status?: string
          consent_accepted_at?: string
          consent_text: string
          consent_version: string
          created_at?: string
          email: string
          email_verification_status?: string
          first_name: string
          id?: string
          last_name: string
          matched_at?: string | null
          matched_person_id?: string | null
          metadata?: Json
          normalized_email: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          admin_review_status?: string
          consent_accepted_at?: string
          consent_text?: string
          consent_version?: string
          created_at?: string
          email?: string
          email_verification_status?: string
          first_name?: string
          id?: string
          last_name?: string
          matched_at?: string | null
          matched_person_id?: string | null
          metadata?: Json
          normalized_email?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_registration_intakes_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_access_grants: {
        Row: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          created_at: string
          created_by_auth_user_id: string | null
          expires_at: string | null
          granted_at: string
          id: string
          local_unit_id: string
          member_record_id: string
          resource_key: string
          resource_type: Database["public"]["Enums"]["resource_type_code"]
          revoked_at: string | null
          source_code: Database["public"]["Enums"]["grant_source_code"]
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          local_unit_id: string
          member_record_id: string
          resource_key: string
          resource_type: Database["public"]["Enums"]["resource_type_code"]
          revoked_at?: string | null
          source_code?: Database["public"]["Enums"]["grant_source_code"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["area_access_level"]
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          local_unit_id?: string
          member_record_id?: string
          resource_key?: string
          resource_type?: Database["public"]["Enums"]["resource_type_code"]
          revoked_at?: string | null
          source_code?: Database["public"]["Enums"]["grant_source_code"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_access_grants_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_access_grants_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          active_override: boolean | null
          created_at: string
          created_by_auth_user_id: string | null
          end_year: number | null
          id: string
          local_role_definition_id: string
          member_record_id: string
          start_year: number | null
          updated_at: string
          updated_by_auth_user_id: string | null
        }
        Insert: {
          active_override?: boolean | null
          created_at?: string
          created_by_auth_user_id?: string | null
          end_year?: number | null
          id?: string
          local_role_definition_id: string
          member_record_id: string
          start_year?: number | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Update: {
          active_override?: boolean | null
          created_at?: string
          created_by_auth_user_id?: string | null
          end_year?: number | null
          id?: string
          local_role_definition_id?: string
          member_record_id?: string
          start_year?: number | null
          updated_at?: string
          updated_by_auth_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_local_role_definition_id_fkey"
            columns: ["local_role_definition_id"]
            isOneToOne: false
            referencedRelation: "local_role_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
            referencedColumns: ["id"]
          },
        ]
      }
      saint_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          saint_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          saint_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          saint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saint_aliases_saint_id_fkey"
            columns: ["saint_id"]
            isOneToOne: false
            referencedRelation: "saints"
            referencedColumns: ["id"]
          },
        ]
      }
      saint_topics: {
        Row: {
          created_at: string
          notes: string | null
          relevance_score: number | null
          saint_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          notes?: string | null
          relevance_score?: number | null
          saint_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          notes?: string | null
          relevance_score?: number | null
          saint_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saint_topics_saint_id_fkey"
            columns: ["saint_id"]
            isOneToOne: false
            referencedRelation: "saints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saint_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "spiritual_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      saints: {
        Row: {
          canonical_name: string
          canonization_status: string | null
          common_name: string | null
          created_at: string
          era_label: string | null
          feast_day: number | null
          feast_month: number | null
          id: string
          is_active: boolean
          patron_summary: string | null
          short_bio: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          canonization_status?: string | null
          common_name?: string | null
          created_at?: string
          era_label?: string | null
          feast_day?: number | null
          feast_month?: number | null
          id?: string
          is_active?: boolean
          patron_summary?: string | null
          short_bio?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          canonization_status?: string | null
          common_name?: string | null
          created_at?: string
          era_label?: string | null
          feast_day?: number | null
          feast_month?: number | null
          id?: string
          is_active?: boolean
          patron_summary?: string | null
          short_bio?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      scripture_passages: {
        Row: {
          book: string
          chapter_end: number | null
          chapter_start: number | null
          created_at: string
          id: string
          is_active: boolean
          reference_label: string
          slug: string
          summary: string | null
          text_excerpt: string | null
          translation_code: string | null
          updated_at: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book: string
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          reference_label: string
          slug: string
          summary?: string | null
          text_excerpt?: string | null
          translation_code?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book?: string
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          reference_label?: string
          slug?: string
          summary?: string | null
          text_excerpt?: string | null
          translation_code?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: []
      }
      scripture_topics: {
        Row: {
          created_at: string
          relevance_score: number | null
          scripture_passage_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          relevance_score?: number | null
          scripture_passage_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          relevance_score?: number | null
          scripture_passage_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripture_topics_scripture_passage_id_fkey"
            columns: ["scripture_passage_id"]
            isOneToOne: false
            referencedRelation: "scripture_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripture_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "spiritual_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_content_items: {
        Row: {
          authority_level: string | null
          body_html: string | null
          body_markdown: string | null
          content_kind: Database["public"]["Enums"]["spiritual_content_kind"]
          created_at: string
          id: string
          is_active: boolean
          is_published: boolean
          language_code: string
          prayer_type: Database["public"]["Enums"]["prayer_type_code"] | null
          published_at: string | null
          record_type: string
          slug: string
          sort_order: number
          source_label: string | null
          source_url: string | null
          summary: string | null
          territory_code: string | null
          text_status: Database["public"]["Enums"]["spiritual_text_status_code"]
          title: string
          updated_at: string
        }
        Insert: {
          authority_level?: string | null
          body_html?: string | null
          body_markdown?: string | null
          content_kind: Database["public"]["Enums"]["spiritual_content_kind"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          language_code?: string
          prayer_type?: Database["public"]["Enums"]["prayer_type_code"] | null
          published_at?: string | null
          record_type?: string
          slug: string
          sort_order?: number
          source_label?: string | null
          source_url?: string | null
          summary?: string | null
          territory_code?: string | null
          text_status?: Database["public"]["Enums"]["spiritual_text_status_code"]
          title: string
          updated_at?: string
        }
        Update: {
          authority_level?: string | null
          body_html?: string | null
          body_markdown?: string | null
          content_kind?: Database["public"]["Enums"]["spiritual_content_kind"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          language_code?: string
          prayer_type?: Database["public"]["Enums"]["prayer_type_code"] | null
          published_at?: string | null
          record_type?: string
          slug?: string
          sort_order?: number
          source_label?: string | null
          source_url?: string | null
          summary?: string | null
          territory_code?: string | null
          text_status?: Database["public"]["Enums"]["spiritual_text_status_code"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      spiritual_content_relationships: {
        Row: {
          child_content_item_id: string
          created_at: string
          id: string
          parent_content_item_id: string
          relationship_kind: Database["public"]["Enums"]["content_relationship_kind"]
        }
        Insert: {
          child_content_item_id: string
          created_at?: string
          id?: string
          parent_content_item_id: string
          relationship_kind: Database["public"]["Enums"]["content_relationship_kind"]
        }
        Update: {
          child_content_item_id?: string
          created_at?: string
          id?: string
          parent_content_item_id?: string
          relationship_kind?: Database["public"]["Enums"]["content_relationship_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_content_relationships_child_content_item_id_fkey"
            columns: ["child_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_content_relationships_parent_content_item_id_fkey"
            columns: ["parent_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_content_saints: {
        Row: {
          created_at: string
          relationship_kind: Database["public"]["Enums"]["content_saint_relationship_kind"]
          saint_id: string
          spiritual_content_item_id: string
        }
        Insert: {
          created_at?: string
          relationship_kind?: Database["public"]["Enums"]["content_saint_relationship_kind"]
          saint_id: string
          spiritual_content_item_id: string
        }
        Update: {
          created_at?: string
          relationship_kind?: Database["public"]["Enums"]["content_saint_relationship_kind"]
          saint_id?: string
          spiritual_content_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_content_saints_saint_id_fkey"
            columns: ["saint_id"]
            isOneToOne: false
            referencedRelation: "saints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_content_saints_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_content_scopes: {
        Row: {
          created_at: string
          id: string
          local_unit_id: string | null
          organization_family_id: string | null
          scope_kind: Database["public"]["Enums"]["spiritual_scope_kind"]
          spiritual_content_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_unit_id?: string | null
          organization_family_id?: string | null
          scope_kind: Database["public"]["Enums"]["spiritual_scope_kind"]
          spiritual_content_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          local_unit_id?: string | null
          organization_family_id?: string | null
          scope_kind?: Database["public"]["Enums"]["spiritual_scope_kind"]
          spiritual_content_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_content_scopes_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_content_scopes_organization_family_id_fkey"
            columns: ["organization_family_id"]
            isOneToOne: false
            referencedRelation: "organization_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_content_scopes_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_content_topics: {
        Row: {
          created_at: string
          relevance_score: number | null
          spiritual_content_item_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          relevance_score?: number | null
          spiritual_content_item_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          relevance_score?: number | null
          spiritual_content_item_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_content_topics_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiritual_content_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "spiritual_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_topic_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_topic_aliases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "spiritual_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          topic_group: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          topic_group?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          topic_group?: string | null
          updated_at?: string
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
      user_saved_saints: {
        Row: {
          id: string
          saint_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          saint_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          saint_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_saints_saint_id_fkey"
            columns: ["saint_id"]
            isOneToOne: false
            referencedRelation: "saints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_saints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_spiritual_items: {
        Row: {
          id: string
          saved_at: string
          spiritual_content_item_id: string
          user_id: string
        }
        Insert: {
          id?: string
          saved_at?: string
          spiritual_content_item_id: string
          user_id: string
        }
        Update: {
          id?: string
          saved_at?: string
          spiritual_content_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_spiritual_items_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_spiritual_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_spiritual_activity: {
        Row: {
          activity_code: string
          created_at: string
          daily_reading_entry_id: string | null
          id: string
          payload_json: Json
          spiritual_content_item_id: string | null
          user_id: string
        }
        Insert: {
          activity_code: string
          created_at?: string
          daily_reading_entry_id?: string | null
          id?: string
          payload_json?: Json
          spiritual_content_item_id?: string | null
          user_id: string
        }
        Update: {
          activity_code?: string
          created_at?: string
          daily_reading_entry_id?: string | null
          id?: string
          payload_json?: Json
          spiritual_content_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_spiritual_activity_daily_reading_entry_id_fkey"
            columns: ["daily_reading_entry_id"]
            isOneToOne: false
            referencedRelation: "daily_reading_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_spiritual_activity_spiritual_content_item_id_fkey"
            columns: ["spiritual_content_item_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_spiritual_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unit_relationships: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by_auth_user_id: string | null
          ended_at: string | null
          id: string
          is_primary_parish: boolean
          local_unit_id: string
          member_record_id: string | null
          relationship_kind: Database["public"]["Enums"]["relationship_kind"]
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
          updated_by_auth_user_id: string | null
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          is_primary_parish?: boolean
          local_unit_id: string
          member_record_id?: string | null
          relationship_kind: Database["public"]["Enums"]["relationship_kind"]
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by_auth_user_id?: string | null
          ended_at?: string | null
          id?: string
          is_primary_parish?: boolean
          local_unit_id?: string
          member_record_id?: string | null
          relationship_kind?: Database["public"]["Enums"]["relationship_kind"]
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
          updated_by_auth_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unit_relationships_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_unit_relationships_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
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
            foreignKeyName: "event_invited_councils_invited_council_id_fkey"
            columns: ["host_council_id"]
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
            foreignKeyName: "event_invited_councils_invited_council_id_fkey"
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
          last_responded_at: string | null
          total_volunteer_count: number | null
        }
        Relationships: [
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      local_unit_volunteer_contribution_entries: {
        Row: {
          adjustment_id: string | null
          credited_on: string | null
          event_id: string | null
          event_title: string | null
          hours: number | null
          local_unit_id: string | null
          note: string | null
          person_id: string | null
          sort_at: string | null
          source_id: string | null
          source_type: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Relationships: []
      }
      local_unit_volunteer_contribution_rollups: {
        Row: {
          event_hours: number | null
          last_volunteered_on: string | null
          local_unit_id: string | null
          manual_adjustment_hours: number | null
          person_id: string | null
          total_hours: number | null
          volunteer_event_count: number | null
        }
        Relationships: []
      }
      v_effective_admin_package_access: {
        Row: {
          can_manage_admins: boolean | null
          can_manage_claims: boolean | null
          can_manage_custom_lists: boolean | null
          can_manage_events: boolean | null
          can_manage_local_unit_settings: boolean | null
          can_manage_members: boolean | null
          local_unit_id: string | null
          local_unit_name: string | null
          person_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_effective_area_access: {
        Row: {
          access_level: Database["public"]["Enums"]["area_access_level"] | null
          area_access_grant_id: string | null
          area_code: Database["public"]["Enums"]["member_area_code"] | null
          expires_at: string | null
          granted_at: string | null
          is_effective: boolean | null
          local_unit_id: string | null
          local_unit_name: string | null
          member_record_id: string | null
          person_id: string | null
          revoked_at: string | null
          source_code: Database["public"]["Enums"]["grant_source_code"] | null
          user_id: string | null
        }
        Relationships: []
      }
      v_effective_event_management_access: {
        Row: {
          event_id: string | null
          is_effective: boolean | null
          local_unit_id: string | null
          local_unit_name: string | null
          member_record_id: string | null
          person_id: string | null
          role_code: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_effective_resource_access: {
        Row: {
          access_level: Database["public"]["Enums"]["area_access_level"] | null
          expires_at: string | null
          granted_at: string | null
          is_effective: boolean | null
          local_unit_id: string | null
          local_unit_name: string | null
          member_record_id: string | null
          person_id: string | null
          resource_access_grant_id: string | null
          resource_key: string | null
          resource_type:
            | Database["public"]["Enums"]["resource_type_code"]
            | null
          revoked_at: string | null
          source_code: Database["public"]["Enums"]["grant_source_code"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_records_legacy_people_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_access_grants_local_unit_id_fkey"
            columns: ["local_unit_id"]
            isOneToOne: false
            referencedRelation: "local_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_access_grants_member_record_id_fkey"
            columns: ["member_record_id"]
            isOneToOne: false
            referencedRelation: "member_records"
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
          p_council_number?: string
          p_email?: string
          p_email_hash?: string
          p_existing_person_id?: string
          p_first_degree_date?: string
          p_first_name?: string
          p_import_mode: string
          p_last_name?: string
          p_local_unit_id: string
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
      approve_membership_claim_request_to_admin_package: {
        Args: {
          p_actor_user_id: string
          p_claim_request_id: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
          p_target_user_id: string
        }
        Returns: string
      }
      archive_local_unit_member_record:
        | {
            Args: {
              p_actor_user_id: string
              p_local_unit_id: string
              p_person_id: string
              p_reason?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_local_unit_id: string
              p_person_id: string
              p_reason?: string
            }
            Returns: string
          }
      auth_accessible_custom_lists: {
        Args: never
        Returns: {
          custom_list_id: string
          local_unit_id: string
        }[]
      }
      auth_accessible_local_units_for_area: {
        Args: {
          p_area_code: Database["public"]["Enums"]["member_area_code"]
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
        }
        Returns: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          area_code: Database["public"]["Enums"]["member_area_code"]
          local_unit_id: string
          local_unit_name: string
        }[]
      }
      auth_can_manage_person: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      auth_can_manage_person_assignments: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      auth_can_manage_person_notes: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      auth_has_area_access: {
        Args: {
          p_area_code: Database["public"]["Enums"]["member_area_code"]
          p_local_unit_id: string
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
        }
        Returns: boolean
      }
      auth_has_event_management_access:
        | { Args: { p_event_id: string }; Returns: boolean }
        | {
            Args: { p_event_id: string; p_local_unit_id: string }
            Returns: boolean
          }
      auth_has_resource_access: {
        Args: {
          p_local_unit_id: string
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
          p_resource_key: string
          p_resource_type: Database["public"]["Enums"]["resource_type_code"]
        }
        Returns: boolean
      }
      auth_manageable_event_ids: {
        Args: { p_local_unit_id?: string }
        Returns: {
          event_id: string
          local_unit_id: string
        }[]
      }
      backfill_missing_parallel_admin_packages: {
        Args: {
          p_actor_user_id: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
        }
        Returns: number
      }
      backfill_missing_parallel_custom_list_grants: {
        Args: {
          p_actor_user_id: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
        }
        Returns: number
      }
      backfill_missing_parallel_event_managers: {
        Args: { p_actor_user_id: string }
        Returns: number
      }
      cleanup_parallel_invite_package_subject: {
        Args: { p_local_unit_id: string; p_target_user_id: string }
        Returns: undefined
      }
      current_user_council_id: { Args: never; Returns: string }
      ensure_member_record_for_person_local_unit: {
        Args: { p_local_unit_id: string; p_person_id: string }
        Returns: string
      }
      ensure_parallel_member_for_user_and_local_unit: {
        Args: { p_local_unit_id: string; p_user_id: string }
        Returns: {
          member_record_id: string
          user_unit_relationship_id: string
        }[]
      }
      ensure_parallel_membership_for_org_admin_assignment: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      ensure_user_unit_relationship_for_user_member: {
        Args: {
          p_is_active?: boolean
          p_local_unit_id: string
          p_member_record_id: string
          p_user_id: string
        }
        Returns: string
      }
      generate_rsvp_token: { Args: never; Returns: string }
      grant_parallel_admin_package_to_user: {
        Args: {
          p_actor_user_id: string
          p_local_unit_id: string
          p_note?: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
          p_target_user_id: string
        }
        Returns: string
      }
      grant_parallel_custom_list_access_to_user: {
        Args: {
          p_access_level?: Database["public"]["Enums"]["area_access_level"]
          p_actor_user_id: string
          p_custom_list_id: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
          p_target_user_id: string
        }
        Returns: string
      }
      has_area_access: {
        Args: {
          p_area_code: Database["public"]["Enums"]["member_area_code"]
          p_local_unit_id: string
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
          p_user_id: string
        }
        Returns: boolean
      }
      has_event_management_access:
        | { Args: { p_event_id: string; p_user_id: string }; Returns: boolean }
        | {
            Args: {
              p_event_id: string
              p_local_unit_id: string
              p_user_id: string
            }
            Returns: boolean
          }
      has_resource_access: {
        Args: {
          p_local_unit_id: string
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
          p_resource_key: string
          p_resource_type: Database["public"]["Enums"]["resource_type_code"]
          p_user_id: string
        }
        Returns: boolean
      }
      list_accessible_custom_lists_for_user: {
        Args: { p_user_id: string }
        Returns: {
          custom_list_id: string
          local_unit_id: string
        }[]
      }
      list_accessible_local_units_for_area: {
        Args: {
          p_area_code: Database["public"]["Enums"]["member_area_code"]
          p_min_access_level: Database["public"]["Enums"]["area_access_level"]
          p_user_id: string
        }
        Returns: {
          access_level: Database["public"]["Enums"]["area_access_level"]
          area_code: Database["public"]["Enums"]["member_area_code"]
          local_unit_id: string
          local_unit_name: string
        }[]
      }
      list_manageable_event_ids_for_user:
        | {
            Args: { p_user_id: string }
            Returns: {
              event_id: string
            }[]
          }
        | {
            Args: { p_local_unit_id?: string; p_user_id: string }
            Returns: {
              event_id: string
              local_unit_id: string
            }[]
          }
      list_super_admin_preview_local_units: {
        Args: never
        Returns: {
          display_name: string
          legacy_council_id: string
          legacy_organization_id: string
          local_unit_id: string
          official_name: string
        }[]
      }
      parallel_grant_source_rank: {
        Args: { p_source: Database["public"]["Enums"]["grant_source_code"] }
        Returns: number
      }
      reject_membership_claim_request_in_parallel: {
        Args: {
          p_actor_user_id: string
          p_claim_request_id: string
          p_note?: string
        }
        Returns: string
      }
      restore_local_unit_member_record:
        | {
            Args: { p_local_unit_id: string; p_person_id: string }
            Returns: string
          }
        | {
            Args: {
              p_actor_user_id: string
              p_local_unit_id: string
              p_person_id: string
            }
            Returns: string
          }
      revoke_parallel_admin_package_from_user: {
        Args: {
          p_actor_user_id: string
          p_local_unit_id: string
          p_note?: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
          p_target_user_id: string
        }
        Returns: number
      }
      revoke_parallel_custom_list_access_from_user: {
        Args: {
          p_actor_user_id: string
          p_custom_list_id: string
          p_source_code?: Database["public"]["Enums"]["grant_source_code"]
          p_target_user_id: string
        }
        Returns: number
      }
      revoke_parallel_event_assignment_from_user: {
        Args: {
          p_actor_user_id: string
          p_event_id: string
          p_role_code?: string
          p_target_user_id: string
        }
        Returns: number
      }
      sync_organization_admin_assignment_from_council_admin_assignmen: {
        Args: { p_council_assignment_id: string }
        Returns: undefined
      }
      sync_parallel_admin_package_from_council_admin_assignment: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      sync_parallel_admin_package_from_org_admin_assignment: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      sync_parallel_area_grants_from_org_admin_assignment: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      upsert_parallel_admin_package_for_member: {
        Args: {
          p_created_at?: string
          p_is_active: boolean
          p_local_unit_id: string
          p_member_record_id: string
          p_source_code: Database["public"]["Enums"]["grant_source_code"]
          p_updated_at?: string
        }
        Returns: undefined
      }
      upsert_parallel_event_assignment_for_user: {
        Args: {
          p_actor_user_id: string
          p_event_id: string
          p_note?: string
          p_role_code?: string
          p_target_user_id: string
        }
        Returns: string
      }
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
      area_access_level: "read_only" | "edit_manage" | "manage" | "interact"
      content_relationship_kind:
        | "variant"
        | "child"
        | "related"
        | "companion"
        | "source"
      content_saint_relationship_kind: "about" | "to" | "through" | "patron"
      event_assignment_scope_code: "all_events" | "event" | "event_kind"
      grant_source_code:
        | "manual"
        | "title_default"
        | "invite_package"
        | "legacy_backfill"
        | "system"
      local_unit_kind:
        | "parish"
        | "council"
        | "conference"
        | "ministry"
        | "other"
      local_unit_status: "active" | "inactive" | "archived"
      member_area_code:
        | "members"
        | "events"
        | "custom_lists"
        | "claims"
        | "admins"
        | "local_unit_settings"
      member_record_lifecycle_state: "active" | "inactive" | "archived"
      membership_claim_status_code:
        | "pending"
        | "approved"
        | "denied"
        | "withdrawn"
        | "expired"
      prayer_type_code:
        | "traditional"
        | "litany"
        | "novena"
        | "chaplet"
        | "intercession"
        | "blessing"
        | "collect"
        | "devotion"
        | "other"
      relationship_kind: "linked_member_record" | "parish_self_claim"
      relationship_status: "active" | "inactive"
      resource_type_code: "custom_list" | "event" | "event_type" | "all_events"
      role_kind: "officer" | "service"
      spiritual_content_kind:
        | "prayer"
        | "daily_reading"
        | "reflection"
        | "saint_profile"
        | "scripture_passage"
        | "catechism_reference"
      spiritual_scope_kind: "global" | "organization_family" | "local_unit"
      spiritual_text_status_code:
        | "draft"
        | "review"
        | "approved"
        | "published"
        | "retired"
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
    Enums: {
      area_access_level: ["read_only", "edit_manage", "manage", "interact"],
      content_relationship_kind: [
        "variant",
        "child",
        "related",
        "companion",
        "source",
      ],
      content_saint_relationship_kind: ["about", "to", "through", "patron"],
      event_assignment_scope_code: ["all_events", "event", "event_kind"],
      grant_source_code: [
        "manual",
        "title_default",
        "invite_package",
        "legacy_backfill",
        "system",
      ],
      local_unit_kind: ["parish", "council", "conference", "ministry", "other"],
      local_unit_status: ["active", "inactive", "archived"],
      member_area_code: [
        "members",
        "events",
        "custom_lists",
        "claims",
        "admins",
        "local_unit_settings",
      ],
      member_record_lifecycle_state: ["active", "inactive", "archived"],
      membership_claim_status_code: [
        "pending",
        "approved",
        "denied",
        "withdrawn",
        "expired",
      ],
      prayer_type_code: [
        "traditional",
        "litany",
        "novena",
        "chaplet",
        "intercession",
        "blessing",
        "collect",
        "devotion",
        "other",
      ],
      relationship_kind: ["linked_member_record", "parish_self_claim"],
      relationship_status: ["active", "inactive"],
      resource_type_code: ["custom_list", "event", "event_type", "all_events"],
      role_kind: ["officer", "service"],
      spiritual_content_kind: [
        "prayer",
        "daily_reading",
        "reflection",
        "saint_profile",
        "scripture_passage",
        "catechism_reference",
      ],
      spiritual_scope_kind: ["global", "organization_family", "local_unit"],
      spiritual_text_status_code: [
        "draft",
        "review",
        "approved",
        "published",
        "retired",
      ],
    },
  },
} as const

