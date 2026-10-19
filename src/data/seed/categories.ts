import type { Category } from '@/domain/types'

/**
 * Categorías ficticias de la tienda. Los identificadores son estables porque
 * los productos los referencian; el `slug` es lo que viaja en la URL.
 */
export const seedCategories: readonly Category[] = [
  {
    id: 'camisas',
    slug: 'camisas',
    name: 'Camisas',
    description: 'Camisas y franelas de lino, algodón y piqué para el día a día.',
  },
  {
    id: 'vestidos',
    slug: 'vestidos',
    name: 'Vestidos',
    description: 'Vestidos cortos, midi y largos en telas frescas.',
  },
  {
    id: 'pantalones',
    slug: 'pantalones',
    name: 'Pantalones',
    description: 'Pantalones de vestir, cargo y jean con cortes cómodos.',
  },
]
