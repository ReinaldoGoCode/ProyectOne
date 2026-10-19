import { describe, expect, it } from 'vitest'

import { seedCatalog } from '@/data/seed'

import {
  countActiveProducts,
  countActiveProductsByCategory,
  filterCatalog,
  isCatalogSort,
} from '../catalog'

const ALL = {
  categoryId: null,
  search: '',
  sort: 'novedades',
} as const

describe('filterCatalog', () => {
  it('excluye productos inactivos', () => {
    const result = filterCatalog(seedCatalog, ALL)
    const ids = result.map((product) => product.id)

    expect(result).toHaveLength(20)
    expect(ids).not.toContain('pantalon-wide-leg-valencia')
  })

  it('filtra por categoría', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, categoryId: 'vestidos' })

    expect(result).toHaveLength(4)
    expect(result.every((product) => product.categoryId === 'vestidos')).toBe(true)
  })

  it('busca sin acentos', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'paraguana' })

    expect(result.map((product) => product.name)).toEqual(['Vestido corto Paraguaná'])
  })

  it('busca dentro de la descripción', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'lino' })

    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result.every((product) => product.name.length > 0)).toBe(true)
  })

  it('busca por nombre de categoría', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'vestidos' })

    expect(result).toHaveLength(4)
  })

  it('busca por color de una variante', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'terracota' })

    expect(result.map((product) => product.name)).toEqual(['Vestido midi Canaima'])
  })

  it('combina términos con AND', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'camisa lino' })

    expect(result.map((product) => product.name)).toEqual(['Camisa de lino Margarita'])
  })

  it('ordena por precio ascendente y descendente', () => {
    const ascending = filterCatalog(seedCatalog, { ...ALL, sort: 'precio-asc' })
    const descending = filterCatalog(seedCatalog, { ...ALL, sort: 'precio-desc' })

    expect(ascending[0]?.priceCents).toBe(1400)
    expect(descending[0]?.priceCents).toBe(4800)
  })

  it('ordena por novedad usando la fecha de creación', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, sort: 'novedades' })

    expect(result[0]?.name).toBe('Jean recto Maracaibo')
  })

  it('devuelve una lista vacía si nada coincide', () => {
    const result = filterCatalog(seedCatalog, { ...ALL, search: 'traje de neopreno' })

    expect(result).toHaveLength(0)
  })
})

describe('conteos del catálogo', () => {
  it('cuenta solo productos activos', () => {
    expect(countActiveProducts(seedCatalog)).toBe(20)
  })

  it('cuenta las piezas activas por categoría', () => {
    const counts = countActiveProductsByCategory(seedCatalog)

    expect(counts.get('camisas')).toBe(4)
    expect(counts.get('camisetas')).toBe(3)
    expect(counts.get('vestidos')).toBe(4)
    expect(counts.get('pantalones')).toBe(4)
    expect(counts.get('faldas')).toBe(3)
    expect(counts.get('chaquetas')).toBe(2)
  })
})

describe('isCatalogSort', () => {
  it('acepta solo los órdenes conocidos', () => {
    expect(isCatalogSort('novedades')).toBe(true)
    expect(isCatalogSort('precio-asc')).toBe(true)
    expect(isCatalogSort('precio-desc')).toBe(true)
    expect(isCatalogSort('caros')).toBe(false)
    expect(isCatalogSort(null)).toBe(false)
  })
})
