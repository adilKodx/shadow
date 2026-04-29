import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps', '1');
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  name?: string;
  placeId?: string;
}

interface Props {
  value?: string;
  placeholder?: string;
  onSelect: (place: PlaceResult) => void;
  className?: string;
  autoFocus?: boolean;
}

export default function PlacesAutocomplete({
  value = '',
  placeholder = 'Search for an address or place…',
  onSelect,
  className = '',
  autoFocus,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        const google = (window as any).google;
        serviceRef.current = new google.maps.places.AutocompleteService();
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        const dummy = document.createElement('div');
        placesServiceRef.current = new google.maps.places.PlacesService(dummy);
        setReady(true);
      })
      .catch((e) => console.error('Google Maps failed to load:', e));
  }, []);

  useEffect(() => {
    if (!ready || !serviceRef.current || !query || query.length < 2) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      serviceRef.current.getPlacePredictions(
        {
          input: query,
          sessionToken: sessionTokenRef.current,
        },
        (results: any[] | null) => {
          setLoading(false);
          setPredictions(results || []);
        }
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [query, ready]);

  const handlePick = (prediction: any) => {
    const google = (window as any).google;
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry', 'name'],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: string) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
        const result: PlaceResult = {
          address: place.formatted_address || prediction.description,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          name: place.name,
          placeId: prediction.place_id,
        };
        setQuery(result.address);
        setPredictions([]);
        setOpen(false);
        // Start a new session token for the next search
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        onSelect(result);
      }
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && <Loader2 className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>
      {open && predictions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(p)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-100 last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-gray-900 truncate">
                  {p.structured_formatting?.main_text || p.description}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {p.structured_formatting?.secondary_text || ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {!GOOGLE_API_KEY && (
        <p className="mt-1 text-xs text-red-500">Google Maps API key missing. Add VITE_GOOGLE_MAPS_API_KEY to .env</p>
      )}
    </div>
  );
}
