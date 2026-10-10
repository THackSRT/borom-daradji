import { Helmet } from 'react-helmet-async';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedProperties } from '@/components/home/FeaturedProperties';
import { ServicesSection } from '@/components/home/ServicesSection';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CTASection } from '@/components/home/CTASection';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Borom Daradji - Agence Immobilière à Dakar | Achat, Vente, Location</title>
        <meta name="description" content="Agence immobilière de référence au Sénégal. Vente et location de villas, appartements, terrains à Dakar. Travaux de construction et rénovation. Contactez-nous !" />
      </Helmet>
      
      <HeroSection />
      <FeaturedProperties />
      <ServicesSection />
      <WhyChooseUs />
      <CTASection />
    </>
  );
};

export default Index;
