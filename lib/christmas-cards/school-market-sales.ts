import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { CHRISTMAS_CARD_MIXED_BOXES } from './catalog'

export type CcicSchoolMarketSale = {
  school_slug: string
  event_key: string
  event_name: string
  sale_date: string
  catalog_id: string
  boxes_sold: number
  unit_price_cents: number | null
  school_earnings_per_box_cents: number
  payment_method: string | null
}

/** Separate from online orders: these boxes were handed to buyers at the event. */
export async function loadCcicSchoolMarketSales(schoolSlug?: string): Promise<CcicSchoolMarketSale[]> {
  const admin = createAdminClient()
  const baseQuery = admin
    .from('ccic_school_market_sales')
    .select('school_slug,event_key,event_name,sale_date,catalog_id,boxes_sold,unit_price_cents,school_earnings_per_box_cents,payment_method')
  const query = schoolSlug ? baseQuery.eq('school_slug', schoolSlug) : baseQuery
  const { data, error } = await query
    .order('sale_date', { ascending: true })
    .order('event_key', { ascending: true })
    .order('catalog_id', { ascending: true })
    .limit(1000)

  if (error) throw new Error(`Unable to load CCIC in-person school sales: ${error.message}`)
  if (data?.length === 1000) throw new Error('In-person school sales exceed the report limit; pagination is required')
  return (data ?? []) as CcicSchoolMarketSale[]
}

export function summarizeCcicSchoolMarketSales(rows: readonly CcicSchoolMarketSale[]) {
  return {
    boxes: rows.reduce((total, row) => total + row.boxes_sold, 0),
    salesCents: rows.some((row) => row.unit_price_cents === null)
      ? null
      : rows.reduce((total, row) => total + row.boxes_sold * (row.unit_price_cents ?? 0), 0),
    schoolEarningsCents: rows.reduce(
      (total, row) => total + row.boxes_sold * row.school_earnings_per_box_cents, 0
    ),
  }
}

export function ccicSchoolMarketCollectionName(catalogId: string) {
  const collection = CHRISTMAS_CARD_MIXED_BOXES.find((item) => item.id === catalogId)
  return collection?.title ?? catalogId
}
