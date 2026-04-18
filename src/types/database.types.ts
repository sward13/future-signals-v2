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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          created_at: string
          id: string
          input_tokens: number | null
          model: string
          operation: string
          output_tokens: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          model: string
          operation: string
          output_tokens?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string
          operation?: string
          output_tokens?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          confidence: string | null
          created_at: string
          critical_uncertainties: string[]
          description: string | null
          id: string
          implications: string | null
          key_dynamics: string | null
          project_id: string
          workspace_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          critical_uncertainties?: string[]
          description?: string | null
          id?: string
          implications?: string | null
          key_dynamics?: string | null
          project_id: string
          workspace_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          critical_uncertainties?: string[]
          description?: string | null
          id?: string
          implications?: string | null
          key_dynamics?: string | null
          project_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          embedding: string | null
          expires_at: string
          id: string
          ingested_at: string
          published_at: string | null
          source_id: string
          status: string
          steepled: string[]
          summary_ai: string | null
          summary_raw: string | null
          title: string
          url: string
        }
        Insert: {
          embedding?: string | null
          expires_at?: string
          id?: string
          ingested_at?: string
          published_at?: string | null
          source_id: string
          status?: string
          steepled?: string[]
          summary_ai?: string | null
          summary_raw?: string | null
          title: string
          url: string
        }
        Update: {
          embedding?: string | null
          expires_at?: string
          id?: string
          ingested_at?: string
          published_at?: string | null
          source_id?: string
          status?: string
          steepled?: string[]
          summary_ai?: string | null
          summary_raw?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_nodes: {
        Row: {
          cluster_id: string
          created_at: string
          id: string
          project_id: string
          workspace_id: string
          x: number
          y: number
        }
        Insert: {
          cluster_id: string
          created_at?: string
          id?: string
          project_id: string
          workspace_id: string
          x?: number
          y?: number
        }
        Update: {
          cluster_id?: string
          created_at?: string
          id?: string
          project_id?: string
          workspace_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_nodes_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_inputs: {
        Row: {
          cluster_id: string
          created_at: string
          id: string
          input_id: string
          workspace_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          id?: string
          input_id: string
          workspace_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          id?: string
          input_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_inputs_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_inputs_input_id_fkey"
            columns: ["input_id"]
            isOneToOne: false
            referencedRelation: "inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_inputs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_suggestions: {
        Row: {
          acted_on_at: string | null
          avg_similarity: number | null
          description: string | null
          generated_at: string | null
          generative_note: string | null
          id: string
          input_ids: string[]
          is_weak_signal: boolean
          name: string
          project_id: string
          rationale: string | null
          status: string
          subtype: string | null
          workspace_id: string
        }
        Insert: {
          acted_on_at?: string | null
          avg_similarity?: number | null
          description?: string | null
          generated_at?: string | null
          generative_note?: string | null
          id?: string
          input_ids: string[]
          is_weak_signal?: boolean
          name: string
          project_id: string
          rationale?: string | null
          status?: string
          subtype?: string | null
          workspace_id: string
        }
        Update: {
          acted_on_at?: string | null
          avg_similarity?: number | null
          description?: string | null
          generated_at?: string | null
          generative_note?: string | null
          id?: string
          input_ids?: string[]
          is_weak_signal?: boolean
          name?: string
          project_id?: string
          rationale?: string | null
          status?: string
          subtype?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          created_at: string
          description: string | null
          horizon: string | null
          id: string
          likelihood: string | null
          name: string
          project_id: string
          subtype: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          horizon?: string | null
          id?: string
          likelihood?: string | null
          name: string
          project_id: string
          subtype?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          horizon?: string | null
          id?: string
          likelihood?: string | null
          name?: string
          project_id?: string
          subtype?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inputs: {
        Row: {
          created_at: string
          description: string | null
          embedding: string | null
          horizon: string | null
          id: string
          is_seeded: boolean
          metadata: Json
          name: string
          project_id: string | null
          signal_quality: string | null
          source_url: string | null
          steepled: string[]
          subtype: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          horizon?: string | null
          id?: string
          is_seeded?: boolean
          metadata?: Json
          name: string
          project_id?: string | null
          signal_quality?: string | null
          source_url?: string | null
          steepled?: string[]
          subtype?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          horizon?: string | null
          id?: string
          is_seeded?: boolean
          metadata?: Json
          name?: string
          project_id?: string | null
          signal_quality?: string | null
          source_url?: string | null
          steepled?: string[]
          subtype?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inputs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      preferred_futures: {
        Row: {
          created_at: string
          description: string | null
          desired_outcomes: string | null
          guiding_principles: Json
          horizon: string | null
          id: string
          indicators: Json
          name: string
          project_id: string
          scenario_ids: Json
          strategic_priorities: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          desired_outcomes?: string | null
          guiding_principles?: Json
          horizon?: string | null
          id?: string
          indicators?: Json
          name: string
          project_id: string
          scenario_ids?: Json
          strategic_priorities?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          desired_outcomes?: string | null
          guiding_principles?: Json
          horizon?: string | null
          id?: string
          indicators?: Json
          name?: string
          project_id?: string
          scenario_ids?: Json
          strategic_priorities?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferred_futures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferred_futures_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_candidates: {
        Row: {
          candidate_id: string
          classification: string | null
          corpus_sim: number | null
          created_at: string
          dismissal_reason: string | null
          id: string
          key_question_sim: number | null
          negative_pool_sim: number | null
          project_id: string
          score: number | null
          scored_at: string | null
          surfaced: boolean
          user_action: string | null
        }
        Insert: {
          candidate_id: string
          classification?: string | null
          corpus_sim?: number | null
          created_at?: string
          dismissal_reason?: string | null
          id?: string
          key_question_sim?: number | null
          negative_pool_sim?: number | null
          project_id: string
          score?: number | null
          scored_at?: string | null
          surfaced?: boolean
          user_action?: string | null
        }
        Update: {
          candidate_id?: string
          classification?: string | null
          corpus_sim?: number | null
          created_at?: string
          dismissal_reason?: string | null
          id?: string
          key_question_sim?: number | null
          negative_pool_sim?: number | null
          project_id?: string
          score?: number | null
          scored_at?: string | null
          surfaced?: boolean
          user_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_negative_pool: {
        Row: {
          centroid_embedding: string | null
          count: number
          id: string
          project_id: string
          recomputed_at: string
        }
        Insert: {
          centroid_embedding?: string | null
          count?: number
          id?: string
          project_id: string
          recomputed_at?: string
        }
        Update: {
          centroid_embedding?: string | null
          count?: number
          id?: string
          project_id?: string
          recomputed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_negative_pool_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sources: {
        Row: {
          created_at: string
          id: string
          opted_in: boolean
          project_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opted_in?: boolean
          project_id: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opted_in?: boolean
          project_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assumptions: string | null
          created_at: string
          domain: string | null
          focus: string | null
          geo: string | null
          h1_end: string | null
          h1_start: string | null
          h2_end: string | null
          h2_start: string | null
          h3_end: string | null
          h3_start: string | null
          id: string
          key_question_embedding: string | null
          last_reviewed_at: string | null
          name: string
          question: string | null
          scanning_enabled: boolean
          stakeholders: string | null
          workspace_id: string
        }
        Insert: {
          assumptions?: string | null
          created_at?: string
          domain?: string | null
          focus?: string | null
          geo?: string | null
          h1_end?: string | null
          h1_start?: string | null
          h2_end?: string | null
          h2_start?: string | null
          h3_end?: string | null
          h3_start?: string | null
          id?: string
          key_question_embedding?: string | null
          last_reviewed_at?: string | null
          name: string
          question?: string | null
          scanning_enabled?: boolean
          stakeholders?: string | null
          workspace_id: string
        }
        Update: {
          assumptions?: string | null
          created_at?: string
          domain?: string | null
          focus?: string | null
          geo?: string | null
          h1_end?: string | null
          h1_start?: string | null
          h2_end?: string | null
          h2_start?: string | null
          h3_end?: string | null
          h3_start?: string | null
          id?: string
          key_question_embedding?: string | null
          last_reviewed_at?: string | null
          name?: string
          question?: string | null
          scanning_enabled?: boolean
          stakeholders?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          confidence: string | null
          created_at: string
          evidence: string | null
          from_cluster_id: string
          id: string
          project_id: string
          source_handle: string | null
          target_handle: string | null
          to_cluster_id: string
          type: string
          workspace_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          evidence?: string | null
          from_cluster_id: string
          id?: string
          project_id: string
          source_handle?: string | null
          target_handle?: string | null
          to_cluster_id: string
          type?: string
          workspace_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          evidence?: string | null
          from_cluster_id?: string
          id?: string
          project_id?: string
          source_handle?: string | null
          target_handle?: string | null
          to_cluster_id?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_from_cluster_id_fkey"
            columns: ["from_cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_to_cluster_id_fkey"
            columns: ["to_cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_clusters: {
        Row: {
          cluster_id: string
          created_at: string
          id: string
          scenario_id: string
          workspace_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          id?: string
          scenario_id: string
          workspace_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          id?: string
          scenario_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_clusters_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_clusters_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          archetype: string | null
          cluster_ids: string[]
          confidence: string | null
          created_at: string
          description: string | null
          driving_forces: Json
          geographic_scope: string | null
          horizon: string | null
          id: string
          key_differences: Json
          name: string
          narrative: string | null
          project_id: string
          suppressed_forces: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archetype?: string | null
          cluster_ids?: string[]
          confidence?: string | null
          created_at?: string
          description?: string | null
          driving_forces?: Json
          geographic_scope?: string | null
          horizon?: string | null
          id?: string
          key_differences?: Json
          name: string
          narrative?: string | null
          project_id: string
          suppressed_forces?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archetype?: string | null
          cluster_ids?: string[]
          confidence?: string | null
          created_at?: string
          description?: string | null
          driving_forces?: Json
          geographic_scope?: string | null
          horizon?: string | null
          id?: string
          key_differences?: Json
          name?: string
          narrative?: string | null
          project_id?: string
          suppressed_forces?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          active: boolean
          created_at: string
          credibility: string
          domain: string
          id: string
          last_fetched_at: string | null
          name: string
          owner_id: string | null
          source_type: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credibility?: string
          domain: string
          id?: string
          last_fetched_at?: string | null
          name: string
          owner_id?: string | null
          source_type?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credibility?: string
          domain?: string
          id?: string
          last_fetched_at?: string | null
          name?: string
          owner_id?: string | null
          source_type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_options: {
        Row: {
          actions: string | null
          created_at: string
          dependencies: string | null
          description: string | null
          feasibility: string | null
          horizon: string | null
          id: string
          implications: string | null
          intended_outcome: string | null
          name: string
          project_id: string
          risks: string | null
          scenario_ids: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actions?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          feasibility?: string | null
          horizon?: string | null
          id?: string
          implications?: string | null
          intended_outcome?: string | null
          name: string
          project_id: string
          risks?: string | null
          scenario_ids?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actions?: string | null
          created_at?: string
          dependencies?: string | null
          description?: string | null
          feasibility?: string | null
          horizon?: string | null
          id?: string
          implications?: string | null
          intended_outcome?: string | null
          name?: string
          project_id?: string
          risks?: string | null
          scenario_ids?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_options_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_options_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          ai_cap_monthly: number
          created_at: string
          feature_flags: Json
          id: string
          onboarding_complete: boolean
          plan_tier: string
          preferences: Json
          scanning_enabled: boolean
          workspace_id: string
        }
        Insert: {
          ai_cap_monthly?: number
          created_at?: string
          feature_flags?: Json
          id?: string
          onboarding_complete?: boolean
          plan_tier?: string
          preferences?: Json
          scanning_enabled?: boolean
          workspace_id: string
        }
        Update: {
          ai_cap_monthly?: number
          created_at?: string
          feature_flags?: Json
          id?: string
          onboarding_complete?: boolean
          plan_tier?: string
          preferences?: Json
          scanning_enabled?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_similar_input_pairs: {
        Args: { p_project_id: string; p_threshold?: number }
        Returns: {
          id_a: string
          id_b: string
        }[]
      }
      get_user_workspace_id: { Args: never; Returns: string }
      get_workspace_id: { Args: never; Returns: string }
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
A new version of Supabase CLI is available: v2.90.0 (currently installed v2.84.2)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
