import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { CHRISTMAS_CARD_CURATED_CASES } from './catalog'
import type { CcicCalculatedOrder } from './order'

export async function allocateCcicUsOrderInventory(orderId: string, calculated: CcicCalculatedOrder) {
  const quantities = new Map<string, number>()

  const add = (catalogId: string, quantityBoxes: number) => {
    if (!catalogId || quantityBoxes <= 0) return
    quantities.set(catalogId, (quantities.get(catalogId) ?? 0) + quantityBoxes)
  }

  for (const line of calculated.lines) {
    if (line.lineType === 'individual_box') {
      add(line.catalogId, line.quantity)
      continue
    }

    const curatedCase = CHRISTMAS_CARD_CURATED_CASES.find((item) => item.id === line.catalogId)
    if (!curatedCase) continue
    for (const component of curatedCase.components) {
      add(component.boxId, component.quantityBoxes * line.quantity)
    }
  }

  const allocations = [...quantities.entries()].map(([catalogId, quantityBoxes]) => ({
    catalogId,
    quantityBoxes,
  }))
  if (!allocations.length) return

  const admin = createAdminClient()
  const { error } = await admin.rpc('ccic_allocate_order_inventory', {
    p_order_id: orderId,
    p_allocations: allocations,
  })
  if (error) throw error
}
