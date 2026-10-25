import { convertUsdCentsToVesCents, formatMoney, formatVesCents } from '@/domain/money'
import { useExchangeRate } from '@/app/providers/exchangeRateContext'

interface DualCurrencyPriceProps {
  readonly cents: number
  readonly className?: string
}

export function DualCurrencyPrice({ cents, className = '' }: DualCurrencyPriceProps) {
  const { rate } = useExchangeRate()

  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <span>{formatMoney(cents)}</span>
      {rate ? (
        <span className="text-xs font-normal text-stone-500">
          {formatVesCents(convertUsdCentsToVesCents(cents, rate.vesPerUsd))} Bs.
        </span>
      ) : null}
    </span>
  )
}
