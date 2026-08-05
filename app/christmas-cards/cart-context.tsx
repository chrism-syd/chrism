'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'

type CartSummary = {
  totalSelectedBoxes: number
  estimatedTotalCents: number
  hasOrder: boolean
  currentCaseProgress: number
  boxesPerCase: number
}

type CartContextValue = {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  summary: CartSummary
  setSummary: (summary: CartSummary) => void
}

const EMPTY_SUMMARY: CartSummary = {
  totalSelectedBoxes: 0,
  estimatedTotalCents: 0,
  hasOrder: false,
  currentCaseProgress: 0,
  boxesPerCase: 32,
}

const CartContext = createContext<CartContextValue | null>(null)

export function CcicCartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [summary, setSummary] = useState<CartSummary>(EMPTY_SUMMARY)
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const value = useMemo<CartContextValue>(
    () => ({
      isOpen,
      openCart,
      closeCart,
      summary,
      setSummary,
    }),
    [closeCart, isOpen, openCart, summary]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCcicCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCcicCart must be used inside CcicCartProvider')
  return context
}

export function CcicCartButton() {
  const { isOpen, openCart, summary } = useCcicCart()
  const label = summary.hasOrder
    ? `Open order summary for ${summary.totalSelectedBoxes} boxes totaling ${formatChristmasCardMoney(summary.estimatedTotalCents)}`
    : 'Open order summary'

  return (
    <button
      type="button"
      className="ccic-header-cart-link"
      onClick={openCart}
      aria-label={label}
      aria-expanded={isOpen}
      aria-controls="ccic-cart-drawer"
    >
      <span className="ccic-cart-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
          <circle cx="10" cy="19" r="1.25" />
          <circle cx="17" cy="19" r="1.25" />
        </svg>
        {summary.totalSelectedBoxes > 0 ? <span className="ccic-cart-badge">{summary.totalSelectedBoxes}</span> : null}
      </span>
      <span className="ccic-header-cart-meta">
        <strong>{summary.totalSelectedBoxes > 0 ? `${summary.totalSelectedBoxes} boxes` : 'Cart'}</strong>
        <span>{summary.hasOrder ? formatChristmasCardMoney(summary.estimatedTotalCents) : 'Review order'}</span>
      </span>
    </button>
  )
}
