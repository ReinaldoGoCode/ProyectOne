import type { Category } from '@/domain/types'

/**
 * Categorías ficticias de la tienda. Los identificadores son estables porque
 * los productos los referencian; el `slug` es lo que viaja en la URL.
 *
 * La taxonomía sigue la de una tienda de ropa de tamaño medio (camisas,
 * camisetas, vestidos, pantalones, faldas y chaquetas), adaptada a un comercio
 * venezolano de barrio. Los nombres de las prendas son propios de Norte Moda.
 */
export const seedCategories: readonly Category[] = [
  {
    id: 'camisas',
    slug: 'camisas',
    name: 'Camisas',
    description: 'Camisas y blusas de lino, algodón y satén para el día a día.',
  },
  {
    id: 'camisetas',
    slug: 'camisetas',
    name: 'Camisetas',
    description: 'Franelas, camisetas básicas y tops de punto.',
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
  {
    id: 'faldas',
    slug: 'faldas',
    name: 'Faldas',
    description: 'Faldas midi, plisadas y de lino para combinar todo el año.',
  },
  {
    id: 'chaquetas',
    slug: 'chaquetas',
    name: 'Chaquetas',
    description: 'Chaquetas ligeras de denim y lino para las noches frescas.',
  },
]
