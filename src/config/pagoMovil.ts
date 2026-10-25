export const PAGO_MOVIL_DETAILS = [
  { key: 'holderId', label: 'Cédula o RIF del titular', value: 'V-14082115' },
  { key: 'bank', label: 'Banco receptor', value: 'Banco Venezolano de Crédito' },
  { key: 'phone', label: 'Teléfono de Pago Móvil', value: '0412-3095646' },
] as const

export const PAGO_MOVIL_INSTRUCTIONS = [
  'Pago Móvil',
  'Banco: Banco Venezolano de Crédito',
  'Cédula o RIF: V-14082115',
  'Teléfono: 0412-3095646',
  'Usa únicamente el total en bolívares mostrado en el checkout y revisa la fecha de vigencia de la tasa BCV antes de transferir.',
].join('\n')

export const PAGO_MOVIL_RATE_NOTICE =
  'El equivalente en bolívares usa el feed público de DolarVZLA para la tasa BCV y la fecha de vigencia guardada con el pedido. Compara ambos datos con el portal oficial antes de transferir.'

export function parsePagoMovilDetails(instructions: string) {
  const values = new Map<string, string>()
  for (const line of instructions.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const label = line
      .slice(0, separator)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (!value) continue
    if (label.startsWith('cedula') && label.includes('rif')) values.set('holderId', value)
    else if (label.startsWith('banco')) values.set('bank', value)
    else if (label.startsWith('telefono')) values.set('phone', value)
  }
  const holderId = values.get('holderId')
  const bank = values.get('bank')
  const phone = values.get('phone')
  if (!holderId || !bank || !phone) return null
  return [
    { key: 'holderId', label: 'Cédula o RIF del titular', value: holderId },
    { key: 'bank', label: 'Banco receptor', value: bank },
    { key: 'phone', label: 'Teléfono de Pago Móvil', value: phone },
  ] as const
}
