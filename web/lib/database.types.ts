
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "bin_id": string | null,"closed_at": string | null,"company_id": string | null,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"message": string,"opened_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_id"?: string | null,"closed_at"?: string | null,"company_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"message": string,"opened_at"?: string
                  }
                  Update: {
                    "bin_id"?: string | null,"closed_at"?: string | null,"company_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"message"?: string,"opened_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_bin_id_fkey"
      columns: ["bin_id"]
isOneToOne: false
      referencedRelation: "bins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"auditor_assignments": {
                  Row: {
                    "auditor_id": string,"company_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auditor_id": string,"company_id": string,"created_at"?: string
                  }
                  Update: {
                    "auditor_id"?: string,"company_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auditor_assignments_auditor_id_fkey"
      columns: ["auditor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "auditor_assignments_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"bin_scores": {
                  Row: {
                    "bin_id": string,"created_at": string,"day": string,"reasons": NonNullable<Json>,"scans_considered": number,"score": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_id": string,"created_at"?: string,"day": string,"reasons"?: NonNullable<Json>,"scans_considered"?: number,"score": number
                  }
                  Update: {
                    "bin_id"?: string,"created_at"?: string,"day"?: string,"reasons"?: NonNullable<Json>,"scans_considered"?: number,"score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bin_scores_bin_id_fkey"
      columns: ["bin_id"]
isOneToOne: false
      referencedRelation: "bins"
      referencedColumns: ["id"]
    }
                  ]
                },"bins": {
                  Row: {
                    "archived_at": string | null,"allow_backfill": boolean,"chain_head": string,"city": string,"company_id": string,"created_at": string,"id": string,"is_demo": boolean,"last_seen": string | null,"last_sequence": number,"public_key": string,"status": Database["public"]['Enums']["bin_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"allow_backfill"?: boolean,"chain_head": string,"city": string,"company_id": string,"created_at"?: string,"id": string,"is_demo"?: boolean,"last_seen"?: string | null,"last_sequence"?: number,"public_key": string,"status"?: Database["public"]['Enums']["bin_status"]
                  }
                  Update: {
                    "archived_at"?: string | null,"allow_backfill"?: boolean,"chain_head"?: string,"city"?: string,"company_id"?: string,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"last_seen"?: string | null,"last_sequence"?: number,"public_key"?: string,"status"?: Database["public"]['Enums']["bin_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "bins_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"checkpoints": {
                  Row: {
                    "created_at": string,"day": string,"hash": string,"previous_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"hash": string,"previous_hash"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"hash"?: string,"previous_hash"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"is_demo": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"name": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_totals": {
                  Row: {
                    "bin_id": string,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"day": string,"scan_count": number,"weight_g": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_id": string,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"day": string,"scan_count"?: number,"weight_g"?: number
                  }
                  Update: {
                    "bin_id"?: string,"category"?: Database["public"]['Enums']["epr_category"],"company_id"?: string,"day"?: string,"scan_count"?: number,"weight_g"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_totals_bin_id_fkey"
      columns: ["bin_id"]
isOneToOne: false
      referencedRelation: "bins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_totals_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"erasures": {
                  Row: {
                    "bin_ids": string[],"company_id": string,"company_name": string,"erased_at": string,"erased_by": string | null,"id": string,"product_count": number,"reason": string,"report_count": number,"scan_count": number,"user_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_ids"?: string[],"company_id": string,"company_name": string,"erased_at"?: string,"erased_by"?: string | null,"id"?: string,"product_count"?: number,"reason": string,"report_count"?: number,"scan_count"?: number,"user_count"?: number
                  }
                  Update: {
                    "bin_ids"?: string[],"company_id"?: string,"company_name"?: string,"erased_at"?: string,"erased_by"?: string | null,"id"?: string,"product_count"?: number,"reason"?: string,"report_count"?: number,"scan_count"?: number,"user_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"forecasts": {
                  Row: {
                    "as_of": string,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"created_at": string,"financial_year": string,"high_kg": number,"low_kg": number,"projected_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "as_of": string,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"created_at"?: string,"financial_year": string,"high_kg": number,"low_kg": number,"projected_kg": number
                  }
                  Update: {
                    "as_of"?: string,"category"?: Database["public"]['Enums']["epr_category"],"company_id"?: string,"created_at"?: string,"financial_year"?: string,"high_kg"?: number,"low_kg"?: number,"projected_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "forecasts_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"insights": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"kind": string,"payload": NonNullable<Json>,"scan_filter": NonNullable<Json>,"sentence": string | null,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"scan_filter"?: NonNullable<Json>,"sentence"?: string | null,"week_start": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"scan_filter"?: NonNullable<Json>,"sentence"?: string | null,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "insights_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "archived_at": string | null,"approved": boolean,"barcode": string | null,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"created_at": string,"id": string,"name": string,"product_code": string,"unit_weight_g": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"approved"?: boolean,"barcode"?: string | null,"category": Database["public"]['Enums']["epr_category"],"company_id": string,"created_at"?: string,"id"?: string,"name": string,"product_code"?: string,"unit_weight_g": number
                  }
                  Update: {
                    "archived_at"?: string | null,"approved"?: boolean,"barcode"?: string | null,"category"?: Database["public"]['Enums']["epr_category"],"company_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"product_code"?: string,"unit_weight_g"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "company_id": string | null,"created_at": string,"full_name": string | null,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id"?: string | null,"created_at"?: string,"full_name"?: string | null,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  Update: {
                    "company_id"?: string | null,"created_at"?: string,"full_name"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"qr_batches": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_batches_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "qr_batches_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"qr_codes": {
                  Row: {
                    "batch_id": string,"created_at": string,"product_id": string,"redeemed_at": string | null,"serial": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"created_at"?: string,"product_id": string,"redeemed_at"?: string | null,"serial": string
                  }
                  Update: {
                    "batch_id"?: string,"created_at"?: string,"product_id"?: string,"redeemed_at"?: string | null,"serial"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_codes_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "qr_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qr_codes_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"rejected_scans": {
                  Row: {
                    "bin_id": string | null,"id": string,"reason": string,"received_at": string,"record_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_id"?: string | null,"id"?: string,"reason": string,"received_at"?: string,"record_text"?: string | null
                  }
                  Update: {
                    "bin_id"?: string | null,"id"?: string,"reason"?: string,"received_at"?: string,"record_text"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "barcode_kg": number | null,"category": Database["public"]['Enums']["epr_category"],"checkpoint_day": string | null,"checkpoint_hash": string | null,"company_id": string,"created_at": string,"created_by": string | null,"fingerprint": string,"id": string,"pdf_sha256": string | null,"period_end": string,"period_start": string,"qr_kg": number | null,"scan_count": number | null,"storage_path": string | null,"under_review_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode_kg"?: number | null,"category": Database["public"]['Enums']["epr_category"],"checkpoint_day"?: string | null,"checkpoint_hash"?: string | null,"company_id": string,"created_at"?: string,"created_by"?: string | null,"fingerprint": string,"id"?: string,"pdf_sha256"?: string | null,"period_end": string,"period_start": string,"qr_kg"?: number | null,"scan_count"?: number | null,"storage_path"?: string | null,"under_review_count"?: number | null
                  }
                  Update: {
                    "barcode_kg"?: number | null,"category"?: Database["public"]['Enums']["epr_category"],"checkpoint_day"?: string | null,"checkpoint_hash"?: string | null,"company_id"?: string,"created_at"?: string,"created_by"?: string | null,"fingerprint"?: string,"id"?: string,"pdf_sha256"?: string | null,"period_end"?: string,"period_start"?: string,"qr_kg"?: number | null,"scan_count"?: number | null,"storage_path"?: string | null,"under_review_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_checkpoint_day_fkey"
      columns: ["checkpoint_day"]
isOneToOne: false
      referencedRelation: "checkpoints"
      referencedColumns: ["day"]
    },{
      foreignKeyName: "reports_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"scan_flags": {
                  Row: {
                    "created_at": string,"reason": string,"scan_id": string,"severity": Database["public"]['Enums']["flag_severity"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"reason": string,"scan_id": string,"severity": Database["public"]['Enums']["flag_severity"]
                  }
                  Update: {
                    "created_at"?: string,"reason"?: string,"scan_id"?: string,"severity"?: Database["public"]['Enums']["flag_severity"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "scan_flags_scan_id_fkey"
      columns: ["scan_id"]
isOneToOne: false
      referencedRelation: "scans"
      referencedColumns: ["id"]
    }
                  ]
                },"scans": {
                  Row: {
                    "bin_id": string,"category": Database["public"]['Enums']["epr_category"] | null,"chain_hash": string,"code": string,"code_type": Database["public"]['Enums']["scan_code_type"],"company_id": string,"id": string,"insertion_order": number,"prev_chain_hash": string,"product_id": string | null,"received_at": string,"record_hash": string,"record_text": string,"scanned_at": string,"sequence": number,"signature": string,"weight_g": number,"weight_ok": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bin_id": string,"category"?: Database["public"]['Enums']["epr_category"] | null,"chain_hash": string,"code": string,"code_type": Database["public"]['Enums']["scan_code_type"],"company_id": string,"id"?: string,"insertion_order"?: never,"prev_chain_hash": string,"product_id"?: string | null,"received_at"?: string,"record_hash": string,"record_text": string,"scanned_at": string,"sequence": number,"signature": string,"weight_g": number,"weight_ok"?: boolean | null
                  }
                  Update: {
                    "bin_id"?: string,"category"?: Database["public"]['Enums']["epr_category"] | null,"chain_hash"?: string,"code"?: string,"code_type"?: Database["public"]['Enums']["scan_code_type"],"company_id"?: string,"id"?: string,"insertion_order"?: never,"prev_chain_hash"?: string,"product_id"?: string | null,"received_at"?: string,"record_hash"?: string,"record_text"?: string,"scanned_at"?: string,"sequence"?: number,"signature"?: string,"weight_g"?: number,"weight_ok"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scans_bin_id_fkey"
      columns: ["bin_id"]
isOneToOne: false
      referencedRelation: "bins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scans_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scans_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"targets": {
                  Row: {
                    "category": Database["public"]['Enums']["epr_category"],"company_id": string,"financial_year": string,"target_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["epr_category"],"company_id": string,"financial_year": string,"target_kg": number
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["epr_category"],"company_id"?: string,"financial_year"?: string,"target_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "targets_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_reject_scan":
{ Args: { "p_bin_id": string,"p_reason": string,"p_received_at": string,"p_record": string }; Returns: Json
                           },
"_report_scan_ids":
{ Args: { "p_category": Database["public"]['Enums']["epr_category"],"p_checkpoint_day": string,"p_company_id": string,"p_from": string,"p_to": string }; Returns: {
              "scan_id": string
            }[]
                           },
"_report_snapshot":
{ Args: { "p_category": Database["public"]['Enums']["epr_category"],"p_checkpoint_day": string,"p_company_id": string,"p_from": string,"p_to": string }; Returns: {
              "barcode_kg": number,"checkpoint_day": string,"checkpoint_hash": string,"fingerprint": string,"qr_kg": number,"scan_count": number,"under_review_count": number
            }[]
                           },
"attach_report_pdf":
{ Args: { "p_pdf_sha256": string,"p_report_id": string,"p_storage_path": string }; Returns: undefined
                           },
"can_join_topic":
{ Args: { "p_topic": string }; Returns: boolean
                           },
"can_see_company":
{ Args: { "p_company_id": string }; Returns: boolean
                           },
"create_report":
{ Args: { "p_category": Database["public"]['Enums']["epr_category"],"p_from": string,"p_to": string }; Returns: {
              "barcode_kg": number | null,
"category": Database["public"]['Enums']["epr_category"],
"checkpoint_day": string | null,
"checkpoint_hash": string | null,
"company_id": string,
"created_at": string,
"created_by": string | null,
"fingerprint": string,
"id": string,
"pdf_sha256": string | null,
"period_end": string,
"period_start": string,
"qr_kg": number | null,
"scan_count": number | null,
"storage_path": string | null,
"under_review_count": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "reports"
        isOneToOne: true
        isSetofReturn: false
      } },
"fy_label":
{ Args: { "p_day": string }; Returns: string
                           },
"get_bin_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "bin_id": string,"city": string,"company_id": string,"is_demo": boolean,"last_seen": string,"last_sequence": number,"open_alerts": number,"score_day": string,"status": Database["public"]['Enums']["bin_status"],"trust_reasons": Json,"trust_score": number
            }[]
                           },
"get_kpis_by_category":
{ Args: { "p_company_id"?: string,"p_from": string,"p_to": string }; Returns: {
              "category": Database["public"]['Enums']["epr_category"],"collected_kg": number,"gap_kg": number,"progress_pct": number,"scan_count": number,"target_kg": number
            }[]
                           },
"get_monthly_trend":
{ Args: { "p_company_id"?: string,"p_from": string,"p_to": string }; Returns: {
              "category": Database["public"]['Enums']["epr_category"],"collected_kg": number,"month": string,"scan_count": number
            }[]
                           },
"admin_scan_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"kind": string,"scans": number
            }[]
                           },
"erase_company":
{ Args: { "p_company_id": string,"p_confirm_name": string,"p_reason": string }; Returns: Json
                           },
"get_public_erasures":
{ Args: Record<PropertyKey, never>; Returns: {
              "bin_ids": string[],"company_name": string,"erased_at": string,"scan_count": number
            }[]
                           },
"get_public_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_bins": number,"by_category": Json,"cities": number,"total_kg": number,"total_scans": number
            }[]
                           },
"get_report_snapshot":
{ Args: { "p_category": Database["public"]['Enums']["epr_category"],"p_from": string,"p_to": string }; Returns: {
              "barcode_kg": number,"checkpoint_day": string,"checkpoint_hash": string,"fingerprint": string,"qr_kg": number,"scan_count": number,"under_review_count": number
            }[]
                           },
"ingest_scan":
{ Args: { "p_received_at"?: string,"p_record": string,"p_signature": string }; Returns: Json
                           },
"issue_qr_codes":
{ Args: { "p_product_id": string,"p_quantity": number }; Returns: {
              "batch_id": string,"qr_payload": string,"qr_serial": string
            }[]
                           },
"log_rejection":
{ Args: { "p_bin_id": string,"p_reason": string,"p_record": string }; Returns: undefined
                           },
"make_checkpoint":
{ Args: { "p_day"?: string }; Returns: {
              "created_at": string,
"day": string,
"hash": string,
"previous_hash": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "checkpoints"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_offline_bins":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_company":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"record_heartbeat":
{ Args: { "p_bin_id": string }; Returns: Json
                           },
"try_uuid":
{ Args: { "p_value": string }; Returns: string
                           },
"verify_chain":
{ Args: { "p_bin_id": string }; Returns: {
              "failing_scan": string,"ok": boolean,"reason": string,"scans_checked": number
            }[]
                           },
"verify_report":
{ Args: { "p_report_id": string }; Returns: Json
                           }
          }
          Enums: {
            "alert_kind": "bin_offline"|"sequence_gap"|"anomaly"|"target_at_risk"|"chain_break","bin_status": "active"|"revoked","epr_category": "cat1_rigid"|"cat2_flexible"|"cat3_multilayer"|"cat4_compostable","flag_severity": "low"|"medium"|"high","scan_code_type": "qr"|"barcode","user_role": "company"|"auditor"|"regulator"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "alert_kind": ["bin_offline", "sequence_gap", "anomaly", "target_at_risk", "chain_break"],"bin_status": ["active", "revoked"],"epr_category": ["cat1_rigid", "cat2_flexible", "cat3_multilayer", "cat4_compostable"],"flag_severity": ["low", "medium", "high"],"scan_code_type": ["qr", "barcode"],"user_role": ["company", "auditor", "regulator", "admin"]
          }
        }
} as const
