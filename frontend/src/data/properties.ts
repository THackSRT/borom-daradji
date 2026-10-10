export type PropertyType = 'terrain' | 'maison' | 'appartement' | 'villa' | 'local';
export type TransactionType = 'vente' | 'location';

export interface Property {
  id: string;
  slug: string;
  title: string;
  type: PropertyType;
  transaction: TransactionType;
  price: number;
  surface: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  location: {
    city: string;
    neighborhood: string;
    address: string;
  };
  description: string;
  features: string[];
  images: string[];
  yearBuilt?: number;
  condition: 'neuf' | 'excellent' | 'bon' | 'à rénover';
  featured: boolean;
  createdAt: string;
}

export const properties: Property[] = [
  {
    id: '1',
    slug: 'villa-luxe-almadies',
    title: 'Villa de Luxe avec Piscine aux Almadies',
    type: 'villa',
    transaction: 'vente',
    price: 850000000,
    surface: 450,
    rooms: 8,
    bedrooms: 5,
    bathrooms: 4,
    location: {
      city: 'Dakar',
      neighborhood: 'Almadies',
      address: 'Route des Almadies'
    },
    description: 'Magnifique villa de standing avec vue sur mer, piscine privée et jardin tropical. Finitions haut de gamme, cuisine équipée américaine, suite parentale avec dressing. Idéale pour famille ou réception.',
    features: ['Piscine', 'Jardin', 'Garage 3 voitures', 'Cuisine équipée', 'Climatisation centrale', 'Système de sécurité', 'Vue mer'],
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'
    ],
    yearBuilt: 2021,
    condition: 'neuf',
    featured: true,
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    slug: 'appartement-standing-plateau',
    title: 'Appartement Standing 4 Pièces - Plateau',
    type: 'appartement',
    transaction: 'vente',
    price: 180000000,
    surface: 160,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    location: {
      city: 'Dakar',
      neighborhood: 'Plateau',
      address: 'Avenue Léopold Sédar Senghor'
    },
    description: 'Superbe appartement en plein cœur du Plateau, dans un immeuble sécurisé avec gardien 24h/24. Lumineux, traversant, balcon avec vue dégagée. Proche commerces et transports.',
    features: ['Ascenseur', 'Balcon', 'Parking souterrain', 'Gardien 24h', 'Interphone vidéo', 'Climatisation'],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800'
    ],
    yearBuilt: 2019,
    condition: 'excellent',
    featured: true,
    createdAt: '2024-01-20'
  },
  {
    id: '3',
    slug: 'terrain-viabilise-diamniadio',
    title: 'Terrain Viabilisé 500m² à Diamniadio',
    type: 'terrain',
    transaction: 'vente',
    price: 25000000,
    surface: 500,
    rooms: 0,
    bedrooms: 0,
    bathrooms: 0,
    location: {
      city: 'Diamniadio',
      neighborhood: 'Zone résidentielle',
      address: 'Pôle Urbain de Diamniadio'
    },
    description: 'Terrain prêt à construire dans la nouvelle ville de Diamniadio. Toutes les commodités à proximité : eau, électricité, routes goudronnées. Titre foncier disponible.',
    features: ['Titre foncier', 'Viabilisé', 'Clôturé', 'Accès goudronné', 'Proche commodités'],
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
      'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=800'
    ],
    condition: 'neuf',
    featured: true,
    createdAt: '2024-02-01'
  },
  {
    id: '4',
    slug: 'maison-familiale-sacre-coeur',
    title: 'Belle Maison Familiale à Sacré-Cœur 3',
    type: 'maison',
    transaction: 'vente',
    price: 320000000,
    surface: 280,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 3,
    location: {
      city: 'Dakar',
      neighborhood: 'Sacré-Cœur 3',
      address: 'Rue SC-47'
    },
    description: 'Maison familiale idéalement située dans un quartier calme et résidentiel. Jardin arboré, terrasse couverte, dépendance pour personnel de maison. Parfait état.',
    features: ['Jardin', 'Terrasse', 'Dépendance', 'Garage 2 voitures', 'Cuisine équipée', 'Buanderie'],
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800'
    ],
    yearBuilt: 2015,
    condition: 'excellent',
    featured: true,
    createdAt: '2024-02-05'
  },
  {
    id: '5',
    slug: 'appartement-f3-mermoz',
    title: 'Appartement F3 Moderne - Mermoz',
    type: 'appartement',
    transaction: 'location',
    price: 450000,
    surface: 85,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    location: {
      city: 'Dakar',
      neighborhood: 'Mermoz',
      address: 'Avenue Cheikh Anta Diop'
    },
    description: 'Bel appartement F3 entièrement rénové, idéal pour jeune couple ou professionnel. Proche universités et centres commerciaux. Lumineux et bien agencé.',
    features: ['Meublé', 'Climatisé', 'Cuisine équipée', 'Internet inclus', 'Parking'],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800'
    ],
    yearBuilt: 2020,
    condition: 'excellent',
    featured: true,
    createdAt: '2024-02-10'
  },
  {
    id: '6',
    slug: 'local-commercial-grand-yoff',
    title: 'Local Commercial 120m² - Grand Yoff',
    type: 'local',
    transaction: 'location',
    price: 800000,
    surface: 120,
    rooms: 2,
    bedrooms: 0,
    bathrooms: 1,
    location: {
      city: 'Dakar',
      neighborhood: 'Grand Yoff',
      address: 'Route de l\'Aéroport'
    },
    description: 'Local commercial idéalement placé sur un axe passant. Grande vitrine, arrière-boutique, sanitaires. Convient pour commerce, bureau ou showroom.',
    features: ['Grande vitrine', 'Arrière-boutique', 'Climatisation', 'Rideau métallique', 'Compteur séparé'],
    images: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'
    ],
    yearBuilt: 2018,
    condition: 'bon',
    featured: false,
    createdAt: '2024-02-15'
  },
  {
    id: '7',
    slug: 'villa-bord-mer-ngor',
    title: 'Villa Pieds dans l\'Eau - Ngor',
    type: 'villa',
    transaction: 'vente',
    price: 1200000000,
    surface: 600,
    rooms: 10,
    bedrooms: 6,
    bathrooms: 5,
    location: {
      city: 'Dakar',
      neighborhood: 'Ngor',
      address: 'Corniche des Almadies'
    },
    description: 'Exceptionnelle propriété les pieds dans l\'eau. Accès direct plage privée, piscine à débordement, pool house. Architecture contemporaine signée. Rare sur le marché.',
    features: ['Plage privée', 'Piscine à débordement', 'Pool house', 'Personnel de maison', 'Héliport', 'Cave à vin'],
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800'
    ],
    yearBuilt: 2022,
    condition: 'neuf',
    featured: true,
    createdAt: '2024-02-20'
  },
  {
    id: '8',
    slug: 'terrain-agricole-thies',
    title: 'Terrain Agricole 2 Hectares - Thiès',
    type: 'terrain',
    transaction: 'vente',
    price: 45000000,
    surface: 20000,
    rooms: 0,
    bedrooms: 0,
    bathrooms: 0,
    location: {
      city: 'Thiès',
      neighborhood: 'Keur Moussa',
      address: 'Route de Keur Moussa'
    },
    description: 'Vaste terrain agricole avec puits et système d\'irrigation. Sol fertile, idéal pour maraîchage ou arboriculture. Piste d\'accès praticable.',
    features: ['Puits', 'Irrigation', 'Clôture naturelle', 'Gardien sur place', 'Électricité proche'],
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800'
    ],
    condition: 'bon',
    featured: false,
    createdAt: '2024-02-25'
  },
  {
    id: '9',
    slug: 'appartement-luxe-fann-residence',
    title: 'Penthouse de Luxe - Fann Résidence',
    type: 'appartement',
    transaction: 'vente',
    price: 420000000,
    surface: 300,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 3,
    location: {
      city: 'Dakar',
      neighborhood: 'Fann Résidence',
      address: 'Corniche Ouest'
    },
    description: 'Penthouse d\'exception avec terrasse panoramique vue mer. Double hauteur sous plafond dans le séjour, finitions luxueuses, domotique complète. Prestige absolu.',
    features: ['Terrasse 100m²', 'Vue panoramique mer', 'Domotique', 'Jacuzzi', 'Cave', 'Double parking'],
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'
    ],
    yearBuilt: 2023,
    condition: 'neuf',
    featured: true,
    createdAt: '2024-03-01'
  },
  {
    id: '10',
    slug: 'maison-renovation-grand-dakar',
    title: 'Maison à Rénover - Grand Dakar',
    type: 'maison',
    transaction: 'vente',
    price: 85000000,
    surface: 200,
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    location: {
      city: 'Dakar',
      neighborhood: 'Grand Dakar',
      address: 'Rue GD-125'
    },
    description: 'Maison avec potentiel dans quartier en pleine transformation. Structure saine, toiture récente. Idéal investisseur pour rénovation ou transformation en immeuble de rapport.',
    features: ['Grand terrain', 'Possibilité extension', 'Quartier dynamique', 'Proche transports'],
    images: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
      'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=800'
    ],
    yearBuilt: 1985,
    condition: 'à rénover',
    featured: false,
    createdAt: '2024-03-05'
  },
  {
    id: '11',
    slug: 'studio-meuble-point-e',
    title: 'Studio Meublé Tout Équipé - Point E',
    type: 'appartement',
    transaction: 'location',
    price: 280000,
    surface: 35,
    rooms: 1,
    bedrooms: 0,
    bathrooms: 1,
    location: {
      city: 'Dakar',
      neighborhood: 'Point E',
      address: 'Rue de Diourbel'
    },
    description: 'Charmant studio parfaitement équipé pour étudiant ou jeune professionnel. Kitchenette, coin nuit, salle d\'eau moderne. Charges comprises.',
    features: ['Meublé', 'Équipé', 'Charges comprises', 'Internet fibre', 'Climatisation'],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'
    ],
    yearBuilt: 2021,
    condition: 'excellent',
    featured: false,
    createdAt: '2024-03-10'
  },
  {
    id: '12',
    slug: 'local-industriel-zone-franche',
    title: 'Entrepôt 800m² - Zone Franche',
    type: 'local',
    transaction: 'location',
    price: 2500000,
    surface: 800,
    rooms: 3,
    bedrooms: 0,
    bathrooms: 2,
    location: {
      city: 'Dakar',
      neighborhood: 'Zone Franche Industrielle',
      address: 'Lot 45, ZFID'
    },
    description: 'Grand entrepôt dans la zone franche industrielle. Quai de déchargement, bureau attenant, forte puissance électrique. Idéal logistique, stockage ou atelier.',
    features: ['Quai de déchargement', 'Bureau 50m²', 'Puissance 150 kVA', 'Accès poids lourds', 'Gardiennage 24h'],
    images: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800'
    ],
    yearBuilt: 2017,
    condition: 'bon',
    featured: false,
    createdAt: '2024-03-15'
  }
];

export const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'villa', label: 'Villa' },
  { value: 'local', label: 'Local commercial' }
];

export const transactionTypes: { value: TransactionType; label: string }[] = [
  { value: 'vente', label: 'Vente' },
  { value: 'location', label: 'Location' }
];

export const cities = ['Dakar', 'Thiès', 'Diamniadio', 'Saint-Louis', 'Mbour'];

export const neighborhoods = [
  'Almadies', 'Plateau', 'Sacré-Cœur', 'Mermoz', 'Fann', 'Point E', 
  'Ngor', 'Grand Yoff', 'Liberté', 'Ouakam', 'Yoff', 'Médina'
];

export function formatPrice(price: number, transaction: TransactionType): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(price);
  if (transaction === 'location') {
    return `${formatted} FCFA/mois`;
  }
  return `${formatted} FCFA`;
}

export function getPropertyBySlug(slug: string): Property | undefined {
  return properties.find(p => p.slug === slug);
}

export function getFeaturedProperties(): Property[] {
  return properties.filter(p => p.featured);
}
