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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_submissions: {
        Row: {
          activity_type_id: string
          committee_id: string
          created_at: string
          description: string | null
          group_submission_id: string | null
          id: string
          location: string | null
          participants_count: number | null
          points_awarded: number | null
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          volunteer_id: string
          wore_vest: boolean | null
        }
        Insert: {
          activity_type_id: string
          committee_id: string
          created_at?: string
          description?: string | null
          group_submission_id?: string | null
          id?: string
          location?: string | null
          participants_count?: number | null
          points_awarded?: number | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          volunteer_id: string
          wore_vest?: boolean | null
        }
        Update: {
          activity_type_id?: string
          committee_id?: string
          created_at?: string
          description?: string | null
          group_submission_id?: string | null
          id?: string
          location?: string | null
          participants_count?: number | null
          points_awarded?: number | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          volunteer_id?: string
          wore_vest?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_submissions_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_group_submission_id_fkey"
            columns: ["group_submission_id"]
            isOneToOne: false
            referencedRelation: "group_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_type_committees: {
        Row: {
          activity_type_id: string
          committee_id: string
          created_at: string
        }
        Insert: {
          activity_type_id: string
          committee_id: string
          created_at?: string
        }
        Update: {
          activity_type_id?: string
          committee_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_type_committees_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_type_committees_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_types: {
        Row: {
          committee_id: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          mode: Database["public"]["Enums"]["activity_mode"]
          name: string
          name_ar: string
          points: number
          points_with_vest: number | null
          points_without_vest: number | null
          updated_at: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["activity_mode"]
          name: string
          name_ar: string
          points?: number
          points_with_vest?: number | null
          points_without_vest?: number | null
          updated_at?: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["activity_mode"]
          name?: string
          name_ar?: string
          points?: number
          points_with_vest?: number | null
          points_without_vest?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_types_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          activities_required: number | null
          auto_award: boolean | null
          caravans_required: number | null
          color: string
          created_at: string
          description: string | null
          description_ar: string | null
          icon: string
          id: string
          months_required: number | null
          name: string
          name_ar: string
          points_required: number | null
        }
        Insert: {
          activities_required?: number | null
          auto_award?: boolean | null
          caravans_required?: number | null
          color?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon?: string
          id?: string
          months_required?: number | null
          name: string
          name_ar: string
          points_required?: number | null
        }
        Update: {
          activities_required?: number | null
          auto_award?: boolean | null
          caravans_required?: number | null
          color?: string
          created_at?: string
          description?: string | null
          description_ar?: string | null
          icon?: string
          id?: string
          months_required?: number | null
          name?: string
          name_ar?: string
          points_required?: number | null
        }
        Relationships: []
      }
      caravan_participants: {
        Row: {
          caravan_id: string | null
          created_at: string | null
          id: string
          is_volunteer: boolean | null
          name: string
          phone: string | null
          role: string | null
          volunteer_id: string | null
          wore_vest: boolean | null
        }
        Insert: {
          caravan_id?: string | null
          created_at?: string | null
          id?: string
          is_volunteer?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          volunteer_id?: string | null
          wore_vest?: boolean | null
        }
        Update: {
          caravan_id?: string | null
          created_at?: string | null
          id?: string
          is_volunteer?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          volunteer_id?: string | null
          wore_vest?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "caravan_participants_caravan_id_fkey"
            columns: ["caravan_id"]
            isOneToOne: false
            referencedRelation: "caravans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caravan_participants_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caravans: {
        Row: {
          actual_move_time: string | null
          bus_arrival_time: string | null
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          location: string
          move_time: string | null
          name: string
          return_time: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          actual_move_time?: string | null
          bus_arrival_time?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          location: string
          move_time?: string | null
          name: string
          return_time?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          actual_move_time?: string | null
          bus_arrival_time?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          location?: string
          move_time?: string | null
          name?: string
          return_time?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caravans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          color: string | null
          committee_type: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          committee_type?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          name: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          committee_type?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          name?: string
          name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      competition_entries: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          month_year: string | null
          participant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          month_year?: string | null
          participant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          month_year?: string | null
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_entries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "competition_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_participants: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          image_url: string | null
          month_year: string | null
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          month_year?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          month_year?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      course_attendance: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          lecture_id: string | null
          status: string | null
          student_name: string
          student_phone: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lecture_id?: string | null
          status?: string | null
          student_name: string
          student_phone: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lecture_id?: string | null
          status?: string | null
          student_name?: string
          student_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "course_lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      course_beneficiaries: {
        Row: {
          course_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          phone: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          phone: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_beneficiaries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_beneficiaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lectures: {
        Row: {
          course_id: string | null
          created_at: string | null
          date: string
          id: string
          lecture_number: number
          status: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          lecture_number: number
          status?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          lecture_number?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lectures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_organizers: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          volunteer_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          volunteer_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_organizers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_organizers_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          certificate_status: string | null
          committee_id: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          has_certificates: boolean | null
          has_interview: boolean | null
          id: string
          interview_date: string | null
          name: string
          room: string
          schedule_days: string[]
          schedule_end_time: string | null
          schedule_time: string
          start_date: string
          total_lectures: number
          trainer_id: string | null
          trainer_name: string
          trainer_phone: string | null
          updated_at: string | null
        }
        Insert: {
          certificate_status?: string | null
          committee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          has_certificates?: boolean | null
          has_interview?: boolean | null
          id?: string
          interview_date?: string | null
          name: string
          room: string
          schedule_days: string[]
          schedule_end_time?: string | null
          schedule_time: string
          start_date: string
          total_lectures: number
          trainer_id?: string | null
          trainer_name: string
          trainer_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          certificate_status?: string | null
          committee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          has_certificates?: boolean | null
          has_interview?: boolean | null
          id?: string
          interview_date?: string | null
          name?: string
          room?: string
          schedule_days?: string[]
          schedule_end_time?: string | null
          schedule_time?: string
          start_date?: string
          total_lectures?: number
          trainer_id?: string | null
          trainer_name?: string
          trainer_phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ethics_calls: {
        Row: {
          calls_count: number | null
          created_at: string | null
          created_by: string | null
          date: string
          drive_link: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          calls_count?: number | null
          created_at?: string | null
          created_by?: string | null
          date: string
          drive_link?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          calls_count?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          drive_link?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ethics_calls_participants: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          is_volunteer: boolean | null
          name: string
          phone: string | null
          volunteer_id: string | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          is_volunteer?: boolean | null
          name: string
          phone?: string | null
          volunteer_id?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          is_volunteer?: boolean | null
          name?: string
          phone?: string | null
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ethics_calls_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ethics_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          is_volunteer: boolean | null
          name: string
          phone: string | null
          volunteer_id: string | null
          wore_vest: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          is_volunteer?: boolean | null
          name: string
          phone?: string | null
          volunteer_id?: string | null
          wore_vest?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          is_volunteer?: boolean | null
          name?: string
          phone?: string | null
          volunteer_id?: string | null
          wore_vest?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          location: string
          name: string
          time: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          location: string
          name: string
          time?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          location?: string
          name?: string
          time?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_submissions: {
        Row: {
          activity_type_id: string
          committee_id: string
          created_at: string
          excel_sheet_url: string | null
          guest_participants: Json | null
          id: string
          leader_id: string
          submitted_at: string
        }
        Insert: {
          activity_type_id: string
          committee_id: string
          created_at?: string
          excel_sheet_url?: string | null
          guest_participants?: Json | null
          id?: string
          leader_id: string
          submitted_at?: string
        }
        Update: {
          activity_type_id?: string
          committee_id?: string
          created_at?: string
          excel_sheet_url?: string | null
          guest_participants?: Json | null
          id?: string
          leader_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_submissions_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_submissions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_submissions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activities_count: number
          attended_camp: boolean | null
          attended_mini_camp: boolean | null
          avatar_url: string | null
          committee_id: string | null
          created_at: string
          email: string
          full_name: string | null
          full_name_ar: string | null
          id: string
          join_date: string
          level: Database["public"]["Enums"]["volunteer_level"]
          phone: string | null
          total_points: number
          updated_at: string
          visible_password: string | null
        }
        Insert: {
          activities_count?: number
          attended_camp?: boolean | null
          attended_mini_camp?: boolean | null
          avatar_url?: string | null
          committee_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          full_name_ar?: string | null
          id: string
          join_date?: string
          level?: Database["public"]["Enums"]["volunteer_level"]
          phone?: string | null
          total_points?: number
          updated_at?: string
          visible_password?: string | null
        }
        Update: {
          activities_count?: number
          attended_camp?: boolean | null
          attended_mini_camp?: boolean | null
          avatar_url?: string | null
          committee_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          full_name_ar?: string | null
          id?: string
          join_date?: string
          level?: Database["public"]["Enums"]["volunteer_level"]
          phone?: string | null
          total_points?: number
          updated_at?: string
          visible_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          committee_id: string | null
          created_at: string | null
          id: string
          image_url: string | null
          name_ar: string
          name_en: string
          phone: string | null
          specialization: string | null
          updated_at: string | null
        }
        Insert: {
          committee_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name_ar: string
          name_en: string
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
        }
        Update: {
          committee_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name_ar?: string
          name_en?: string
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainers_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_private_details: {
        Row: {
          created_at: string | null
          id: string
          visible_password: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          visible_password?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          visible_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_private_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_level: {
        Args: { points: number }
        Returns: Database["public"]["Enums"]["volunteer_level"]
      }
      delete_user_account: { Args: { target_user_id: string }; Returns: Json }
      get_leaderboard: {
        Args: {
          committee_filter?: string
          period_type: string
          target_date?: string
        }
        Returns: {
          activities_count: number
          avatar_url: string
          committee_id: string
          committee_name: string
          committee_name_ar: string
          full_name: string
          full_name_ar: string
          level: Database["public"]["Enums"]["volunteer_level"]
          total_points: number
          volunteer_id: string
        }[]
      }
      get_trainer_stats: {
        Args: { p_trainer_id: string }
        Returns: {
          certificates_delivered_count: number
          courses_count: number
        }[]
      }
      get_user_committee_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_mode: "individual" | "group"
      app_role:
      | "admin"
      | "supervisor"
      | "committee_leader"
      | "volunteer"
      | "hr"
      | "head_hr"
      | "head_caravans"
      | "head_production"
      | "head_fourth_year"
      | "head_events"
      | "head_ethics"
      submission_status: "pending" | "approved" | "rejected"
      volunteer_level:
      | "bronze"
      | "silver"
      | "gold"
      | "platinum"
      | "diamond"
      | "under_follow_up"
      | "project_responsible"
      | "responsible"
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
      activity_mode: ["individual", "group"],
      app_role: [
        "admin",
        "supervisor",
        "committee_leader",
        "volunteer",
        "hr",
        "head_hr",
        "head_caravans",
        "head_production",
        "head_fourth_year",
        "head_events",
        "head_ethics",
      ],
      submission_status: ["pending", "approved", "rejected"],
      volunteer_level: [
        "bronze",
        "silver",
        "gold",
        "platinum",
        "diamond",
        "under_follow_up",
        "project_responsible",
        "responsible",
      ],
    },
  },
} as const
