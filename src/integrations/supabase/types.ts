export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            activity_submissions: {
                Row: {
                    activity_type_id: string | null
                    committee_id: string | null
                    created_at: string
                    description: string | null
                    id: string
                    image_url: string | null
                    points_awarded: number | null
                    status: string
                    submitted_at: string
                    volunteer_id: string | null
                }
                Insert: {
                    activity_type_id?: string | null
                    committee_id?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    image_url?: string | null
                    points_awarded?: number | null
                    status?: string
                    submitted_at?: string
                    volunteer_id?: string | null
                }
                Update: {
                    activity_type_id?: string | null
                    committee_id?: string | null
                    created_at?: string
                    description?: string | null
                    id?: string
                    image_url?: string | null
                    points_awarded?: number | null
                    status?: string
                    submitted_at?: string
                    volunteer_id?: string | null
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
                        foreignKeyName: "activity_submissions_volunteer_id_fkey"
                        columns: ["volunteer_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            activity_types: {
                Row: {
                    category: string
                    created_at: string
                    id: string
                    name: string
                    name_ar: string
                    points: number
                }
                Insert: {
                    category: string
                    created_at?: string
                    id?: string
                    name: string
                    name_ar: string
                    points: number
                }
                Update: {
                    category?: string
                    created_at?: string
                    id?: string
                    name?: string
                    name_ar?: string
                    points?: number
                }
                Relationships: []
            }
            badges: {
                Row: {
                    color: string
                    created_at: string
                    description: string | null
                    description_ar: string | null
                    icon: string
                    id: string
                    name: string
                    name_ar: string
                }
                Insert: {
                    color: string
                    created_at?: string
                    description?: string | null
                    description_ar?: string | null
                    icon: string
                    id?: string
                    name: string
                    name_ar: string
                }
                Update: {
                    color?: string
                    created_at?: string
                    description?: string | null
                    description_ar?: string | null
                    icon?: string
                    id?: string
                    name?: string
                    name_ar?: string
                }
                Relationships: []
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
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    committee_id: string | null
                    created_at: string
                    email: string
                    full_name: string | null
                    full_name_ar: string | null
                    id: string
                    level: string | null
                    phone: string | null
                    role: string | null
                    total_points: number | null
                    attended_mini_camp: boolean | null
                    attended_camp: boolean | null
                }
                Insert: {
                    avatar_url?: string | null
                    committee_id?: string | null
                    created_at?: string
                    email: string
                    full_name?: string | null
                    full_name_ar?: string | null
                    id: string
                    level?: string | null
                    phone?: string | null
                    role?: string | null
                    total_points?: number | null
                    attended_mini_camp?: boolean | null
                    attended_camp?: boolean | null
                }
                Update: {
                    avatar_url?: string | null
                    committee_id?: string | null
                    created_at?: string
                    email?: string
                    full_name?: string | null
                    full_name_ar?: string | null
                    id?: string
                    level?: string | null
                    phone?: string | null
                    role?: string | null
                    total_points?: number | null
                    attended_mini_camp?: boolean | null
                    attended_camp?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_committee_id_fkey"
                        columns: ["committee_id"]
                        isOneToOne: false
                        referencedRelation: "committees"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_badges: {
                Row: {
                    badge_id: string
                    created_at: string
                    earned_at: string
                    id: string
                    user_id: string
                }
                Insert: {
                    badge_id: string
                    created_at?: string
                    earned_at?: string
                    id?: string
                    user_id: string
                }
                Update: {
                    badge_id?: string
                    created_at?: string
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
                    }
                ]
            }
            user_roles: {
                Row: {
                    created_at: string
                    id: number
                    role: Database["public"]["Enums"]["app_role"]
                    user_id: string | null
                }
                Insert: {
                    created_at?: string
                    id?: number
                    role: Database["public"]["Enums"]["app_role"]
                    user_id?: string | null
                }
                Update: {
                    created_at?: string
                    id?: number
                    role?: Database["public"]["Enums"]["app_role"]
                    user_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_roles_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_leaderboard: {
                Args: {
                    committee_filter?: string | null
                    period_type: string
                    target_date: string
                }
                Returns: {
                    full_name: string
                    full_name_ar: string
                    level: string
                    total_points: number
                    volunteer_id: string
                }[]
            }
        }
        Enums: {
            app_role:
            | "admin"
            | "supervisor"
            | "committee_leader"
            | "volunteer"
            | "hr"
            | "head_hr"
            | "head_production"
            | "head_fourth_year"
            | "head_caravans"
            | "head_events"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
