import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const contactInfo = [
  {
    icon: Phone,
    title: 'Téléphone',
    lines: ['+221 77 123 45 67', '+221 33 867 89 00'],
    action: 'tel:+221771234567'
  },
  {
    icon: Mail,
    title: 'Email',
    lines: ['contact@boromdaradji.sn', 'commercial@boromdaradji.sn'],
    action: 'mailto:contact@boromdaradji.sn'
  },
  {
    icon: MapPin,
    title: 'Adresse',
    lines: ['123 Avenue Cheikh Anta Diop', 'Dakar, Sénégal'],
    action: null
  },
  {
    icon: Clock,
    title: 'Horaires',
    lines: ['Lun - Ven : 8h30 - 18h00', 'Sam : 9h00 - 13h00'],
    action: null
  }
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Votre message a été envoyé ! Nous vous répondrons rapidement.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <>
      <Helmet>
        <title>Contactez-nous | Borom Daradji - Agence Immobilière Dakar</title>
        <meta name="description" content="Contactez l'Agence Immobilière Borom Daradji à Dakar. Nous sommes à votre disposition pour tous vos projets immobiliers et travaux." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-navy py-20">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
                Contactez-nous
              </h1>
              <p className="text-primary-foreground/80 text-lg">
                Une question, un projet ? Notre équipe est à votre disposition 
                pour vous accompagner dans vos démarches immobilières.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Contact info */}
              <div className="space-y-6">
                {contactInfo.map((info) => (
                  <Card key={info.title} variant="service">
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <info.icon className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{info.title}</h3>
                          {info.lines.map((line, index) => (
                            info.action ? (
                              <a 
                                key={index}
                                href={info.action}
                                className="block text-muted-foreground hover:text-accent transition-colors"
                              >
                                {line}
                              </a>
                            ) : (
                              <p key={index} className="text-muted-foreground">{line}</p>
                            )
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Contact form */}
              <div className="lg:col-span-2">
                <Card variant="elevated">
                  <CardContent className="p-8">
                    <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                      Envoyez-nous un message
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          placeholder="Votre nom *"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                        <Input
                          type="email"
                          placeholder="Votre email *"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          type="tel"
                          placeholder="Votre téléphone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                        <Select 
                          value={formData.subject} 
                          onValueChange={(v) => setFormData({ ...formData, subject: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sujet *" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="achat">Projet d'achat</SelectItem>
                            <SelectItem value="vente">Mise en vente</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="travaux">Travaux / Rénovation</SelectItem>
                            <SelectItem value="estimation">Estimation gratuite</SelectItem>
                            <SelectItem value="autre">Autre demande</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        placeholder="Votre message *"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        rows={6}
                        required
                      />
                      <Button type="submit" variant="gold" size="lg">
                        Envoyer le message
                        <Send className="h-5 w-5" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Map placeholder */}
        <section className="h-96 bg-muted relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-accent mx-auto mb-4" />
              <p className="text-muted-foreground">
                123 Avenue Cheikh Anta Diop, Dakar
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
