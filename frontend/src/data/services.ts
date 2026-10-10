import { Building2, Home, Hammer, Package, Paintbrush, Wrench, Zap, Droplets, Wind, TreeDeciduous } from 'lucide-react';

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: any;
  features: string[];
}

export const mainServices: Service[] = [
  {
    id: 'achat-vente',
    title: 'Achat & Vente',
    description: 'Trouvez le bien de vos rêves ou vendez votre propriété au meilleur prix avec notre expertise du marché sénégalais.',
    icon: Home,
    features: ['Estimation gratuite', 'Accompagnement complet', 'Négociation experte', 'Conseil juridique']
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Gérez vos biens en toute sérénité ou trouvez la location idéale adaptée à vos besoins et budget.',
    icon: Building2,
    features: ['Gestion locative', 'État des lieux', 'Recherche personnalisée', 'Contrats sécurisés']
  },
  {
    id: 'travaux',
    title: 'Travaux & Rénovation',
    description: 'De la conception à la réalisation, nous transformons vos espaces avec des artisans qualifiés.',
    icon: Hammer,
    features: ['Devis gratuit', 'Suivi chantier', 'Garantie décennale', 'Finitions soignées']
  },
  {
    id: 'materiaux',
    title: 'Fourniture Matériaux',
    description: 'Accédez aux meilleurs matériaux de construction aux prix les plus compétitifs du marché.',
    icon: Package,
    features: ['Prix négociés', 'Livraison chantier', 'Large gamme', 'Conseil technique']
  }
];

export const constructionServices: Service[] = [
  {
    id: 'maconnerie',
    title: 'Maçonnerie & Gros Œuvre',
    description: 'Construction de fondations solides, murs porteurs, dalles et structures. Travail soigné avec des matériaux de qualité.',
    icon: Building2,
    features: ['Fondations', 'Élévation murs', 'Dalles béton', 'Escaliers']
  },
  {
    id: 'peinture',
    title: 'Peinture & Décoration',
    description: 'Finitions intérieures et extérieures avec des peintures professionnelles. Effets décoratifs et revêtements muraux.',
    icon: Paintbrush,
    features: ['Peinture intérieure', 'Ravalement façade', 'Effets décoratifs', 'Papier peint']
  },
  {
    id: 'plomberie',
    title: 'Plomberie Sanitaire',
    description: 'Installation et rénovation de vos systèmes d\'eau. Salles de bain, cuisine, réseau d\'eau.',
    icon: Droplets,
    features: ['Salle de bain', 'Cuisine', 'Réseau eau', 'Dépannage']
  },
  {
    id: 'electricite',
    title: 'Électricité',
    description: 'Mise aux normes, installation électrique complète, éclairage et domotique.',
    icon: Zap,
    features: ['Installation neuve', 'Mise aux normes', 'Éclairage LED', 'Domotique']
  },
  {
    id: 'menuiserie',
    title: 'Menuiserie & Ferronnerie',
    description: 'Portes, fenêtres, placards sur mesure en bois, aluminium ou fer forgé.',
    icon: Wrench,
    features: ['Portes & fenêtres', 'Placards', 'Fer forgé', 'Aluminium']
  },
  {
    id: 'climatisation',
    title: 'Climatisation & Ventilation',
    description: 'Installation et maintenance de systèmes de climatisation pour votre confort toute l\'année.',
    icon: Wind,
    features: ['Split', 'Gainable', 'Maintenance', 'Conseil énergétique']
  },
  {
    id: 'carrelage',
    title: 'Carrelage & Revêtements',
    description: 'Pose de carrelage, faïence, parquet et tous types de revêtements de sol.',
    icon: Package,
    features: ['Carrelage sol', 'Faïence murale', 'Parquet', 'Mosaïque']
  },
  {
    id: 'jardin',
    title: 'Aménagement Extérieur',
    description: 'Création de jardins, terrasses, piscines et espaces verts paysagers.',
    icon: TreeDeciduous,
    features: ['Jardins', 'Terrasses', 'Piscines', 'Clôtures']
  }
];

export interface Project {
  id: string;
  title: string;
  location: string;
  description: string;
  services: string[];
  beforeImage: string;
  afterImage: string;
  duration: string;
}

export const completedProjects: Project[] = [
  {
    id: '1',
    title: 'Rénovation Complète Villa Almadies',
    location: 'Dakar, Almadies',
    description: 'Rénovation totale d\'une villa de 300m² : modernisation cuisine et salles de bain, reprise électricité, peinture intégrale.',
    services: ['Plomberie', 'Électricité', 'Peinture', 'Carrelage'],
    beforeImage: 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=600',
    afterImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600',
    duration: '3 mois'
  },
  {
    id: '2',
    title: 'Construction Immeuble R+2',
    location: 'Diamniadio',
    description: 'Construction d\'un immeuble de 6 appartements avec parking souterrain et espaces verts.',
    services: ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie'],
    beforeImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600',
    afterImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600',
    duration: '14 mois'
  },
  {
    id: '3',
    title: 'Aménagement Bureau Corporate',
    location: 'Dakar, Plateau',
    description: 'Transformation d\'un plateau de 200m² en espace de travail moderne avec salle de réunion vitrée.',
    services: ['Cloisons', 'Électricité', 'Climatisation', 'Peinture'],
    beforeImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600',
    afterImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600',
    duration: '6 semaines'
  }
];
