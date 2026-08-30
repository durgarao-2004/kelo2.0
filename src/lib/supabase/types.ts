/**
 * Hand-maintained database types mirroring supabase/migrations.
 * (CLI generation `supabase gen types` requires the DB connection string;
 * keep this file in sync with the SQL migrations.)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LectureStatus =
  | "recording"
  | "uploading"
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "finalizing"
  | "completed"
  | "failed"
  | "recoverable";

export type AttendanceStatus = "attended" | "missed" | "cancelled";

export type TextbookMatchStatus = "not_configured" | "pending" | "unverified" | "verified";

export type RecordingSessionStatus =
  | "recording"
  | "finalizing"
  | "uploaded"
  | "failed";

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          pin_hash: string;
          failed_attempts: number;
          locked_until: string | null;
          session_version: number;
        } & Timestamps;
        Insert: {
          id?: string;
          email: string;
          pin_hash: string;
          failed_attempts?: number;
          locked_until?: string | null;
          session_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          target_attendance: number;
          total_sessions: number;
          year: number | null;
          semester: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          target_attendance?: number;
          total_sessions?: number;
          year?: number | null;
          semester?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subjects"]["Insert"]>;
        Relationships: [];
      };
      schedule_entries: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          day_of_week: number;
          start_minute: number;
          end_minute: number;
          location: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          day_of_week: number;
          start_minute: number;
          end_minute: number;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_entries"]["Insert"]>;
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          schedule_entry_id: string | null;
          occurred_on: string;
          status: AttendanceStatus;
          note: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          schedule_entry_id?: string | null;
          occurred_on: string;
          status: AttendanceStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_records"]["Insert"]>;
        Relationships: [];
      };
      lectures: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          title: string | null;
          status: LectureStatus;
          recorded_at: string;
          duration_seconds: number;
          drive_recording_file_id: string | null;
          drive_transcript_file_id: string | null;
          drive_summary_file_id: string | null;
          error: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          title?: string | null;
          status?: LectureStatus;
          recorded_at?: string;
          duration_seconds?: number;
          drive_recording_file_id?: string | null;
          drive_transcript_file_id?: string | null;
          drive_summary_file_id?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lectures"]["Insert"]>;
        Relationships: [];
      };
      transcripts: {
        Row: {
          id: string;
          lecture_id: string;
          user_id: string;
          content: string;
          language: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          lecture_id: string;
          user_id: string;
          content?: string;
          language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transcripts"]["Insert"]>;
        Relationships: [];
      };
      summaries: {
        Row: {
          id: string;
          lecture_id: string;
          user_id: string;
          summary: string | null;
          key_concepts: Json;
          important_points: Json;
          topics: Json;
          notes: Json;
          definitions: Json;
          examples: Json;
          revision: Json;
          model: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          lecture_id: string;
          user_id: string;
          summary?: string | null;
          key_concepts?: Json;
          important_points?: Json;
          topics?: Json;
          notes?: Json;
          definitions?: Json;
          examples?: Json;
          revision?: Json;
          model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["summaries"]["Insert"]>;
        Relationships: [];
      };
      drive_connections: {
        Row: {
          user_id: string;
          access_token_enc: string;
          refresh_token_enc: string | null;
          token_expiry: string | null;
          scope: string | null;
          google_email: string | null;
          root_folder_id: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token_enc: string;
          refresh_token_enc?: string | null;
          token_expiry?: string | null;
          scope?: string | null;
          google_email?: string | null;
          root_folder_id?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drive_connections"]["Insert"]>;
        Relationships: [];
      };
      drive_folders: {
        Row: {
          id: string;
          user_id: string;
          path: string;
          drive_folder_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          path: string;
          drive_folder_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drive_folders"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          recording_prefs: Json;
          notification_prefs: Json;
          ai_prefs: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          recording_prefs?: Json;
          notification_prefs?: Json;
          ai_prefs?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      pin_recovery_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pin_recovery_tokens"]["Insert"]>;
        Relationships: [];
      };
      recording_sessions: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string | null;
          title: string | null;
          mime_type: string;
          status: RecordingSessionStatus;
          duration_seconds: number;
          lecture_id: string | null;
          error: string | null;
        } & Timestamps;
        Insert: {
          id: string;
          user_id: string;
          subject_id?: string | null;
          title?: string | null;
          mime_type: string;
          status?: RecordingSessionStatus;
          duration_seconds?: number;
          lecture_id?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recording_sessions"]["Insert"]>;
        Relationships: [];
      };
      recording_chunk_meta: {
        Row: {
          session_id: string;
          chunk_index: number;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          session_id: string;
          chunk_index: number;
          size_bytes: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recording_chunk_meta"]["Insert"]>;
        Relationships: [];
      };
      lecture_concepts: {
        Row: {
          id: string;
          lecture_id: string;
          user_id: string;
          subject_id: string | null;
          concept: string;
          lecture_connection: string | null;
          textbook_subject_key: string | null;
          textbook_status: TextbookMatchStatus;
          textbook_explanation: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lecture_id: string;
          user_id: string;
          subject_id?: string | null;
          concept: string;
          lecture_connection?: string | null;
          textbook_subject_key?: string | null;
          textbook_status?: TextbookMatchStatus;
          textbook_explanation?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lecture_concepts"]["Insert"]>;
        Relationships: [];
      };
      lecture_chunks: {
        Row: {
          id: string;
          lecture_id: string;
          user_id: string;
          subject_id: string | null;
          source: "transcript" | "summary";
          chunk_index: number;
          content: string;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lecture_id: string;
          user_id: string;
          subject_id?: string | null;
          source?: "transcript" | "summary";
          chunk_index: number;
          content: string;
          embedding?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lecture_chunks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      search_lecture_chunks: {
        Args: { p_user_id: string; p_query: string; p_limit?: number };
        Returns: {
          chunk_id: string;
          lecture_id: string;
          subject_id: string | null;
          source: string;
          content: string;
          rank: number;
        }[];
      };
      match_lecture_chunks: {
        Args: { p_user_id: string; p_embedding: string; p_limit?: number };
        Returns: {
          chunk_id: string;
          lecture_id: string;
          subject_id: string | null;
          source: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
