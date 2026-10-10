import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Home, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { propertyTypes, transactionTypes, cities } from '@/data/properties';

export function SearchBar() {
  const navigate = useNavigate();
  const [type, setType] = useState<string>('');
  const [transaction, setTransaction] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (transaction) params.set('transaction', transaction);
    if (city) params.set('city', city);
    if (priceMax) params.set('priceMax', priceMax);
    navigate(`/biens?${params.toString()}`);
  };

  return (
    <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-xl p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Transaction type */}
        <Select value={transaction} onValueChange={setTransaction}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Acheter ou Louer" />
          </SelectTrigger>
          <SelectContent>
            {transactionTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Property type */}
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-12">
            <Home className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Type de bien" />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City */}
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="h-12">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ville" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price */}
        <Select value={priceMax} onValueChange={setPriceMax}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Budget max" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50000000">50 000 000 FCFA</SelectItem>
            <SelectItem value="100000000">100 000 000 FCFA</SelectItem>
            <SelectItem value="200000000">200 000 000 FCFA</SelectItem>
            <SelectItem value="500000000">500 000 000 FCFA</SelectItem>
            <SelectItem value="1000000000">1 000 000 000+ FCFA</SelectItem>
          </SelectContent>
        </Select>

        {/* Search button */}
        <Button 
          variant="gold" 
          size="lg"
          className="h-12"
          onClick={handleSearch}
        >
          <Search className="h-5 w-5 mr-2" />
          Rechercher
        </Button>
      </div>
    </div>
  );
}
