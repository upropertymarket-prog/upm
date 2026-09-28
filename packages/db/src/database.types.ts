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
      plans: {
        Row: {
          audience: Database["public"]["Enums"]["plan_audience"];
          created_at: string;
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
          phone: string | null;
          plan_id: string | null;
          preferences: Json;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id: string | null;
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
          phone?: string | null;
          plan_id?: string | null;
          preferences?: Json;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id?: string | null;
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
          phone?: string | null;
          plan_id?: string | null;
          preferences?: Json;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          stripe_customer_id?: string | null;
          theme?: string;
          updated_at?: string;
          verification_grace_until?: string;
        };
        Relationships: [
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
          ref: string;
          rejection_reason?: string | null;
          rent_cents?: number | null;
          show_exact?: boolean;
          status?: Database["public"]["Enums"]["property_status"];
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
        ];
      };
      property_documents: {
        Row: {
          created_at: string;
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          id: string;
          interval: string;
          plan_id: string;
          profile_id: string;
          status: string;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          plan_id: string;
          profile_id: string;
          status?: string;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          interval?: string;
          plan_id?: string;
          profile_id?: string;
          status?: string;
          stripe_subscription_id?: string | null;
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
      check_auth_rate_limit: {
        Args: { p_identifier: string; p_kind: string };
        Returns: Json;
      };
      get_property_location: {
        Args: { p_property_id: string };
        Returns: unknown;
      };
      is_admin: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
      record_auth_attempt: {
        Args: { p_identifier: string; p_kind: string; p_succeeded: boolean };
        Returns: undefined;
      };
      role_of: {
        Args: { uid: string };
        Returns: Database["public"]["Enums"]["user_role"];
      };
    };
    Enums: {
      plan_audience: "owner" | "buyer" | "both";
      profile_status: "pending" | "active" | "suspended";
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
      staff_department: "suporte" | "financeiro" | "moderacao" | "admin";
      user_role: "buyer" | "owner" | "admin" | "support";
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
      plan_audience: ["owner", "buyer", "both"],
      profile_status: ["pending", "active", "suspended"],
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
      staff_department: ["suporte", "financeiro", "moderacao", "admin"],
      user_role: ["buyer", "owner", "admin", "support"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const;
