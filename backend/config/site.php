<?php

/*
| Contenu par défaut du site vitrine, identique au site d'origine. Le dirigeant le modifie depuis
| « Site internet » dans le back-office ; seules ses modifications sont enregistrées
| (company_settings.site), le reste vient d'ici. Les images sont soit des URL, soit des chemins
| du disque « public ».
|
| Icônes disponibles : home, building, hammer, package, paintbrush, wrench, zap, droplets, wind, tree,
| users, award, check, key, shield, truck, phone, star.
*/

return [

    'identity' => [
        'tagline' => 'Agence Immobilière',
        // Masquer le nom quand le logo le contient déjà.
        'show_name' => true,
        'primary_color' => '#0d2f73',
        'accent_color' => '#cf7a0c',
    ],

    'seo' => [
        'title' => 'Borom Daradji — Agence immobilière à Dakar',
        'description' => 'Achat, vente, location, gestion locative, travaux et matériaux à Dakar et au Sénégal.',
    ],

    'contact' => [
        'title' => 'Contactez-nous',
        'hours' => [
            ['days' => 'Lun - Ven', 'hours' => '8h30 - 18h00'],
            ['days' => 'Sam', 'hours' => '9h00 - 13h00'],
        ],
        'intro' => "Une question, un projet ? Laissez-nous un message : un conseiller vous rappelle, au Sénégal comme à l'étranger.",
        'form_title' => 'Envoyez-nous un message',
        'form_text' => 'Nous vous répondons généralement dans la journée.',
        'subjects' => [
            "Projet d'achat",
            'Recherche de location',
            'Vendre ou mettre en location mon bien',
            'Gestion locative de mon bien',
            'Travaux / rénovation',
            'Matériaux de construction',
            'Autre demande',
        ],
    ],

    'social' => [
        'facebook' => '',
        'instagram' => '',
        'linkedin' => '',
        'tiktok' => '',
        'youtube' => '',
        'x' => '',
    ],

    'footer' => [
        'about' => 'Votre partenaire de confiance pour tous vos projets immobiliers et travaux de construction au Sénégal.',
        // Précédé de « © année Nom commercial. »
        'copyright' => 'Tous droits réservés.',
    ],

    // Pages « Mentions légales » et « Politique de confidentialité » : texte libre, un paragraphe par
    // ligne. Les mentions légales affichent en plus la raison sociale, le NINEA et le RCCM des Paramètres.
    'legal' => [
        'show_identifiers' => false,
        'notice' => "Hébergeur du site : à compléter.\nDirecteur de la publication : le dirigeant de l'agence.",
        'privacy' => "Les informations que vous nous envoyez par les formulaires du site (nom, téléphone, email, message) servent uniquement à vous recontacter et à suivre votre projet. Elles ne sont ni vendues ni cédées.\nElles sont conservées le temps nécessaire au suivi de votre demande, puis archivées ou supprimées.\nConformément à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, vous pouvez demander à consulter, corriger ou supprimer vos données en nous écrivant ou en nous appelant.",
    ],

    'home' => [
        'hero_badge' => "Leader de l'immobilier au Sénégal",
        'hero_title' => 'Votre projet immobilier commence',
        'hero_highlight' => 'ici',
        'hero_subtitle' => "Achat, vente, location ou travaux de rénovation : l'Agence Immobilière Borom Daradji vous accompagne dans tous vos projets avec expertise et passion.",
        'hero_image' => null,
        'show_featured' => true,
        'featured_kicker' => 'Nos biens en vedette',
        'featured_title' => 'Découvrez nos meilleures offres',
        'show_services' => true,
        'services_kicker' => 'Nos Services',
        'services_title' => 'Un accompagnement complet pour vos projets',
        'services_subtitle' => 'De la recherche de votre bien idéal à la réalisation de vos travaux, nous vous accompagnons à chaque étape.',
        'services' => [
            ['icon' => 'home', 'title' => 'Achat & Vente', 'description' => 'Trouvez le bien de vos rêves ou vendez votre propriété au meilleur prix avec notre expertise du marché sénégalais.', 'features' => ['Estimation gratuite', 'Accompagnement complet', 'Négociation experte']],
            ['icon' => 'building', 'title' => 'Location', 'description' => 'Gérez vos biens en toute sérénité ou trouvez la location idéale adaptée à vos besoins et budget.', 'features' => ['Gestion locative', 'État des lieux', 'Recherche personnalisée']],
            ['icon' => 'hammer', 'title' => 'Travaux & Rénovation', 'description' => 'De la conception à la réalisation, nous transformons vos espaces avec des artisans qualifiés.', 'features' => ['Devis gratuit', 'Suivi chantier', 'Finitions soignées']],
            ['icon' => 'package', 'title' => 'Fourniture Matériaux', 'description' => 'Accédez aux meilleurs matériaux de construction aux prix les plus compétitifs du marché.', 'features' => ['Prix négociés', 'Livraison chantier', 'Conseil technique']],
        ],
        'show_why' => true,
        'why_kicker' => 'Pourquoi Nous Choisir',
        'why_title' => 'Votre partenaire de confiance depuis 15 ans',
        'why_text' => "L'Agence Immobilière Borom Daradji met son expertise et son réseau au service de vos projets immobiliers. Notre engagement : vous accompagner avec professionnalisme et transparence.",
        'why_points' => [
            'Expertise du marché sénégalais',
            'Accompagnement personnalisé',
            'Transparence totale',
            'Réseau de partenaires qualifiés',
            'Service après-vente',
            'Estimation gratuite',
        ],
        'stats' => [
            ['icon' => 'building', 'value' => '500+', 'label' => 'Biens vendus'],
            ['icon' => 'users', 'value' => '1200+', 'label' => 'Clients satisfaits'],
            ['icon' => 'award', 'value' => '15', 'label' => "Années d'expérience"],
            ['icon' => 'check', 'value' => '98%', 'label' => 'Taux de satisfaction'],
        ],
        'show_cta' => true,
        'cta_property_title' => 'Vous vendez ou cherchez un bien ?',
        'cta_property_text' => "Bénéficiez d'une estimation gratuite et d'un accompagnement personnalisé pour votre projet immobilier.",
        'cta_property_button' => 'Estimation gratuite',
        'cta_works_title' => 'Un projet de travaux ?',
        'cta_works_text' => 'Construction, rénovation, aménagement... Nos équipes qualifiées réalisent vos travaux avec professionnalisme.',
        'cta_works_button' => 'Demander un devis',
    ],

    'works' => [
        'kicker' => 'Travaux & Rénovation',
        'hero_title' => 'Vos projets de construction avec des professionnels qualifiés',
        'hero_subtitle' => "De la conception à la réalisation, notre équipe d'artisans expérimentés transforme vos espaces avec qualité et professionnalisme.",
        'services_title' => 'Tous les corps de métier pour vos travaux',
        'services_subtitle' => 'Une équipe complète d\'artisans qualifiés pour réaliser l\'ensemble de vos travaux de construction et rénovation.',
        'services' => [
            ['icon' => 'building', 'title' => 'Maçonnerie & Gros Œuvre', 'description' => 'Construction de fondations solides, murs porteurs, dalles et structures. Travail soigné avec des matériaux de qualité.', 'features' => ['Fondations', 'Élévation murs', 'Dalles béton', 'Escaliers']],
            ['icon' => 'paintbrush', 'title' => 'Peinture & Décoration', 'description' => 'Finitions intérieures et extérieures avec des peintures professionnelles. Effets décoratifs et revêtements muraux.', 'features' => ['Peinture intérieure', 'Ravalement façade', 'Effets décoratifs', 'Papier peint']],
            ['icon' => 'droplets', 'title' => 'Plomberie Sanitaire', 'description' => "Installation et rénovation de vos systèmes d'eau. Salles de bain, cuisine, réseau d'eau.", 'features' => ['Salle de bain', 'Cuisine', 'Réseau eau', 'Dépannage']],
            ['icon' => 'zap', 'title' => 'Électricité', 'description' => 'Mise aux normes, installation électrique complète, éclairage et domotique.', 'features' => ['Installation neuve', 'Mise aux normes', 'Éclairage LED', 'Domotique']],
            ['icon' => 'wrench', 'title' => 'Menuiserie & Ferronnerie', 'description' => 'Portes, fenêtres, placards sur mesure en bois, aluminium ou fer forgé.', 'features' => ['Portes & fenêtres', 'Placards', 'Fer forgé', 'Aluminium']],
            ['icon' => 'wind', 'title' => 'Climatisation & Ventilation', 'description' => "Installation et maintenance de systèmes de climatisation pour votre confort toute l'année.", 'features' => ['Split', 'Gainable', 'Maintenance', 'Conseil énergétique']],
            ['icon' => 'package', 'title' => 'Carrelage & Revêtements', 'description' => 'Pose de carrelage, faïence, parquet et tous types de revêtements de sol.', 'features' => ['Carrelage sol', 'Faïence murale', 'Parquet', 'Mosaïque']],
            ['icon' => 'tree', 'title' => 'Aménagement Extérieur', 'description' => 'Création de jardins, terrasses, piscines et espaces verts paysagers.', 'features' => ['Jardins', 'Terrasses', 'Piscines', 'Clôtures']],
        ],
        'show_projects' => true,
        'projects_title' => 'Avant / Après : découvrez nos chantiers',
        'projects' => [
            ['title' => 'Rénovation Complète Villa Almadies', 'location' => 'Dakar, Almadies', 'duration' => '3 mois', 'description' => "Rénovation totale d'une villa de 300m² : modernisation cuisine et salles de bain, reprise électricité, peinture intégrale.", 'services' => ['Plomberie', 'Électricité', 'Peinture', 'Carrelage'], 'before_image' => 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=600', 'after_image' => 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600'],
            ['title' => 'Construction Immeuble R+2', 'location' => 'Diamniadio', 'duration' => '14 mois', 'description' => "Construction d'un immeuble de 6 appartements avec parking souterrain et espaces verts.", 'services' => ['Maçonnerie', 'Plomberie', 'Électricité', 'Menuiserie'], 'before_image' => 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600', 'after_image' => 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600'],
            ['title' => 'Aménagement Bureau Corporate', 'location' => 'Dakar, Plateau', 'duration' => '6 semaines', 'description' => "Transformation d'un plateau de 200m² en espace de travail moderne avec salle de réunion vitrée.", 'services' => ['Cloisons', 'Électricité', 'Climatisation', 'Peinture'], 'before_image' => 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600', 'after_image' => 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600'],
        ],
        'quote_title' => 'Décrivez votre projet, nous vous répondons sous 24h',
        'quote_text' => 'Remplissez le formulaire ci-contre pour recevoir un devis personnalisé et gratuit. Notre équipe vous contactera rapidement pour discuter de votre projet et vous proposer les meilleures solutions.',
        'commitments' => [
            'Estimation gratuite et sans engagement',
            'Réponse sous 24 heures',
            'Visite sur site offerte',
            'Garantie décennale sur tous les travaux',
        ],
    ],

];
