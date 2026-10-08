export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_deletions: {
        Row: {
          anonymized: Json;
          completed_at: string | null;
          id: number;
          person_identity_id: string | null;
          profile_id: string | null;
          reason: string | null;
          requested_at: string;
          retained: Json;
          retention_until: string | null;
        };
        Insert: {
          anonymized?: Json;
          completed_at?: string | null;
          id?: never;
          person_identity_id?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          requested_at?: string;
          retained?: Json;
          retention_until?: string | null;
        };
        Update: {
          anonymized?: Json;
          completed_at?: string | null;
          id?: never;
          person_identity_id?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          requested_at?: string;
          retained?: Json;
          retention_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_deletions_person_identity_id_fkey";
            columns: ["person_identity_id"];
            isOneToOne: false;
            referencedRelation: "person_identities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_deletions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      addons: {
        Row: {
          created_at: string;
          grants: Json;
          id: string;
          name: string;
          position: number;
          price_month_cents: number;
          price_year_cents: number;
          slug: string;
          stripe_price_month_id: string | null;
          stripe_price_year_id: string | null;
          stripe_product_id: string | null;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          created_at?: string;
          grants?: Json;
          id?: string;
          name: string;
          position?: number;
          price_month_cents: number;
          price_year_cents: number;
          slug: string;
          stripe_price_month_id?: string | null;
          stripe_price_year_id?: string | null;
          stripe_product_id?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          grants?: Json;
          id?: string;
          name?: string;
          position?: number;
          price_month_cents?: number;
          price_year_cents?: number;
          slug?: string;
          stripe_price_month_id?: string | null;
          stripe_price_year_id?: string | null;
          stripe_product_id?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          description: string;
          key: string;
          public: boolean;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string;
          key: string;
          public?: boolean;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string;
          key?: string;
          public?: boolean;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          diff: Json | null;
          entity: string;
          entity_id: string | null;
          id: string;
          ip: unknown;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: string;
          ip?: unknown;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          ip?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_attempts: {
        Row: {
          created_at: string;
          id: string;
          identifier: string;
          kind: string;
          succeeded: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          identifier: string;
          kind: string;
          succeeded?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          identifier?: string;
          kind?: string;
          succeeded?: boolean;
        };
        Relationships: [];
      };
      contract_shares: {
        Row: {
          access_code_hash: string | null;
          contract_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          permission: Database["public"]["Enums"]["share_permission"];
          revoked_at: string | null;
          shared_by: string;
          shared_with_profile_id: string | null;
          token: string | null;
          updated_at: string;
          version_id: string | null;
        };
        Insert: {
          access_code_hash?: string | null;
          contract_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          permission?: Database["public"]["Enums"]["share_permission"];
          revoked_at?: string | null;
          shared_by: string;
          shared_with_profile_id?: string | null;
          token?: string | null;
          updated_at?: string;
          version_id?: string | null;
        };
        Update: {
          access_code_hash?: string | null;
          contract_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          permission?: Database["public"]["Enums"]["share_permission"];
          revoked_at?: string | null;
          shared_by?: string;
          shared_with_profile_id?: string | null;
          token?: string | null;
          updated_at?: string;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contract_shares_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_shares_shared_by_fkey";
            columns: ["shared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_shares_shared_with_profile_id_fkey";
            columns: ["shared_with_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_shares_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "contract_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_templates: {
        Row: {
          body: Json;
          created_at: string;
          created_by: string | null;
          family_id: string;
          id: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          name: string;
          status: Database["public"]["Enums"]["contract_template_status"];
          updated_at: string;
          variables: string[];
          version: number;
        };
        Insert: {
          body?: Json;
          created_at?: string;
          created_by?: string | null;
          family_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          name: string;
          status?: Database["public"]["Enums"]["contract_template_status"];
          updated_at?: string;
          variables?: string[];
          version?: number;
        };
        Update: {
          body?: Json;
          created_at?: string;
          created_by?: string | null;
          family_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["contract_kind"];
          name?: string;
          status?: Database["public"]["Enums"]["contract_template_status"];
          updated_at?: string;
          variables?: string[];
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_versions: {
        Row: {
          body: Json;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          frozen: boolean;
          id: string;
          note: string | null;
          status_at_save: Database["public"]["Enums"]["contract_status"];
          values: Json;
          version: number;
        };
        Insert: {
          body: Json;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          frozen?: boolean;
          id?: string;
          note?: string | null;
          status_at_save: Database["public"]["Enums"]["contract_status"];
          values?: Json;
          version: number;
        };
        Update: {
          body?: Json;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          frozen?: boolean;
          id?: string;
          note?: string | null;
          status_at_save?: Database["public"]["Enums"]["contract_status"];
          values?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          body: Json;
          completed_at: string | null;
          counterparty_name: string;
          counterparty_profile_id: string | null;
          created_at: string;
          current_version: number;
          id: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          owner_id: string;
          property_id: string | null;
          shared_at: string | null;
          status: Database["public"]["Enums"]["contract_status"];
          template_id: string | null;
          template_version: number | null;
          title: string;
          updated_at: string;
          values: Json;
        };
        Insert: {
          body?: Json;
          completed_at?: string | null;
          counterparty_name?: string;
          counterparty_profile_id?: string | null;
          created_at?: string;
          current_version?: number;
          id?: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          owner_id: string;
          property_id?: string | null;
          shared_at?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          template_id?: string | null;
          template_version?: number | null;
          title: string;
          updated_at?: string;
          values?: Json;
        };
        Update: {
          body?: Json;
          completed_at?: string | null;
          counterparty_name?: string;
          counterparty_profile_id?: string | null;
          created_at?: string;
          current_version?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["contract_kind"];
          owner_id?: string;
          property_id?: string | null;
          shared_at?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          template_id?: string | null;
          template_version?: number | null;
          title?: string;
          updated_at?: string;
          values?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_counterparty_profile_id_fkey";
            columns: ["counterparty_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          last_message_at: string | null;
          owner_id: string;
          property_id: string;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          owner_id: string;
          property_id: string;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          owner_id?: string;
          property_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      document_access_log: {
        Row: {
          action: Database["public"]["Enums"]["document_action"];
          actor_profile_id: string | null;
          bytes_sent: number | null;
          id: number;
          ip: unknown;
          occurred_at: string;
          share_id: string | null;
          subject_id: string;
          subject_type: Database["public"]["Enums"]["document_subject"];
          user_agent: string | null;
          version_id: string | null;
        };
        Insert: {
          action: Database["public"]["Enums"]["document_action"];
          actor_profile_id?: string | null;
          bytes_sent?: number | null;
          id?: never;
          ip?: unknown;
          occurred_at?: string;
          share_id?: string | null;
          subject_id: string;
          subject_type: Database["public"]["Enums"]["document_subject"];
          user_agent?: string | null;
          version_id?: string | null;
        };
        Update: {
          action?: Database["public"]["Enums"]["document_action"];
          actor_profile_id?: string | null;
          bytes_sent?: number | null;
          id?: never;
          ip?: unknown;
          occurred_at?: string;
          share_id?: string | null;
          subject_id?: string;
          subject_type?: Database["public"]["Enums"]["document_subject"];
          user_agent?: string | null;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_access_log_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          description?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      file_shares: {
        Row: {
          access_code_hash: string | null;
          created_at: string;
          expires_at: string | null;
          file_id: string;
          id: string;
          permission: Database["public"]["Enums"]["share_permission"];
          revoked_at: string | null;
          shared_by: string;
          shared_with: string | null;
          token: string | null;
          updated_at: string;
        };
        Insert: {
          access_code_hash?: string | null;
          created_at?: string;
          expires_at?: string | null;
          file_id: string;
          id?: string;
          permission?: Database["public"]["Enums"]["share_permission"];
          revoked_at?: string | null;
          shared_by: string;
          shared_with?: string | null;
          token?: string | null;
          updated_at?: string;
        };
        Update: {
          access_code_hash?: string | null;
          created_at?: string;
          expires_at?: string | null;
          file_id?: string;
          id?: string;
          permission?: Database["public"]["Enums"]["share_permission"];
          revoked_at?: string | null;
          shared_by?: string;
          shared_with?: string | null;
          token?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_shares_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_shares_shared_by_fkey";
            columns: ["shared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_shares_shared_with_fkey";
            columns: ["shared_with"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      file_versions: {
        Row: {
          bucket: string;
          checksum: string;
          created_at: string;
          created_by: string | null;
          file_id: string;
          id: string;
          mime: string;
          name: string;
          note: string | null;
          size: number;
          storage_path: string;
          version: number;
        };
        Insert: {
          bucket?: string;
          checksum: string;
          created_at?: string;
          created_by?: string | null;
          file_id: string;
          id?: string;
          mime: string;
          name: string;
          note?: string | null;
          size: number;
          storage_path: string;
          version: number;
        };
        Update: {
          bucket?: string;
          checksum?: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string;
          id?: string;
          mime?: string;
          name?: string;
          note?: string | null;
          size?: number;
          storage_path?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "file_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_versions_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          bucket: string;
          checksum: string;
          created_at: string;
          current_version: number;
          deleted_at: string | null;
          folder_id: string | null;
          id: string;
          kind: string;
          mime: string;
          name: string;
          owner_id: string;
          property_id: string | null;
          purge_after: string | null;
          scope: Database["public"]["Enums"]["cloud_scope"];
          size: number;
          source: Database["public"]["Enums"]["file_source"];
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          bucket?: string;
          checksum: string;
          created_at?: string;
          current_version?: number;
          deleted_at?: string | null;
          folder_id?: string | null;
          id?: string;
          kind?: string;
          mime: string;
          name: string;
          owner_id: string;
          property_id?: string | null;
          purge_after?: string | null;
          scope?: Database["public"]["Enums"]["cloud_scope"];
          size: number;
          source?: Database["public"]["Enums"]["file_source"];
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          bucket?: string;
          checksum?: string;
          created_at?: string;
          current_version?: number;
          deleted_at?: string | null;
          folder_id?: string | null;
          id?: string;
          kind?: string;
          mime?: string;
          name?: string;
          owner_id?: string;
          property_id?: string | null;
          purge_after?: string | null;
          scope?: Database["public"]["Enums"]["cloud_scope"];
          size?: number;
          source?: Database["public"]["Enums"]["file_source"];
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["folder_kind"];
          name: string;
          owner_id: string;
          parent_id: string | null;
          property_id: string | null;
          scope: Database["public"]["Enums"]["cloud_scope"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["folder_kind"];
          name: string;
          owner_id: string;
          parent_id?: string | null;
          property_id?: string | null;
          scope?: Database["public"]["Enums"]["cloud_scope"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["folder_kind"];
          name?: string;
          owner_id?: string;
          parent_id?: string | null;
          property_id?: string | null;
          scope?: Database["public"]["Enums"]["cloud_scope"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      identity_secrets: {
        Row: {
          created_at: string;
          key: string;
          secret: string;
        };
        Insert: {
          created_at?: string;
          key: string;
          secret: string;
        };
        Update: {
          created_at?: string;
          key?: string;
          secret?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          created_at: string;
          currency: string;
          hosted_url: string | null;
          id: string;
          issued_at: string | null;
          number: string | null;
          pdf_url: string | null;
          profile_id: string;
          saved_file_id: string | null;
          status: string;
          stripe_invoice_id: string;
          subscription_id: string | null;
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          hosted_url?: string | null;
          id?: string;
          issued_at?: string | null;
          number?: string | null;
          pdf_url?: string | null;
          profile_id: string;
          saved_file_id?: string | null;
          status: string;
          stripe_invoice_id: string;
          subscription_id?: string | null;
          total_cents: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          hosted_url?: string | null;
          id?: string;
          issued_at?: string | null;
          number?: string | null;
          pdf_url?: string | null;
          profile_id?: string;
          saved_file_id?: string | null;
          status?: string;
          stripe_invoice_id?: string;
          subscription_id?: string | null;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_saved_file_id_fkey";
            columns: ["saved_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          body_md: string;
          content_hash: string;
          created_at: string;
          created_by: string | null;
          effective_from: string | null;
          id: string;
          kind: Database["public"]["Enums"]["legal_document_kind"];
          locale: string;
          published_at: string | null;
          review_state: Database["public"]["Enums"]["legal_review_state"];
          status: string;
          title: string;
          updated_at: string;
          version: string;
        };
        Insert: {
          body_md: string;
          content_hash?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["legal_document_kind"];
          locale: string;
          published_at?: string | null;
          review_state?: Database["public"]["Enums"]["legal_review_state"];
          status?: string;
          title: string;
          updated_at?: string;
          version: string;
        };
        Update: {
          body_md?: string;
          content_hash?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["legal_document_kind"];
          locale?: string;
          published_at?: string | null;
          review_state?: Database["public"]["Enums"]["legal_review_state"];
          status?: string;
          title?: string;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "legal_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachments: Json;
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          attachments?: Json;
          body?: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          attachments?: Json;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          group_key: string | null;
          id: string;
          last_error: string | null;
          notification_id: string | null;
          payload: Json;
          profile_id: string;
          recipient: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["delivery_status"];
          template: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string;
          group_key?: string | null;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          payload?: Json;
          profile_id: string;
          recipient: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          template: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          group_key?: string | null;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          payload?: Json;
          profile_id?: string;
          recipient?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          template?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          link: string | null;
          profile_id: string;
          read_at: string | null;
          title: string;
          type: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          profile_id: string;
          read_at?: string | null;
          title: string;
          type: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          profile_id?: string;
          read_at?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      offer_redemptions: {
        Row: {
          granted_at: string;
          id: number;
          metadata: Json;
          offer_kind: string;
          person_identity_id: string;
          subscription_id: string | null;
        };
        Insert: {
          granted_at?: string;
          id?: never;
          metadata?: Json;
          offer_kind: string;
          person_identity_id: string;
          subscription_id?: string | null;
        };
        Update: {
          granted_at?: string;
          id?: never;
          metadata?: Json;
          offer_kind?: string;
          person_identity_id?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "offer_redemptions_person_identity_id_fkey";
            columns: ["person_identity_id"];
            isOneToOne: false;
            referencedRelation: "person_identities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offer_redemptions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      owner_leads: {
        Row: {
          contact_profile_id: string;
          created_at: string;
          id: string;
          last_activity_at: string;
          offer_cents: number | null;
          outcome: Database["public"]["Enums"]["lead_outcome"] | null;
          owner_id: string;
          property_id: string;
          source: string;
          stage: Database["public"]["Enums"]["lead_stage"];
          updated_at: string;
        };
        Insert: {
          contact_profile_id: string;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          offer_cents?: number | null;
          outcome?: Database["public"]["Enums"]["lead_outcome"] | null;
          owner_id: string;
          property_id: string;
          source: string;
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
        };
        Update: {
          contact_profile_id?: string;
          created_at?: string;
          id?: string;
          last_activity_at?: string;
          offer_cents?: number | null;
          outcome?: Database["public"]["Enums"]["lead_outcome"] | null;
          owner_id?: string;
          property_id?: string;
          source?: string;
          stage?: Database["public"]["Enums"]["lead_stage"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "owner_leads_contact_profile_id_fkey";
            columns: ["contact_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_leads_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_leads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_leads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      person_identities: {
        Row: {
          created_at: string;
          email_hash: string | null;
          first_seen_at: string;
          id: string;
          last_account_deleted_at: string | null;
          last_seen_at: string;
          phone_hash: string | null;
          retention_until: string | null;
          tax_id_hash: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email_hash?: string | null;
          first_seen_at?: string;
          id?: string;
          last_account_deleted_at?: string | null;
          last_seen_at?: string;
          phone_hash?: string | null;
          retention_until?: string | null;
          tax_id_hash: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email_hash?: string | null;
          first_seen_at?: string;
          id?: string;
          last_account_deleted_at?: string | null;
          last_seen_at?: string;
          phone_hash?: string | null;
          retention_until?: string | null;
          tax_id_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_data_access_log: {
        Row: {
          action: string;
          actor_profile_id: string;
          id: number;
          occurred_at: string;
          subject_id: string;
          subject_type: string;
        };
        Insert: {
          action: string;
          actor_profile_id: string;
          id?: never;
          occurred_at?: string;
          subject_id: string;
          subject_type: string;
        };
        Update: {
          action?: string;
          actor_profile_id?: string;
          id?: never;
          occurred_at?: string;
          subject_id?: string;
          subject_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personal_data_access_log_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          audience: Database["public"]["Enums"]["plan_audience"];
          created_at: string;
          default_commitment_months: number | null;
          features: string[];
          id: string;
          limits: Json | null;
          name: string;
          position: number;
          price_month_cents: number;
          price_year_cents: number;
          slug: string;
          stripe_price_month_id: string | null;
          stripe_price_year_id: string | null;
          stripe_product_id: string | null;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          audience: Database["public"]["Enums"]["plan_audience"];
          created_at?: string;
          default_commitment_months?: number | null;
          features?: string[];
          id?: string;
          limits?: Json | null;
          name: string;
          position?: number;
          price_month_cents: number;
          price_year_cents: number;
          slug: string;
          stripe_price_month_id?: string | null;
          stripe_price_year_id?: string | null;
          stripe_product_id?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          audience?: Database["public"]["Enums"]["plan_audience"];
          created_at?: string;
          default_commitment_months?: number | null;
          features?: string[];
          id?: string;
          limits?: Json | null;
          name?: string;
          position?: number;
          price_month_cents?: number;
          price_year_cents?: number;
          slug?: string;
          stripe_price_month_id?: string | null;
          stripe_price_year_id?: string | null;
          stripe_product_id?: string | null;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string;
          id: string;
          locale: string;
          notification_prefs: Json;
          person_identity_id: string | null;
          phone: string | null;
          plan_id: string | null;
          preferences: Json;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id: string | null;
          tax_id: string | null;
          tax_id_set_at: string | null;
          theme: string;
          updated_at: string;
          verification_grace_until: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          locale?: string;
          notification_prefs?: Json;
          person_identity_id?: string | null;
          phone?: string | null;
          plan_id?: string | null;
          preferences?: Json;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id?: string | null;
          tax_id?: string | null;
          tax_id_set_at?: string | null;
          theme?: string;
          updated_at?: string;
          verification_grace_until?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          locale?: string;
          notification_prefs?: Json;
          person_identity_id?: string | null;
          phone?: string | null;
          plan_id?: string | null;
          preferences?: Json;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id?: string | null;
          tax_id?: string | null;
          tax_id_set_at?: string | null;
          theme?: string;
          updated_at?: string;
          verification_grace_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_person_identity_id_fkey";
            columns: ["person_identity_id"];
            isOneToOne: false;
            referencedRelation: "person_identities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      properties: {
        Row: {
          accepts_offers: boolean;
          address_line: string | null;
          amenities: string[];
          approx_radius_m: number;
          bathrooms: number | null;
          bedrooms: number | null;
          city: string | null;
          condition: string;
          condo_fee_cents: number | null;
          created_at: string;
          deal: Database["public"]["Enums"]["property_deal"];
          description: string;
          district: string | null;
          energy_cert: string | null;
          floor: string | null;
          gross_area: number | null;
          id: string;
          imi_cents: number | null;
          location: unknown;
          location_approx: unknown;
          net_area: number | null;
          owner_id: string;
          parish: string | null;
          postal_code: string | null;
          price_cents: number | null;
          property_type: string;
          published_at: string | null;
          ref: string;
          rejection_reason: string | null;
          rent_cents: number | null;
          show_exact: boolean;
          status: Database["public"]["Enums"]["property_status"];
          submitted_at: string | null;
          title: string;
          typology: string;
          updated_at: string;
          views_count: number;
          year_built: number | null;
        };
        Insert: {
          accepts_offers?: boolean;
          address_line?: string | null;
          amenities?: string[];
          approx_radius_m?: number;
          bathrooms?: number | null;
          bedrooms?: number | null;
          city?: string | null;
          condition?: string;
          condo_fee_cents?: number | null;
          created_at?: string;
          deal: Database["public"]["Enums"]["property_deal"];
          description?: string;
          district?: string | null;
          energy_cert?: string | null;
          floor?: string | null;
          gross_area?: number | null;
          id?: string;
          imi_cents?: number | null;
          location?: unknown;
          location_approx?: unknown;
          net_area?: number | null;
          owner_id: string;
          parish?: string | null;
          postal_code?: string | null;
          price_cents?: number | null;
          property_type?: string;
          published_at?: string | null;
          ref?: string;
          rejection_reason?: string | null;
          rent_cents?: number | null;
          show_exact?: boolean;
          status?: Database["public"]["Enums"]["property_status"];
          submitted_at?: string | null;
          title?: string;
          typology: string;
          updated_at?: string;
          views_count?: number;
          year_built?: number | null;
        };
        Update: {
          accepts_offers?: boolean;
          address_line?: string | null;
          amenities?: string[];
          approx_radius_m?: number;
          bathrooms?: number | null;
          bedrooms?: number | null;
          city?: string | null;
          condition?: string;
          condo_fee_cents?: number | null;
          created_at?: string;
          deal?: Database["public"]["Enums"]["property_deal"];
          description?: string;
          district?: string | null;
          energy_cert?: string | null;
          floor?: string | null;
          gross_area?: number | null;
          id?: string;
          imi_cents?: number | null;
          location?: unknown;
          location_approx?: unknown;
          net_area?: number | null;
          owner_id?: string;
          parish?: string | null;
          postal_code?: string | null;
          price_cents?: number | null;
          property_type?: string;
          published_at?: string | null;
          ref?: string;
          rejection_reason?: string | null;
          rent_cents?: number | null;
          show_exact?: boolean;
          status?: Database["public"]["Enums"]["property_status"];
          submitted_at?: string | null;
          title?: string;
          typology?: string;
          updated_at?: string;
          views_count?: number;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_address_grants: {
        Row: {
          buyer_id: string;
          granted_at: string;
          granted_by: string;
          id: string;
          property_id: string;
          revoked_at: string | null;
          source: string;
          visit_request_id: string | null;
        };
        Insert: {
          buyer_id: string;
          granted_at?: string;
          granted_by: string;
          id?: string;
          property_id: string;
          revoked_at?: string | null;
          source: string;
          visit_request_id?: string | null;
        };
        Update: {
          buyer_id?: string;
          granted_at?: string;
          granted_by?: string;
          id?: string;
          property_id?: string;
          revoked_at?: string | null;
          source?: string;
          visit_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_address_grants_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_address_grants_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_address_grants_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_address_grants_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_address_grants_visit_request_fkey";
            columns: ["visit_request_id"];
            isOneToOne: false;
            referencedRelation: "visit_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      property_documents: {
        Row: {
          created_at: string;
          file_id: string | null;
          id: string;
          kind: string;
          mime: string;
          name: string;
          property_id: string;
          size: number;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          file_id?: string | null;
          id?: string;
          kind: string;
          mime: string;
          name: string;
          property_id: string;
          size: number;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          file_id?: string | null;
          id?: string;
          kind?: string;
          mime?: string;
          name?: string;
          property_id?: string;
          size?: number;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_documents_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_documents_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_documents_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      property_media: {
        Row: {
          created_at: string;
          height: number | null;
          id: string;
          is_cover: boolean;
          kind: string;
          path: string;
          position: number;
          property_id: string;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          kind: string;
          path: string;
          position?: number;
          property_id: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          height?: number | null;
          id?: string;
          is_cover?: boolean;
          kind?: string;
          path?: string;
          position?: number;
          property_id?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_media_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      property_moderation_events: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          id: number;
          property_id: string;
          reason: string | null;
          status_from: Database["public"]["Enums"]["property_status"];
          status_to: Database["public"]["Enums"]["property_status"];
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          id?: never;
          property_id: string;
          reason?: string | null;
          status_from: Database["public"]["Enums"]["property_status"];
          status_to: Database["public"]["Enums"]["property_status"];
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          id?: never;
          property_id?: string;
          reason?: string | null;
          status_from?: Database["public"]["Enums"]["property_status"];
          status_to?: Database["public"]["Enums"]["property_status"];
        };
        Relationships: [
          {
            foreignKeyName: "property_moderation_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_moderation_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_moderation_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      property_view_events: {
        Row: {
          id: number;
          property_id: string;
          viewed_at: string;
          viewer_id: string | null;
        };
        Insert: {
          id?: never;
          property_id: string;
          viewed_at?: string;
          viewer_id?: string | null;
        };
        Update: {
          id?: never;
          property_id?: string;
          viewed_at?: string;
          viewer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_view_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_view_events_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_view_events_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_views: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          property_id: string;
          views_count: number;
        };
        Insert: {
          created_at?: string;
          day: string;
          id?: string;
          property_id: string;
          views_count?: number;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          property_id?: string;
          views_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "property_views_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_views_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_properties: {
        Row: {
          created_at: string;
          id: string;
          price_at_save_cents: number | null;
          property_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          price_at_save_cents?: number | null;
          property_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          price_at_save_cents?: number | null;
          property_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_properties_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_properties_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      search_alerts: {
        Row: {
          created_at: string;
          filters: Json;
          id: string;
          last_run_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          filters?: Json;
          id?: string;
          last_run_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          filters?: Json;
          id?: string;
          last_run_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "search_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seo_pages: {
        Row: {
          canonical: string | null;
          created_at: string;
          meta_description: string | null;
          noindex: boolean | null;
          og_description: string | null;
          og_image: string | null;
          og_image_alt: string | null;
          og_same_as_page: boolean | null;
          og_title: string | null;
          route: string;
          title_tag: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          canonical?: string | null;
          created_at?: string;
          meta_description?: string | null;
          noindex?: boolean | null;
          og_description?: string | null;
          og_image?: string | null;
          og_image_alt?: string | null;
          og_same_as_page?: boolean | null;
          og_title?: string | null;
          route: string;
          title_tag?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          canonical?: string | null;
          created_at?: string;
          meta_description?: string | null;
          noindex?: boolean | null;
          og_description?: string | null;
          og_image?: string | null;
          og_image_alt?: string | null;
          og_same_as_page?: boolean | null;
          og_title?: string | null;
          route?: string;
          title_tag?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seo_pages_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_analytics_daily: {
        Row: {
          avg_duration_s: number;
          bounces: number;
          city: string;
          conversions: number;
          created_at: string;
          date: string;
          device: string;
          id: string;
          path: string;
          site_mode: string;
          source: string;
          uniques: number;
          updated_at: string;
          visits: number;
        };
        Insert: {
          avg_duration_s?: number;
          bounces?: number;
          city?: string;
          conversions?: number;
          created_at?: string;
          date: string;
          device?: string;
          id?: string;
          path?: string;
          site_mode: string;
          source?: string;
          uniques?: number;
          updated_at?: string;
          visits?: number;
        };
        Update: {
          avg_duration_s?: number;
          bounces?: number;
          city?: string;
          conversions?: number;
          created_at?: string;
          date?: string;
          device?: string;
          id?: string;
          path?: string;
          site_mode?: string;
          source?: string;
          uniques?: number;
          updated_at?: string;
          visits?: number;
        };
        Relationships: [];
      };
      site_lead_events: {
        Row: {
          actor_id: string;
          body: string;
          created_at: string;
          id: number;
          kind: string;
          lead_id: string;
        };
        Insert: {
          actor_id: string;
          body: string;
          created_at?: string;
          id?: never;
          kind: string;
          lead_id: string;
        };
        Update: {
          actor_id?: string;
          body?: string;
          created_at?: string;
          id?: never;
          kind?: string;
          lead_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_lead_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_lead_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "site_leads";
            referencedColumns: ["id"];
          },
        ];
      };
      site_leads: {
        Row: {
          assigned_to: string | null;
          confirm_token_hash: string | null;
          confirmed_at: string | null;
          consent_at: string | null;
          consent_marketing: boolean;
          created_at: string;
          email: string;
          form: string;
          id: string;
          message: string | null;
          name: string;
          phone: string | null;
          profile_type: string;
          reason: string | null;
          source: string;
          status: string;
          updated_at: string;
          utm: Json;
        };
        Insert: {
          assigned_to?: string | null;
          confirm_token_hash?: string | null;
          confirmed_at?: string | null;
          consent_at?: string | null;
          consent_marketing?: boolean;
          created_at?: string;
          email: string;
          form: string;
          id?: string;
          message?: string | null;
          name: string;
          phone?: string | null;
          profile_type: string;
          reason?: string | null;
          source: string;
          status?: string;
          updated_at?: string;
          utm?: Json;
        };
        Update: {
          assigned_to?: string | null;
          confirm_token_hash?: string | null;
          confirmed_at?: string | null;
          consent_at?: string | null;
          consent_marketing?: boolean;
          created_at?: string;
          email?: string;
          form?: string;
          id?: string;
          message?: string | null;
          name?: string;
          phone?: string | null;
          profile_type?: string;
          reason?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          utm?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "site_leads_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_auth: {
        Row: {
          created_at: string;
          last_step_up_at: string | null;
          pin_hash: string | null;
          pin_updated_at: string | null;
          profile_id: string;
          recovery_codes_hash: string[];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          last_step_up_at?: string | null;
          pin_hash?: string | null;
          pin_updated_at?: string | null;
          profile_id: string;
          recovery_codes_hash?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          last_step_up_at?: string | null;
          pin_hash?: string | null;
          pin_updated_at?: string | null;
          profile_id?: string;
          recovery_codes_hash?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_auth_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_members: {
        Row: {
          created_at: string;
          department: Database["public"]["Enums"]["staff_department"];
          id: string;
          is_coordinator: boolean;
          phone: string | null;
          profile_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department: Database["public"]["Enums"]["staff_department"];
          id?: string;
          is_coordinator?: boolean;
          phone?: string | null;
          profile_id: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department?: Database["public"]["Enums"]["staff_department"];
          id?: string;
          is_coordinator?: boolean;
          phone?: string | null;
          profile_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          error: string | null;
          id: string;
          processed_at: string | null;
          received_at: string;
          status: string;
          type: string;
        };
        Insert: {
          error?: string | null;
          id: string;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          type: string;
        };
        Update: {
          error?: string | null;
          id?: string;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscription_addons: {
        Row: {
          addon_id: string;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          id: string;
          interval: string;
          status: string;
          stripe_subscription_item_id: string | null;
          subscription_id: string;
          updated_at: string;
        };
        Insert: {
          addon_id: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          status?: string;
          stripe_subscription_item_id?: string | null;
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          addon_id?: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          status?: string;
          stripe_subscription_item_id?: string | null;
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_addons_addon_id_fkey";
            columns: ["addon_id"];
            isOneToOne: false;
            referencedRelation: "addons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_addons_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_agreements: {
        Row: {
          addons: Json;
          celebrated_at: string;
          commitment_ends_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          interval: string;
          minimum_commitment_months: number | null;
          plan_features: string[];
          plan_id: string | null;
          plan_limits: Json | null;
          plan_name: string;
          price_cents: number;
          price_month_cents: number;
          price_year_cents: number;
          profile_id: string | null;
          provider: Json;
          reference: string;
          subscription_id: string;
          supersedes_id: string | null;
          terms_accepted_at: string | null;
          terms_accepted_ip: unknown;
          terms_content_hash: string | null;
          terms_document_id: string | null;
          terms_version: string | null;
        };
        Insert: {
          addons?: Json;
          celebrated_at?: string;
          commitment_ends_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          interval: string;
          minimum_commitment_months?: number | null;
          plan_features?: string[];
          plan_id?: string | null;
          plan_limits?: Json | null;
          plan_name: string;
          price_cents: number;
          price_month_cents: number;
          price_year_cents: number;
          profile_id?: string | null;
          provider?: Json;
          reference: string;
          subscription_id: string;
          supersedes_id?: string | null;
          terms_accepted_at?: string | null;
          terms_accepted_ip?: unknown;
          terms_content_hash?: string | null;
          terms_document_id?: string | null;
          terms_version?: string | null;
        };
        Update: {
          addons?: Json;
          celebrated_at?: string;
          commitment_ends_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          interval?: string;
          minimum_commitment_months?: number | null;
          plan_features?: string[];
          plan_id?: string | null;
          plan_limits?: Json | null;
          plan_name?: string;
          price_cents?: number;
          price_month_cents?: number;
          price_year_cents?: number;
          profile_id?: string | null;
          provider?: Json;
          reference?: string;
          subscription_id?: string;
          supersedes_id?: string | null;
          terms_accepted_at?: string | null;
          terms_accepted_ip?: unknown;
          terms_content_hash?: string | null;
          terms_document_id?: string | null;
          terms_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_agreements_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_agreements_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_agreements_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_agreements_supersedes_id_fkey";
            columns: ["supersedes_id"];
            isOneToOne: false;
            referencedRelation: "subscription_agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_agreements_terms_document_id_fkey";
            columns: ["terms_document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_events: {
        Row: {
          event: string;
          id: number;
          metadata: Json;
          occurred_at: string;
          person_identity_id: string | null;
          plan_id_from: string | null;
          plan_id_to: string | null;
          profile_id: string | null;
          reason: string | null;
          status_from: string | null;
          status_to: string | null;
          subscription_id: string;
        };
        Insert: {
          event: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          person_identity_id?: string | null;
          plan_id_from?: string | null;
          plan_id_to?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          status_from?: string | null;
          status_to?: string | null;
          subscription_id: string;
        };
        Update: {
          event?: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          person_identity_id?: string | null;
          plan_id_from?: string | null;
          plan_id_to?: string | null;
          profile_id?: string | null;
          reason?: string | null;
          status_from?: string | null;
          status_to?: string | null;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_events_person_identity_id_fkey";
            columns: ["person_identity_id"];
            isOneToOne: false;
            referencedRelation: "person_identities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_plan_id_from_fkey";
            columns: ["plan_id_from"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_plan_id_to_fkey";
            columns: ["plan_id_to"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          cancel_reason: string | null;
          cancel_requested_at: string | null;
          canceled_at: string | null;
          commitment_ends_at: string | null;
          created_at: string;
          current_period_end: string | null;
          id: string;
          interval: string;
          minimum_commitment_months: number | null;
          plan_id: string | null;
          profile_id: string;
          started_at: string | null;
          status: string;
          stripe_subscription_id: string | null;
          terms_document_id: string | null;
          terms_version: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          cancel_reason?: string | null;
          cancel_requested_at?: string | null;
          canceled_at?: string | null;
          commitment_ends_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          minimum_commitment_months?: number | null;
          plan_id?: string | null;
          profile_id: string;
          started_at?: string | null;
          status?: string;
          stripe_subscription_id?: string | null;
          terms_document_id?: string | null;
          terms_version?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancel_reason?: string | null;
          cancel_requested_at?: string | null;
          canceled_at?: string | null;
          commitment_ends_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          minimum_commitment_months?: number | null;
          plan_id?: string | null;
          profile_id?: string;
          started_at?: string | null;
          status?: string;
          stripe_subscription_id?: string | null;
          terms_document_id?: string | null;
          terms_version?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_terms_document_id_fkey";
            columns: ["terms_document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      terms_acceptances: {
        Row: {
          accepted_at: string;
          content_hash: string;
          context: string;
          document_id: string;
          document_kind: Database["public"]["Enums"]["legal_document_kind"];
          id: number;
          ip: unknown;
          person_identity_id: string | null;
          profile_id: string | null;
          user_agent: string | null;
          version: string;
        };
        Insert: {
          accepted_at?: string;
          content_hash: string;
          context: string;
          document_id: string;
          document_kind: Database["public"]["Enums"]["legal_document_kind"];
          id?: never;
          ip?: unknown;
          person_identity_id?: string | null;
          profile_id?: string | null;
          user_agent?: string | null;
          version: string;
        };
        Update: {
          accepted_at?: string;
          content_hash?: string;
          context?: string;
          document_id?: string;
          document_kind?: Database["public"]["Enums"]["legal_document_kind"];
          id?: never;
          ip?: unknown;
          person_identity_id?: string | null;
          profile_id?: string | null;
          user_agent?: string | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_acceptances_person_identity_id_fkey";
            columns: ["person_identity_id"];
            isOneToOne: false;
            referencedRelation: "person_identities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_acceptances_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_events: {
        Row: {
          actor_id: string | null;
          id: number;
          note: string | null;
          occurred_at: string;
          status_from: Database["public"]["Enums"]["ticket_status"] | null;
          status_to: Database["public"]["Enums"]["ticket_status"];
          ticket_id: string;
        };
        Insert: {
          actor_id?: string | null;
          id?: never;
          note?: string | null;
          occurred_at?: string;
          status_from?: Database["public"]["Enums"]["ticket_status"] | null;
          status_to: Database["public"]["Enums"]["ticket_status"];
          ticket_id: string;
        };
        Update: {
          actor_id?: string | null;
          id?: never;
          note?: string | null;
          occurred_at?: string;
          status_from?: Database["public"]["Enums"]["ticket_status"] | null;
          status_to?: Database["public"]["Enums"]["ticket_status"];
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          affected_users: number;
          breadcrumbs: Json | null;
          browser: string | null;
          build_sha: string | null;
          console_errors: Json | null;
          created_at: string;
          description: string;
          fingerprint: string;
          first_seen_at: string;
          fix_note: string | null;
          id: string;
          last_seen_at: string;
          network: string | null;
          occurrences: number;
          origin: Database["public"]["Enums"]["ticket_origin"];
          os: string | null;
          ref: string;
          reporter_id: string | null;
          route: string | null;
          screenshot_path: string | null;
          session_id: string | null;
          severity: Database["public"]["Enums"]["ticket_severity"];
          status: Database["public"]["Enums"]["ticket_status"];
          technical_purged_at: string | null;
          title: string;
          updated_at: string;
          viewport: string | null;
        };
        Insert: {
          affected_users?: number;
          breadcrumbs?: Json | null;
          browser?: string | null;
          build_sha?: string | null;
          console_errors?: Json | null;
          created_at?: string;
          description?: string;
          fingerprint: string;
          first_seen_at?: string;
          fix_note?: string | null;
          id?: string;
          last_seen_at?: string;
          network?: string | null;
          occurrences?: number;
          origin?: Database["public"]["Enums"]["ticket_origin"];
          os?: string | null;
          ref?: string;
          reporter_id?: string | null;
          route?: string | null;
          screenshot_path?: string | null;
          session_id?: string | null;
          severity?: Database["public"]["Enums"]["ticket_severity"];
          status?: Database["public"]["Enums"]["ticket_status"];
          technical_purged_at?: string | null;
          title: string;
          updated_at?: string;
          viewport?: string | null;
        };
        Update: {
          affected_users?: number;
          breadcrumbs?: Json | null;
          browser?: string | null;
          build_sha?: string | null;
          console_errors?: Json | null;
          created_at?: string;
          description?: string;
          fingerprint?: string;
          first_seen_at?: string;
          fix_note?: string | null;
          id?: string;
          last_seen_at?: string;
          network?: string | null;
          occurrences?: number;
          origin?: Database["public"]["Enums"]["ticket_origin"];
          os?: string | null;
          ref?: string;
          reporter_id?: string | null;
          route?: string | null;
          screenshot_path?: string | null;
          session_id?: string | null;
          severity?: Database["public"]["Enums"]["ticket_severity"];
          status?: Database["public"]["Enums"]["ticket_status"];
          technical_purged_at?: string | null;
          title?: string;
          updated_at?: string;
          viewport?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trial_extension_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          profile_id: string;
          reason: string;
          status: string;
          subscription_id: string | null;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          profile_id: string;
          reason: string;
          status?: string;
          subscription_id?: string | null;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          profile_id?: string;
          reason?: string;
          status?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trial_extension_requests_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_extension_requests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_extension_requests_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_requests: {
        Row: {
          buyer_id: string;
          cancelled_by: string | null;
          created_at: string;
          id: string;
          message: string;
          notes: string | null;
          owner_id: string;
          property_id: string;
          proposed_at: string;
          proposed_by: string | null;
          requested_at: string;
          reschedule_count: number;
          status: Database["public"]["Enums"]["visit_status"];
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          cancelled_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          notes?: string | null;
          owner_id: string;
          property_id: string;
          proposed_at: string;
          proposed_by?: string | null;
          requested_at?: string;
          reschedule_count?: number;
          status?: Database["public"]["Enums"]["visit_status"];
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          cancelled_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          notes?: string | null;
          owner_id?: string;
          property_id?: string;
          proposed_at?: string;
          proposed_by?: string | null;
          requested_at?: string;
          reschedule_count?: number;
          status?: Database["public"]["Enums"]["visit_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_requests_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_requests_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_requests_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_requests_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      properties_public: {
        Row: {
          accepts_offers: boolean | null;
          amenities: string[] | null;
          approx_radius_m: number | null;
          bathrooms: number | null;
          bedrooms: number | null;
          city: string | null;
          condition: string | null;
          condo_fee_cents: number | null;
          created_at: string | null;
          deal: Database["public"]["Enums"]["property_deal"] | null;
          description: string | null;
          district: string | null;
          energy_cert: string | null;
          floor: string | null;
          gross_area: number | null;
          id: string | null;
          imi_cents: number | null;
          location_approx: unknown;
          net_area: number | null;
          owner_id: string | null;
          parish: string | null;
          price_cents: number | null;
          property_type: string | null;
          published_at: string | null;
          ref: string | null;
          rent_cents: number | null;
          status: Database["public"]["Enums"]["property_status"] | null;
          title: string | null;
          typology: string | null;
          updated_at: string | null;
          views_count: number | null;
          year_built: number | null;
        };
        Insert: {
          accepts_offers?: boolean | null;
          amenities?: string[] | null;
          approx_radius_m?: number | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          city?: string | null;
          condition?: string | null;
          condo_fee_cents?: number | null;
          created_at?: string | null;
          deal?: Database["public"]["Enums"]["property_deal"] | null;
          description?: string | null;
          district?: string | null;
          energy_cert?: string | null;
          floor?: string | null;
          gross_area?: number | null;
          id?: string | null;
          imi_cents?: number | null;
          location_approx?: unknown;
          net_area?: number | null;
          owner_id?: string | null;
          parish?: string | null;
          price_cents?: number | null;
          property_type?: string | null;
          published_at?: string | null;
          ref?: string | null;
          rent_cents?: number | null;
          status?: Database["public"]["Enums"]["property_status"] | null;
          title?: string | null;
          typology?: string | null;
          updated_at?: string | null;
          views_count?: number | null;
          year_built?: number | null;
        };
        Update: {
          accepts_offers?: boolean | null;
          amenities?: string[] | null;
          approx_radius_m?: number | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          city?: string | null;
          condition?: string | null;
          condo_fee_cents?: number | null;
          created_at?: string | null;
          deal?: Database["public"]["Enums"]["property_deal"] | null;
          description?: string | null;
          district?: string | null;
          energy_cert?: string | null;
          floor?: string | null;
          gross_area?: number | null;
          id?: string | null;
          imi_cents?: number | null;
          location_approx?: unknown;
          net_area?: number | null;
          owner_id?: string | null;
          parish?: string | null;
          price_cents?: number | null;
          property_type?: string | null;
          published_at?: string | null;
          ref?: string | null;
          rent_cents?: number | null;
          status?: Database["public"]["Enums"]["property_status"] | null;
          title?: string | null;
          typology?: string | null;
          updated_at?: string | null;
          views_count?: number | null;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_visit_request: { Args: { p_id: string }; Returns: undefined };
      account_blocked: { Args: { p_profile_id: string }; Returns: boolean };
      account_history: {
        Args: { p_profile_id?: string };
        Returns: {
          detail: Json;
          event: string;
          occurred_at: string;
          source: string;
        }[];
      };
      admin_add_site_lead_note: {
        Args: { p_lead_id: string; p_note: string };
        Returns: undefined;
      };
      admin_app_settings: {
        Args: never;
        Returns: {
          description: string;
          key: string;
          public: boolean;
          value: Json;
        }[];
      };
      admin_billing_summary: {
        Args: never;
        Returns: {
          addon_subscribers: number;
          canceled_30d: number;
          mrr_cents: number;
          new_30d: number;
          past_due: number;
          subscribers: number;
          trials: number;
        }[];
      };
      admin_dashboard_metrics: { Args: never; Returns: Json };
      admin_export_site_leads: {
        Args: {
          p_assigned_to?: string;
          p_form?: string;
          p_search?: string;
          p_source?: string;
          p_status?: string;
        };
        Returns: {
          assigned_name: string;
          consent_at: string;
          consent_marketing: boolean;
          created_at: string;
          email: string;
          form: string;
          message: string;
          name: string;
          phone: string;
          profile_type: string;
          reason: string;
          source: string;
          status: string;
          utm: Json;
        }[];
      };
      admin_feature_flags: {
        Args: never;
        Returns: {
          description: string;
          key: string;
          value: Json;
        }[];
      };
      admin_list_moderation: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_direction?: string;
          p_limit?: number;
          p_status: Database["public"]["Enums"]["property_status"];
        };
        Returns: {
          city: string;
          cover_path: string;
          created_at: string;
          deal: Database["public"]["Enums"]["property_deal"];
          id: string;
          owner_name: string;
          price_cents: number;
          ref: string;
          rent_cents: number;
          status: Database["public"]["Enums"]["property_status"];
          title: string;
        }[];
      };
      admin_list_profiles: {
        Args: {
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_direction?: string;
          p_limit?: number;
          p_plan_id?: string;
          p_role?: Database["public"]["Enums"]["user_role"];
          p_search?: string;
          p_status?: Database["public"]["Enums"]["profile_status"];
        };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          plan_name: string;
          plan_slug: string;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          subscription_status: string;
          trial_ends_at: string;
        }[];
      };
      admin_list_site_leads: {
        Args: {
          p_assigned_to?: string;
          p_cursor_created_at?: string;
          p_cursor_id?: string;
          p_direction?: string;
          p_form?: string;
          p_limit?: number;
          p_search?: string;
          p_source?: string;
          p_status?: string;
        };
        Returns: {
          assigned_name: string;
          assigned_to: string;
          consent_marketing: boolean;
          created_at: string;
          email: string;
          form: string;
          id: string;
          name: string;
          phone: string;
          profile_type: string;
          reason: string;
          source: string;
          status: string;
        }[];
      };
      admin_moderation_counts: {
        Args: never;
        Returns: {
          status: Database["public"]["Enums"]["property_status"];
          total: number;
        }[];
      };
      admin_moderation_detail: {
        Args: { p_property_id: string };
        Returns: {
          address_line: string;
          amenities: string[];
          bathrooms: number;
          bedrooms: number;
          city: string;
          condition: string;
          condo_fee_cents: number;
          created_at: string;
          deal: Database["public"]["Enums"]["property_deal"];
          description: string;
          district: string;
          energy_cert: string;
          floor: string;
          gross_area: number;
          id: string;
          imi_cents: number;
          net_area: number;
          owner_id: string;
          owner_name: string;
          parish: string;
          postal_code: string;
          price_cents: number;
          property_type: string;
          published_at: string;
          ref: string;
          rejection_reason: string;
          rent_cents: number;
          status: Database["public"]["Enums"]["property_status"];
          title: string;
          typology: string;
          year_built: number;
        }[];
      };
      admin_plan_metrics: {
        Args: never;
        Returns: {
          audience: Database["public"]["Enums"]["plan_audience"];
          mrr_cents: number;
          name: string;
          plan_id: string;
          price_month_cents: number;
          price_year_cents: number;
          slug: string;
          subscribers: number;
          visible: boolean;
        }[];
      };
      admin_profile_detail: {
        Args: { p_profile_id: string };
        Returns: {
          created_at: string;
          current_period_end: string;
          email: string;
          full_name: string;
          id: string;
          plan_name: string;
          plan_slug: string;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          subscription_status: string;
          trial_ends_at: string;
          updated_at: string;
        }[];
      };
      admin_property_moderation_history: {
        Args: { p_property_id: string };
        Returns: {
          action: string;
          actor_name: string;
          created_at: string;
          id: number;
          reason: string;
          status_from: Database["public"]["Enums"]["property_status"];
          status_to: Database["public"]["Enums"]["property_status"];
        }[];
      };
      admin_recent_invoices: {
        Args: { p_limit?: number };
        Returns: {
          client_name: string;
          id: string;
          issued_at: string;
          number: string;
          plan_name: string;
          status: string;
          total_cents: number;
        }[];
      };
      admin_save_seo_page: {
        Args: {
          p_canonical?: string;
          p_meta_description?: string;
          p_noindex?: boolean;
          p_og_description?: string;
          p_og_image?: string;
          p_og_image_alt?: string;
          p_og_same_as_page?: boolean;
          p_og_title?: string;
          p_route: string;
          p_title_tag?: string;
        };
        Returns: undefined;
      };
      admin_set_profile_status: {
        Args: {
          p_profile_id: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["profile_status"];
        };
        Returns: Database["public"]["Enums"]["profile_status"];
      };
      admin_site_lead_detail: {
        Args: { p_lead_id: string };
        Returns: {
          assigned_name: string;
          assigned_to: string;
          consent_at: string;
          consent_marketing: boolean;
          created_at: string;
          email: string;
          form: string;
          id: string;
          message: string;
          name: string;
          phone: string;
          profile_type: string;
          reason: string;
          source: string;
          status: string;
          updated_at: string;
          utm: Json;
        }[];
      };
      admin_site_lead_history: {
        Args: { p_lead_id: string };
        Returns: {
          actor_name: string;
          body: string;
          created_at: string;
          id: number;
          kind: string;
        }[];
      };
      admin_site_lead_staff: {
        Args: never;
        Returns: {
          full_name: string;
          id: string;
        }[];
      };
      admin_site_traffic_breakdown: {
        Args: {
          p_from: string;
          p_limit?: number;
          p_site_mode?: string;
          p_to: string;
        };
        Returns: {
          dimension: string;
          label: string;
          visits: number;
        }[];
      };
      admin_site_traffic_series: {
        Args: { p_from: string; p_site_mode?: string; p_to: string };
        Returns: {
          conversions: number;
          date: string;
          visits: number;
        }[];
      };
      admin_site_traffic_summary: {
        Args: { p_from: string; p_site_mode?: string; p_to: string };
        Returns: {
          avg_duration_s: number;
          bounce_rate: number;
          conversion_rate: number;
          conversions: number;
          uniques: number;
          visits: number;
        }[];
      };
      admin_trial_requests: {
        Args: never;
        Returns: {
          client_name: string;
          created_at: string;
          decided_at: string;
          id: string;
          profile_id: string;
          reason: string;
          status: string;
          trial_ends_at: string;
        }[];
      };
      admin_update_site_lead: {
        Args: { p_assigned_to: string; p_lead_id: string; p_status: string };
        Returns: undefined;
      };
      apply_plan_downgrade: { Args: { p_profile_id: string }; Returns: number };
      archive_visit_request: { Args: { p_id: string }; Returns: undefined };
      at_limit_ratio: {
        Args: { p_limit: Json; p_used: number };
        Returns: boolean;
      };
      attach_stripe_customer: {
        Args: { p_customer_id: string };
        Returns: undefined;
      };
      available_contract_templates: {
        Args: never;
        Returns: {
          family_id: string;
          id: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          name: string;
          variables: string[];
          version: number;
        }[];
      };
      can_cancel_subscription: {
        Args: { p_subscription_id: string };
        Returns: Json;
      };
      cancel_visit_request: { Args: { p_id: string }; Returns: undefined };
      check_auth_rate_limit: {
        Args: { p_identifier: string; p_kind: string };
        Returns: Json;
      };
      check_submission_rate_limit: {
        Args: {
          p_identifier: string;
          p_kind: string;
          p_max?: number;
          p_window?: string;
        };
        Returns: boolean;
      };
      cloud_add_file_version: {
        Args: {
          p_checksum: string;
          p_file_id: string;
          p_mime: string;
          p_name: string;
          p_note?: string;
          p_size: number;
          p_storage_path: string;
        };
        Returns: number;
      };
      cloud_delete_file: { Args: { p_file_id: string }; Returns: undefined };
      cloud_empty_recycle_bin: { Args: never; Returns: number };
      cloud_limit_bytes: { Args: { p_profile_id: string }; Returns: number };
      cloud_register_upload: {
        Args: {
          p_checksum: string;
          p_folder_id: string;
          p_mime: string;
          p_name: string;
          p_property_id?: string;
          p_size: number;
          p_source?: Database["public"]["Enums"]["file_source"];
          p_storage_path: string;
        };
        Returns: string;
      };
      cloud_restore_file_version: {
        Args: { p_file_id: string; p_version: number };
        Returns: number;
      };
      cloud_status: {
        Args: never;
        Returns: {
          has_cloud: boolean;
          limit_bytes: number;
          near_plan_limit: boolean;
          used_bytes: number;
        }[];
      };
      cloud_usage_bytes: { Args: { p_profile_id: string }; Returns: number };
      commitment_months_for_plan: {
        Args: { p_plan_id: string };
        Returns: number;
      };
      complete_due_visits: { Args: never; Returns: number };
      confirm_site_lead: { Args: { p_token: string }; Returns: boolean };
      contract_history: {
        Args: { p_contract_id: string };
        Returns: {
          author_name: string;
          created_at: string;
          frozen: boolean;
          note: string;
          status_at_save: Database["public"]["Enums"]["contract_status"];
          version: number;
          version_id: string;
        }[];
      };
      contract_status_rank: {
        Args: { p_status: Database["public"]["Enums"]["contract_status"] };
        Returns: number;
      };
      contracts_shared_with_me: {
        Args: never;
        Returns: {
          body: Json;
          contract_id: string;
          expires_at: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          permission: Database["public"]["Enums"]["share_permission"];
          share_id: string;
          shared_at: string;
          shared_by_name: string;
          status: Database["public"]["Enums"]["contract_status"];
          title: string;
          values: Json;
        }[];
      };
      create_contract_from_template: {
        Args: {
          p_counterparty_name?: string;
          p_counterparty_profile_id?: string;
          p_property_id?: string;
          p_template_id: string;
          p_title: string;
        };
        Returns: string;
      };
      current_legal_document: {
        Args: {
          p_kind: Database["public"]["Enums"]["legal_document_kind"];
          p_locale?: string;
        };
        Returns: {
          body_md: string;
          content_hash: string;
          effective_from: string;
          id: string;
          kind: Database["public"]["Enums"]["legal_document_kind"];
          locale: string;
          review_state: Database["public"]["Enums"]["legal_review_state"];
          title: string;
          version: string;
        }[];
      };
      decide_trial_extension: {
        Args: { p_approve: boolean; p_id: string };
        Returns: string;
      };
      delete_own_account: { Args: { p_reason?: string }; Returns: Json };
      draft_contract_template_version: {
        Args: { p_family_id: string };
        Returns: string;
      };
      effective_limits: { Args: { p_profile_id: string }; Returns: Json };
      ensure_property_folders: {
        Args: { p_profile_id: string };
        Returns: number;
      };
      export_own_account_data: { Args: never; Returns: Json };
      file_access_log: {
        Args: { p_file_id: string };
        Returns: {
          action: Database["public"]["Enums"]["document_action"];
          actor_name: string;
          ip: unknown;
          occurred_at: string;
          via_link: boolean;
        }[];
      };
      format_eur_cents: { Args: { p_cents: number }; Returns: string };
      generate_ticket_ref: { Args: never; Returns: string };
      get_property_location: {
        Args: { p_property_id: string };
        Returns: unknown;
      };
      hash_identity: {
        Args: { p_kind: string; p_value: string };
        Returns: string;
      };
      invoice_saved_to_cloud: {
        Args: { p_file_id: string; p_invoice_id: string };
        Returns: undefined;
      };
      is_admin: { Args: never; Returns: boolean };
      is_analytics_total_row: {
        Args: {
          p_city: string;
          p_device: string;
          p_path: string;
          p_source: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: never; Returns: boolean };
      is_valid_pt_nif: { Args: { p_value: string }; Returns: boolean };
      log_document_access: {
        Args: {
          p_action: Database["public"]["Enums"]["document_action"];
          p_bytes_sent?: number;
          p_ip?: unknown;
          p_share_id?: string;
          p_subject_id: string;
          p_subject_type: Database["public"]["Enums"]["document_subject"];
          p_user_agent?: string;
          p_version_id?: string;
        };
        Returns: number;
      };
      log_invoice_access: {
        Args: {
          p_action?: Database["public"]["Enums"]["document_action"];
          p_invoice_id: string;
        };
        Returns: undefined;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      mark_step_up: { Args: { p_profile_id: string }; Returns: string };
      moderate_property: {
        Args: { p_action: string; p_property_id: string; p_reason?: string };
        Returns: Database["public"]["Enums"]["property_status"];
      };
      my_cloud_files: {
        Args: { p_folder_id?: string };
        Returns: {
          created_at: string;
          current_version: number;
          deleted_at: string;
          folder_id: string;
          has_link: boolean;
          id: string;
          kind: string;
          mime: string;
          name: string;
          readonly: boolean;
          share_count: number;
          shared_label: string;
          size: number;
          source: Database["public"]["Enums"]["file_source"];
        }[];
      };
      my_cloud_folders: {
        Args: never;
        Returns: {
          file_count: number;
          id: string;
          kind: Database["public"]["Enums"]["folder_kind"];
          name: string;
          parent_id: string;
          property_id: string;
        }[];
      };
      my_contracts: {
        Args: never;
        Returns: {
          counterparty_name: string;
          current_version: number;
          id: string;
          kind: Database["public"]["Enums"]["contract_kind"];
          property_id: string;
          property_title: string;
          share_count: number;
          shared_at: string;
          status: Database["public"]["Enums"]["contract_status"];
          title: string;
          updated_at: string;
        }[];
      };
      my_conversations: {
        Args: never;
        Returns: {
          address_shared: boolean;
          buyer_id: string;
          id: string;
          is_owner: boolean;
          last_message: string;
          last_message_at: string;
          other_id: string;
          other_name: string;
          property_id: string;
          property_location: string;
          property_title: string;
          unread: number;
        }[];
      };
      my_owner_leads: {
        Args: never;
        Returns: {
          contact_id: string;
          contact_name: string;
          conversation_id: string;
          id: string;
          last_activity_at: string;
          last_message: string;
          outcome: Database["public"]["Enums"]["lead_outcome"];
          property_id: string;
          property_location: string;
          property_title: string;
          stage: Database["public"]["Enums"]["lead_stage"];
        }[];
      };
      my_property_views_daily: {
        Args: { p_days?: number };
        Returns: {
          day: string;
          views_count: number;
        }[];
      };
      my_reports: {
        Args: never;
        Returns: {
          created_at: string;
          fix_note: string;
          id: string;
          last_seen_at: string;
          ref: string;
          severity: Database["public"]["Enums"]["ticket_severity"];
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
        }[];
      };
      my_visit_requests: {
        Args: never;
        Returns: {
          id: string;
          is_owner: boolean;
          message: string;
          other_id: string;
          other_name: string;
          property_id: string;
          property_location: string;
          property_title: string;
          proposed_at: string;
          proposed_by_me: boolean;
          reschedule_count: number;
          status: Database["public"]["Enums"]["visit_status"];
        }[];
      };
      next_agreement_reference: { Args: never; Returns: string };
      no_plan_limits: { Args: never; Returns: Json };
      normalize_email: { Args: { p_value: string }; Returns: string };
      normalize_phone: { Args: { p_value: string }; Returns: string };
      notify: {
        Args: {
          p_body?: string;
          p_group_key?: string;
          p_link?: string;
          p_profile_id: string;
          p_title: string;
          p_type: string;
        };
        Returns: string;
      };
      open_bugs_count: { Args: never; Returns: number };
      plan_limit_exceeded: {
        Args: { p_key: string; p_profile_id: string };
        Returns: boolean;
      };
      plan_limit_overage: {
        Args: { p_limits: Json; p_plan_id: string };
        Returns: {
          affected: number;
          limit_key: string;
          max_used: number;
        }[];
      };
      plan_status: {
        Args: never;
        Returns: {
          billing_interval: string;
          cancel_at_period_end: boolean;
          cloud_limit_bytes: number;
          cloud_used_bytes: number;
          commitment_ends_at: string;
          current_period_end: string;
          has_cloud_addon: boolean;
          limits: Json;
          minimum_commitment_months: number;
          plan_audience: Database["public"]["Enums"]["plan_audience"];
          plan_id: string;
          plan_name: string;
          plan_slug: string;
          started_at: string;
          subscription_id: string;
          subscription_status: string;
          terms_version: string;
          trial_ends_at: string;
          usage: Json;
        }[];
      };
      plan_usage: {
        Args: { p_key: string; p_profile_id: string };
        Returns: number;
      };
      properties_for_map: {
        Args: {
          p_max_lat?: number;
          p_max_lon?: number;
          p_min_lat?: number;
          p_min_lon?: number;
        };
        Returns: {
          deal: Database["public"]["Enums"]["property_deal"];
          id: string;
          lat: number;
          lon: number;
          price_cents: number;
          title: string;
        }[];
      };
      properties_within_polygon: {
        Args: { p_geojson: Json };
        Returns: {
          deal: Database["public"]["Enums"]["property_deal"];
          id: string;
          lat: number;
          lon: number;
          price_cents: number;
          title: string;
        }[];
      };
      property_location_point: {
        Args: { p_property_id: string };
        Returns: {
          is_exact: boolean;
          lat: number;
          lon: number;
          radius_m: number;
        }[];
      };
      publish_contract_template: {
        Args: { p_template_id: string };
        Returns: string;
      };
      purge_cloud_recycle_bin: { Args: never; Returns: number };
      purge_document_access_log: { Args: never; Returns: number };
      purge_property_view_events: { Args: never; Returns: number };
      purge_site_analytics: { Args: never; Returns: number };
      purge_ticket_technical_data: { Args: never; Returns: number };
      purge_unconfirmed_site_leads: { Args: never; Returns: number };
      record_auth_attempt: {
        Args: { p_identifier: string; p_kind: string; p_succeeded: boolean };
        Returns: undefined;
      };
      record_personal_data_access: {
        Args: {
          p_action?: string;
          p_subject_id: string;
          p_subject_type: string;
        };
        Returns: boolean;
      };
      record_property_view: {
        Args: { p_property_id: string };
        Returns: boolean;
      };
      record_subscription_agreement: {
        Args: { p_subscription_id: string };
        Returns: string;
      };
      record_terms_acceptance: {
        Args: {
          p_context: string;
          p_document_id: string;
          p_ip?: unknown;
          p_profile_id?: string;
          p_user_agent?: string;
        };
        Returns: number;
      };
      register_account_identity: {
        Args: {
          p_email: string;
          p_phone: string;
          p_profile_id: string;
          p_tax_id: string;
        };
        Returns: string;
      };
      report_problem: {
        Args: {
          p_breadcrumbs?: Json;
          p_browser?: string;
          p_build_sha?: string;
          p_console_errors?: Json;
          p_description?: string;
          p_fingerprint: string;
          p_network?: string;
          p_origin?: Database["public"]["Enums"]["ticket_origin"];
          p_os?: string;
          p_route?: string;
          p_screenshot_path?: string;
          p_session_id?: string;
          p_title: string;
          p_viewport?: string;
        };
        Returns: {
          id: string;
          merged: boolean;
          ref: string;
          severity: Database["public"]["Enums"]["ticket_severity"];
        }[];
      };
      request_subscription_cancellation: {
        Args: { p_reason?: string; p_subscription_id: string };
        Returns: Json;
      };
      request_trial_extension: { Args: { p_reason: string }; Returns: string };
      request_visit: {
        Args: {
          p_message?: string;
          p_property_id: string;
          p_proposed_at: string;
        };
        Returns: string;
      };
      require_step_up: { Args: never; Returns: undefined };
      reschedule_visit_request: {
        Args: { p_id: string; p_proposed_at: string };
        Returns: undefined;
      };
      resolve_contract_share: {
        Args: { p_access_code_hash?: string; p_token: string };
        Returns: {
          body: Json;
          contract_id: string;
          invalid_code: boolean;
          needs_code: boolean;
          permission: Database["public"]["Enums"]["share_permission"];
          share_id: string;
          title: string;
          values: Json;
        }[];
      };
      resolve_file_share: {
        Args: { p_access_code_hash?: string; p_token: string };
        Returns: {
          file_id: string;
          file_name: string;
          invalid_code: boolean;
          mime: string;
          needs_code: boolean;
          permission: Database["public"]["Enums"]["share_permission"];
          share_id: string;
          size: number;
        }[];
      };
      revoke_address_grant: { Args: { p_grant_id: string }; Returns: undefined };
      revoke_contract_share: {
        Args: { p_share_id: string };
        Returns: undefined;
      };
      revoke_file_share: { Args: { p_share_id: string }; Returns: undefined };
      role_of: {
        Args: { uid: string };
        Returns: Database["public"]["Enums"]["user_role"];
      };
      run_search_alerts: { Args: never; Returns: number };
      save_contract_version: {
        Args: {
          p_body: Json;
          p_contract_id: string;
          p_freeze?: boolean;
          p_note?: string;
          p_values?: Json;
        };
        Returns: string;
      };
      seed_demo_site_analytics: { Args: { p_days?: number }; Returns: number };
      set_app_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      set_contract_status: {
        Args: {
          p_contract_id: string;
          p_status: Database["public"]["Enums"]["contract_status"];
        };
        Returns: undefined;
      };
      set_feature_flag: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      set_lead_stage: {
        Args: {
          p_lead_id: string;
          p_outcome?: Database["public"]["Enums"]["lead_outcome"];
          p_stage: Database["public"]["Enums"]["lead_stage"];
        };
        Returns: undefined;
      };
      set_ticket_status: {
        Args: {
          p_fix_note?: string;
          p_status: Database["public"]["Enums"]["ticket_status"];
          p_ticket_id: string;
        };
        Returns: undefined;
      };
      share_contract: {
        Args: {
          p_access_code_hash?: string;
          p_contract_id: string;
          p_expires_at?: string;
          p_permission?: Database["public"]["Enums"]["share_permission"];
          p_shared_with?: string;
          p_token?: string;
        };
        Returns: string;
      };
      share_exact_address: {
        Args: { p_buyer_id: string; p_property_id: string };
        Returns: undefined;
      };
      share_file: {
        Args: {
          p_access_code_hash?: string;
          p_expires_at?: string;
          p_file_id: string;
          p_permission?: Database["public"]["Enums"]["share_permission"];
          p_shared_with?: string;
          p_token?: string;
        };
        Returns: string;
      };
      shared_with_me: {
        Args: never;
        Returns: {
          created_at: string;
          expires_at: string;
          file_id: string;
          mime: string;
          name: string;
          permission: Database["public"]["Enums"]["share_permission"];
          share_id: string;
          shared_by_name: string;
          size: number;
        }[];
      };
      signup_eligibility: {
        Args: { p_email: string; p_phone: string; p_tax_id: string };
        Returns: Json;
      };
      site_conversions_daily: {
        Args: { p_from: string; p_to: string };
        Returns: {
          conversions: number;
          date: string;
          site_mode: string;
        }[];
      };
      start_conversation: { Args: { p_property_id: string }; Returns: string };
      step_up_valid: { Args: never; Returns: boolean };
      submit_site_lead: {
        Args: {
          p_consent_marketing?: boolean;
          p_email: string;
          p_form: string;
          p_honeypot?: string;
          p_ip?: string;
          p_message?: string;
          p_name: string;
          p_phone?: string;
          p_profile_type: string;
          p_reason?: string;
          p_utm?: Json;
        };
        Returns: {
          already_confirmed: boolean;
          confirm_token: string;
          lead_id: string;
        }[];
      };
      subscription_agreements_for_me: {
        Args: never;
        Returns: {
          addons: Json;
          celebrated_at: string;
          commitment_ends_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          interval: string;
          minimum_commitment_months: number | null;
          plan_features: string[];
          plan_id: string | null;
          plan_limits: Json | null;
          plan_name: string;
          price_cents: number;
          price_month_cents: number;
          price_year_cents: number;
          profile_id: string | null;
          provider: Json;
          reference: string;
          subscription_id: string;
          supersedes_id: string | null;
          terms_accepted_at: string | null;
          terms_accepted_ip: unknown;
          terms_content_hash: string | null;
          terms_document_id: string | null;
          terms_version: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "subscription_agreements";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      subscription_entitled: {
        Args: { p_profile_id?: string };
        Returns: boolean;
      };
      suggest_ticket_severity: {
        Args: { p_affected_users?: number; p_route: string };
        Returns: Database["public"]["Enums"]["ticket_severity"];
      };
      support_list_tickets: {
        Args: { p_limit?: number; p_search?: string; p_tab?: string };
        Returns: {
          affected_users: number;
          id: string;
          last_seen_at: string;
          occurrences: number;
          origin: Database["public"]["Enums"]["ticket_origin"];
          ref: string;
          reporter_name: string;
          route: string;
          severity: Database["public"]["Enums"]["ticket_severity"];
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
        }[];
      };
      support_ticket_counts: { Args: never; Returns: Json };
      support_ticket_detail: {
        Args: { p_ticket_id: string };
        Returns: {
          affected_users: number;
          breadcrumbs: Json;
          browser: string;
          build_sha: string;
          console_errors: Json;
          description: string;
          first_seen_at: string;
          fix_note: string;
          id: string;
          last_seen_at: string;
          network: string;
          occurrences: number;
          origin: Database["public"]["Enums"]["ticket_origin"];
          os: string;
          ref: string;
          reporter_name: string;
          reporter_role: string;
          route: string;
          screenshot_path: string;
          session_id: string;
          severity: Database["public"]["Enums"]["ticket_severity"];
          status: Database["public"]["Enums"]["ticket_status"];
          technical_purged_at: string;
          title: string;
          viewport: string;
        }[];
      };
      terms_acceptance_status: {
        Args: { p_locale?: string };
        Returns: {
          accepted_at: string;
          accepted_version: string;
          content_hash: string;
          document_id: string;
          needs_acceptance: boolean;
          review_state: Database["public"]["Enums"]["legal_review_state"];
          version: string;
        }[];
      };
      ticket_history: {
        Args: { p_ticket_id: string };
        Returns: {
          actor_name: string;
          note: string;
          occurred_at: string;
          status_from: Database["public"]["Enums"]["ticket_status"];
          status_to: Database["public"]["Enums"]["ticket_status"];
        }[];
      };
      trial_eligible: { Args: { p_profile_id?: string }; Returns: boolean };
      trial_status: {
        Args: never;
        Returns: {
          eligible: boolean;
          request_reason: string;
          request_status: string;
          trial_ends_at: string;
          trialing: boolean;
        }[];
      };
      upsert_owner_lead: {
        Args: {
          p_contact_id: string;
          p_owner_id: string;
          p_property_id: string;
          p_source: string;
          p_stage: Database["public"]["Enums"]["lead_stage"];
        };
        Returns: undefined;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_diff?: Json;
          p_entity: string;
          p_entity_id?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      cloud_scope: "personal" | "staff";
      contract_kind: "sale" | "rent";
      contract_status: "draft" | "shared" | "awaiting_signature" | "signed" | "completed";
      contract_template_status: "draft" | "published" | "archived";
      delivery_status: "queued" | "sent" | "failed" | "cancelled";
      document_action:
        "view" | "download" | "export_pdf" | "print" | "share_created" | "share_revoked";
      document_subject:
        | "file"
        | "contract"
        | "property_document"
        | "contract_template"
        | "invoice"
        | "chat_attachment";
      file_source: "upload" | "property_document" | "message_attachment" | "contract" | "invoice";
      folder_kind: "user" | "property" | "property_documents";
      lead_outcome: "won" | "lost";
      lead_stage: "new" | "contacted" | "visit" | "closed";
      legal_document_kind: "terms" | "privacy" | "cookies" | "data_protection";
      legal_review_state: "draft_pending_legal_review" | "legally_reviewed";
      plan_audience: "owner" | "buyer" | "both";
      profile_status: "pending" | "active" | "suspended" | "deleted";
      property_deal: "sale" | "rent";
      property_status:
        | "draft"
        | "pending_review"
        | "active"
        | "featured"
        | "rented"
        | "sold"
        | "rejected"
        | "archived";
      share_permission: "view" | "download";
      staff_department: "suporte" | "financeiro" | "moderacao" | "admin";
      ticket_origin: "auto" | "report" | "both";
      ticket_severity: "critical" | "high" | "medium" | "low";
      ticket_status: "new" | "triage" | "in_progress" | "awaiting_confirmation" | "closed";
      user_role: "buyer" | "owner" | "admin" | "support";
      visit_status: "pending" | "accepted" | "rescheduled" | "cancelled" | "completed" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          lifecycle_configuration: Json | null;
          lifecycle_configuration_generation: string | null;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
          versioning_status: string;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          lifecycle_configuration?: Json | null;
          lifecycle_configuration_generation?: string | null;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
          versioning_status?: string;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          lifecycle_configuration?: Json | null;
          lifecycle_configuration_generation?: string | null;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
          versioning_status?: string;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          archived_at: string | null;
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          archived_at?: string | null;
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_delete_marker?: boolean;
          is_versioned?: boolean;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          archived_at?: string | null;
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_delete_marker?: boolean;
          is_versioned?: boolean;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_vectors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string };
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
          raw_prefix_param?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delete_markers?: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          next_token_archived_at?: string;
          next_token_version?: string;
          noncurrent_versions?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          delete_markers?: string;
          levels?: number;
          limits?: number;
          noncurrent_versions?: string;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          delete_markers?: string;
          noncurrent_versions?: string;
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
          p_start_after_version?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          delete_markers?: string;
          levels?: number;
          limits?: number;
          noncurrent_versions?: string;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
          start_after_archived_at?: string;
          start_after_is_continuation?: boolean;
          start_after_version?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      cloud_scope: ["personal", "staff"],
      contract_kind: ["sale", "rent"],
      contract_status: ["draft", "shared", "awaiting_signature", "signed", "completed"],
      contract_template_status: ["draft", "published", "archived"],
      delivery_status: ["queued", "sent", "failed", "cancelled"],
      document_action: [
        "view",
        "download",
        "export_pdf",
        "print",
        "share_created",
        "share_revoked",
      ],
      document_subject: [
        "file",
        "contract",
        "property_document",
        "contract_template",
        "invoice",
        "chat_attachment",
      ],
      file_source: ["upload", "property_document", "message_attachment", "contract", "invoice"],
      folder_kind: ["user", "property", "property_documents"],
      lead_outcome: ["won", "lost"],
      lead_stage: ["new", "contacted", "visit", "closed"],
      legal_document_kind: ["terms", "privacy", "cookies", "data_protection"],
      legal_review_state: ["draft_pending_legal_review", "legally_reviewed"],
      plan_audience: ["owner", "buyer", "both"],
      profile_status: ["pending", "active", "suspended", "deleted"],
      property_deal: ["sale", "rent"],
      property_status: [
        "draft",
        "pending_review",
        "active",
        "featured",
        "rented",
        "sold",
        "rejected",
        "archived",
      ],
      share_permission: ["view", "download"],
      staff_department: ["suporte", "financeiro", "moderacao", "admin"],
      ticket_origin: ["auto", "report", "both"],
      ticket_severity: ["critical", "high", "medium", "low"],
      ticket_status: ["new", "triage", "in_progress", "awaiting_confirmation", "closed"],
      user_role: ["buyer", "owner", "admin", "support"],
      visit_status: ["pending", "accepted", "rescheduled", "cancelled", "completed", "archived"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const;
