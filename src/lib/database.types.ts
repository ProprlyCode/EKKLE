/**
 * Database types.
 *
 * Hand-authored to match supabase/migrations. Once a Supabase project exists,
 * regenerate with:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 * and delete this note. Kept in the shape `supabase gen types` produces so the
 * swap is clean.
 */

type Timestamp = string;
type UUID = string;
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = 'member' | 'leadership' | 'platform_admin';
export type SequenceStatus = 'draft' | 'approved';
export type SequenceEventKind = 'started' | 'completed' | 'messaged';
export type ConversationStatus = 'active' | 'blocked';
export type SenderType = 'member' | 'recipient';
export type CheckinValue = 'yes' | 'not_yet' | 'no';
export type ResourceStatus = 'draft' | 'approved';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: UUID;
          slug: string;
          name: string;
          join_code: string;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          slug: string;
          name: string;
          join_code: string;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: UUID;
          org_id: UUID;
          auth_uid: UUID | null;
          name: string;
          role: Role;
          code_slug: string;
          short_message: string;
          active: boolean;
          email: string | null;
          active_sequence_id: UUID | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          auth_uid?: UUID | null;
          name: string;
          role?: Role;
          code_slug: string;
          short_message?: string;
          active?: boolean;
          email?: string | null;
          active_sequence_id?: UUID | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      sequences: {
        Row: {
          id: UUID;
          org_id: UUID;
          title: string;
          type: string;
          status: SequenceStatus;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          title: string;
          type?: string;
          status?: SequenceStatus;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['sequences']['Insert']>;
        Relationships: [];
      };
      sequence_screens: {
        Row: {
          id: UUID;
          sequence_id: UUID;
          sort_order: number;
          headline: string;
          body: string;
          icon: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          sequence_id: UUID;
          sort_order?: number;
          headline?: string;
          body?: string;
          icon?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['sequence_screens']['Insert']>;
        Relationships: [];
      };
      recipients: {
        Row: {
          id: UUID;
          org_id: UUID;
          first_name: string;
          email: string | null;
          session_token: string;
          auth_uid: UUID | null;
          arrival_member_id: UUID | null;
          consented_at: Timestamp | null;
          deleted_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          first_name?: string;
          email?: string | null;
          session_token: string;
          auth_uid?: UUID | null;
          arrival_member_id?: UUID | null;
          consented_at?: Timestamp | null;
          deleted_at?: Timestamp | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['recipients']['Insert']>;
        Relationships: [];
      };
      sequence_events: {
        Row: {
          id: UUID;
          org_id: UUID;
          member_id: UUID | null;
          recipient_id: UUID | null;
          session_token: string;
          sequence_id: UUID | null;
          event: SequenceEventKind;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          member_id?: UUID | null;
          recipient_id?: UUID | null;
          session_token: string;
          sequence_id?: UUID | null;
          event: SequenceEventKind;
          created_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['sequence_events']['Insert']>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: UUID;
          org_id: UUID;
          member_id: UUID;
          recipient_id: UUID;
          status: ConversationStatus;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          member_id: UUID;
          recipient_id: UUID;
          status?: ConversationStatus;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: UUID;
          conversation_id: UUID;
          sender_type: SenderType;
          body: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          conversation_id: UUID;
          sender_type: SenderType;
          body: string;
          created_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      connection_checkins: {
        Row: {
          id: UUID;
          member_id: UUID;
          recipient_id: UUID;
          connected: CheckinValue;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          member_id: UUID;
          recipient_id: UUID;
          connected: CheckinValue;
          created_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['connection_checkins']['Insert']>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: UUID;
          conversation_id: UUID;
          reporter_type: SenderType;
          reason: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          conversation_id: UUID;
          reporter_type: SenderType;
          reason?: string;
          created_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: UUID;
          org_id: UUID;
          title: string;
          blurb: string;
          body: string;
          status: ResourceStatus;
          sort_order: number;
          offers_connect: boolean;
          file_path: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          org_id: UUID;
          title?: string;
          blurb?: string;
          body?: string;
          status?: ResourceStatus;
          sort_order?: number;
          offers_connect?: boolean;
          file_path?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['resources']['Insert']>;
        Relationships: [];
      };
      tags: {
        Row: { id: UUID; org_id: UUID; name: string };
        Insert: { id?: UUID; org_id: UUID; name: string };
        Update: Partial<Database['public']['Tables']['tags']['Insert']>;
        Relationships: [];
      };
      resource_tags: {
        Row: { resource_id: UUID; tag_id: UUID };
        Insert: { resource_id: UUID; tag_id: UUID };
        Update: Partial<Database['public']['Tables']['resource_tags']['Insert']>;
        Relationships: [];
      };
      resource_progress: {
        Row: {
          id: UUID;
          recipient_id: UUID;
          resource_id: UUID;
          last_position: number;
          saved: boolean;
          updated_at: Timestamp;
        };
        Insert: {
          id?: UUID;
          recipient_id: UUID;
          resource_id: UUID;
          last_position?: number;
          saved?: boolean;
          updated_at?: Timestamp;
        };
        Update: Partial<Database['public']['Tables']['resource_progress']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      claim_membership: {
        Args: { p_join_code: string; p_name: string };
        Returns: Database['public']['Tables']['users']['Row'];
      };
      invite_member: {
        Args: { p_name: string; p_email: string };
        Returns: Database['public']['Tables']['users']['Row'];
      };
      set_member_active: {
        Args: { p_user_id: string; p_active: boolean };
        Returns: Database['public']['Tables']['users']['Row'];
      };
      get_recipient_landing: {
        Args: { p_slug: string };
        Returns: Json;
      };
      log_sequence_event: {
        Args: { p_session_token: string; p_slug: string; p_event: string };
        Returns: undefined;
      };
      start_conversation: {
        Args: {
          p_session_token: string;
          p_slug: string;
          p_first_name: string;
          p_email: string;
          p_body: string;
        };
        Returns: string;
      };
      replace_sequence_screens: {
        Args: { p_sequence_id: string; p_screens: Json };
        Returns: undefined;
      };
      set_my_active_sequence: {
        Args: { p_sequence_id: string | null };
        Returns: Database['public']['Tables']['users']['Row'];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** Convenience row aliases for the data-access layer. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
