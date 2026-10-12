import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedProperties } from '@/components/home/FeaturedProperties';
import { ServicesSection } from '@/components/home/ServicesSection';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CTASection } from '@/components/home/CTASection';
import { useSiteData } from '@/components/site/SiteProvider';

// Titre et description : ceux du référencement (SiteProvider). Chaque bloc peut être masqué dans le back-office.
const Index = () => {
  const { home } = useSiteData().content;
  return (
    <>
      <HeroSection />
      {home.show_featured && <FeaturedProperties />}
      {home.show_services && home.services.length > 0 && <ServicesSection />}
      {home.show_why && <WhyChooseUs />}
      {home.show_cta && <CTASection />}
    </>
  );
};

export default Index;
