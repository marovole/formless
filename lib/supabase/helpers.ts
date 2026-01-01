import { Database } from './database.types'

/**
 * Type-safe insert helper for Supabase tables
 * Use this to avoid @ts-ignore comments when inserting data
 */
export function createInsert<T extends keyof Database['public']['Tables']>(
  data: Database['public']['Tables'][T]['Insert']
): Database['public']['Tables'][T]['Insert'] {
  return data
}

/**
 * Type-safe update helper for Supabase tables
 * Use this to avoid @ts-ignore comments when updating data
 */
export function createUpdate<T extends keyof Database['public']['Tables']>(
  _table: T,
  data: Database['public']['Tables'][T]['Update']
): Database['public']['Tables'][T]['Update'] {
  return data
}

/**
 * Type-safe insert helper with table name for better type inference
 */
export function insertInto<T extends keyof Database['public']['Tables']>(
  _table: T,
  data: Database['public']['Tables'][T]['Insert']
): Database['public']['Tables'][T]['Insert'] {
  return data
}
