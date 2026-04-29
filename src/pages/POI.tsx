import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert, Plus, Search, X, User, MapPin, Clock, Eye, AlertTriangle, Tag,
  Camera, Upload, Trash2, Image as ImageIcon, Star, ChevronLeft, ChevronRight,
  Film, FileText, Maximize2, Download, Loader2, Navigation,
} from 'lucide-react';
import { usePOI, THREAT_LEVELS, POI_STATUSES, POI_CATEGORIES, type POIRecord, type POIPhoto, type POISighting } from '../hooks/usePOI';
import { useBranding } from '../context/BrandingContext';
import { format, formatDistanceToNow } from 'date-fns';

// -- Helpers --
const isImage = (t: string | null) => t?.startsWith('image/');
const isVideo = (t: string | null) => t?.startsWith('video/');
const formatBytes = (b: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

export default function POI() {
  const { primaryColor } = useBranding();
  const {
    records, loading, createRecord, updateRecord, deleteRecord,
    fetchPhotos, uploadPhoto, fetchSightings, addSighting,
  } = usePOI();

  const [selected, setSelected] = useState<POIRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterThreat, setFilterThreat] = useState('');
  const [form, setForm] = useState<Partial<POIRecord>>({
    threat_level: 'medium', status: 'active', category: 'suspicious',
  });

  // Media state
  const [photos, setPhotos] = useState<POIPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sightings state
  const [sightings, setSightings] = useState<POISighting[]>([]);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sightingForm, setSightingForm] = useState<Partial<POISighting>>({});

  // Active tab in detail panel
  const [detailTab, setDetailTab] = useState<'details' | 'media' | 'sightings'>('details');

  const filtered = records.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || `${r.first_name} ${r.last_name} ${r.alias}`.toLowerCase().includes(q);
    const matchesThreat = !filterThreat || r.threat_level === filterThreat;
    return matchesSearch && matchesThreat;
  });

  // Load photos & sightings when a POI is selected
  const loadMedia = useCallback(async (poiId: string) => {
    setPhotosLoading(true);
    const [p, s] = await Promise.all([fetchPhotos(poiId), fetchSightings(poiId)]);
    setPhotos(p);
    setSightings(s);
    setPhotosLoading(false);
  }, [fetchPhotos, fetchSightings]);

  useEffect(() => {
    if (selected) loadMedia(selected.id);
    else { setPhotos([]); setSightings([]); }
  }, [selected, loadMedia]);

  const handleSave = async () => {
    if (selected) {
      await updateRecord(selected.id, form);
    } else {
      await createRecord(form);
    }
    setShowForm(false);
    setSelected(null);
    setForm({ threat_level: 'medium', status: 'active', category: 'suspicious' });
  };

  const openEdit = (poi: POIRecord) => {
    setSelected(poi);
    setForm(poi);
    setShowForm(true);
    setDetailTab('details');
  };

  const openNew = () => {
    setSelected(null);
    setForm({ threat_level: 'medium', status: 'active', category: 'suspicious' });
    setShowForm(true);
    setDetailTab('details');
  };

  // -- Photo upload --
  const handleFiles = async (files: File[]) => {
    if (!selected) return;
    setUploading(true);
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) continue; // max 50MB
      await uploadPhoto(selected.id, file);
    }
    await loadMedia(selected.id);
    setUploading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -- Add sighting --
  const handleAddSighting = async () => {
    if (!selected) return;
    await addSighting(selected.id, sightingForm);
    setSightingForm({});
    setShowSightingForm(false);
    await loadMedia(selected.id);
  };

  // -- Lightbox navigation --
  const imagePhotos = photos.filter(p => isImage(p.file_type));

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* --- LIST PANEL --- */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Persons of Interest</h2>
            <button onClick={openNew} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search POI..." className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterThreat('')} className={`px-2 py-1 rounded text-xs ${!filterThreat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
            {THREAT_LEVELS.map(t => (
              <button key={t.value} onClick={() => setFilterThreat(t.value)} className={`px-2 py-1 rounded text-xs ${filterThreat === t.value ? 'bg-gray-900 text-white' : t.color}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map(poi => {
            const tl = THREAT_LEVELS.find(t => t.value === poi.threat_level);
            const st = POI_STATUSES.find(s => s.value === poi.status);
            return (
              <button key={poi.id} onClick={() => openEdit(poi)} className={`w-full text-left p-4 hover:bg-gray-50 ${selected?.id === poi.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{poi.first_name} {poi.last_name} {poi.alias ? <span className="text-gray-400 font-normal">"{poi.alias}"</span> : null}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tl?.color}`}>{tl?.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span className={`px-1.5 py-0.5 rounded ${st?.color}`}>{st?.label}</span>
                  <span>{poi.category}</span>
                </div>
                {poi.last_seen_location && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{poi.last_seen_location}</p>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No POI records found</div>}
        </div>
      </div>

      {/* --- DETAIL / FORM PANEL --- */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {showForm && selected ? (
          <div className="max-w-3xl mx-auto p-6">
            {/* Header with name */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.first_name} {selected.last_name}</h2>
                {selected.alias && <p className="text-sm text-gray-400">"{selected.alias}"</p>}
              </div>
              <button onClick={() => { setShowForm(false); setSelected(null); }} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
              {(['details', 'media', 'sightings'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${detailTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {tab === 'media' ? `Media (${photos.length})` : tab === 'sightings' ? `Sightings (${sightings.length})` : 'Details'}
                </button>
              ))}
            </div>

            {/* --- DETAILS TAB --- */}
            {detailTab === 'details' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" value={form.first_name || ''} onChange={(e) => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={form.last_name || ''} onChange={(e) => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Alias / Nickname</label>
                  <input type="text" value={form.alias || ''} onChange={(e) => setForm({...form, alias: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Threat Level</label>
                    <select value={form.threat_level || 'medium'} onChange={(e) => setForm({...form, threat_level: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                      {THREAT_LEVELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status || 'active'} onChange={(e) => setForm({...form, status: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                      {POI_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                    <select value={form.category || 'suspicious'} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                      {POI_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                    <input type="text" value={form.height || ''} onChange={(e) => setForm({...form, height: e.target.value})} placeholder="5'10&quot;" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Weight</label>
                    <input type="text" value={form.weight || ''} onChange={(e) => setForm({...form, weight: e.target.value})} placeholder="180 lbs" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                    <input type="text" value={form.gender || ''} onChange={(e) => setForm({...form, gender: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hair Color</label>
                    <input type="text" value={form.hair_color || ''} onChange={(e) => setForm({...form, hair_color: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Eye Color</label>
                    <input type="text" value={form.eye_color || ''} onChange={(e) => setForm({...form, eye_color: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Distinguishing Marks</label>
                  <input type="text" value={form.distinguishing_marks || ''} onChange={(e) => setForm({...form, distinguishing_marks: e.target.value})} placeholder="Tattoos, scars, etc." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Known Address</label>
                  <input type="text" value={form.known_address || ''} onChange={(e) => setForm({...form, known_address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Known Vehicle</label>
                  <input type="text" value={form.known_vehicle || ''} onChange={(e) => setForm({...form, known_vehicle: e.target.value})} placeholder="2020 Black Honda Civic, plate ABC-123" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Seen Location</label>
                  <input type="text" value={form.last_seen_location || ''} onChange={(e) => setForm({...form, last_seen_location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes || ''} onChange={(e) => setForm({...form, notes: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    Update POI
                  </button>
                  <button onClick={() => { deleteRecord(selected.id); setShowForm(false); setSelected(null); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
                    Archive
                  </button>
                  <button onClick={() => { setShowForm(false); setSelected(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* --- MEDIA TAB --- */}
            {detailTab === 'media' && (
              <div className="space-y-4">
                {/* Upload zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-colors text-center ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileInput} className="hidden" />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-sm text-gray-500">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 font-medium hover:underline">Click to upload</button>
                        {' '}or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">Photos & videos up to 50 MB each</p>
                    </div>
                  )}
                </div>

                {/* Photo grid */}
                {photosLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
                ) : photos.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Camera className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No photos or videos uploaded yet</p>
                    <p className="text-xs text-gray-400 mt-1">Upload evidence photos, surveillance stills, or ID shots</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {photos.map((photo, idx) => {
                      const imgIdx = imagePhotos.findIndex(p => p.id === photo.id);
                      return (
                        <div key={photo.id} className="group relative rounded-xl border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-shadow">
                          {isImage(photo.file_type) ? (
                            <img src={photo.file_path} alt={photo.caption || photo.file_name}
                              className="w-full h-36 object-cover cursor-pointer"
                              onClick={() => setLightboxIdx(imgIdx)} />
                          ) : isVideo(photo.file_type) ? (
                            <div className="relative w-full h-36 bg-gray-900 flex items-center justify-center cursor-pointer"
                              onClick={() => window.open(photo.file_path, '_blank')}>
                              <Film className="w-8 h-8 text-white/60" />
                              <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">VIDEO</span>
                            </div>
                          ) : (
                            <div className="w-full h-36 bg-gray-50 flex flex-col items-center justify-center">
                              <FileText className="w-8 h-8 text-gray-300" />
                              <span className="text-[10px] text-gray-400 mt-1">{photo.file_type}</span>
                            </div>
                          )}
                          {/* Overlay info */}
                          <div className="p-2">
                            <p className="text-[11px] text-gray-700 truncate font-medium">{photo.file_name}</p>
                            <p className="text-[10px] text-gray-400">{formatBytes(photo.file_size)}</p>
                          </div>
                          {/* Hover actions */}
                          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isImage(photo.file_type) && (
                              <button onClick={() => setLightboxIdx(imgIdx)} className="p-1 bg-black/60 text-white rounded-md hover:bg-black/80" title="Expand">
                                <Maximize2 className="w-3 h-3" />
                              </button>
                            )}
                            <a href={photo.file_path} download={photo.file_name} className="p-1 bg-black/60 text-white rounded-md hover:bg-black/80" title="Download">
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                          {photo.is_primary && (
                            <div className="absolute top-1.5 left-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-500 text-white rounded-full font-bold flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Primary</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* --- SIGHTINGS TAB --- */}
            {detailTab === 'sightings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Sighting Reports</h3>
                  <button onClick={() => setShowSightingForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    <Plus className="w-3.5 h-3.5" /> Report Sighting
                  </button>
                </div>

                {/* Add sighting form */}
                {showSightingForm && (
                  <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-3">
                    <h4 className="text-sm font-medium text-gray-900">New Sighting Report</h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                      <input type="text" value={sightingForm.location || ''} onChange={e => setSightingForm({...sightingForm, location: e.target.value})}
                        placeholder="e.g. Parking Lot B, North Entrance" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={sightingForm.description || ''} onChange={e => setSightingForm({...sightingForm, description: e.target.value})}
                        rows={3} placeholder="Describe what was observed..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddSighting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Submit Report</button>
                      <button onClick={() => { setShowSightingForm(false); setSightingForm({}); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Sightings timeline */}
                {sightings.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Navigation className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No sightings reported</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Report Sighting" to log a new observation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sightings.map(s => (
                      <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Eye className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{s.reported_by_name || 'Unknown'}</p>
                              <p className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(s.sighted_at), { addSuffix: true })}</p>
                            </div>
                          </div>
                          {s.location && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                              <MapPin className="w-3 h-3" /> {s.location}
                            </span>
                          )}
                        </div>
                        {s.description && <p className="text-sm text-gray-700 ml-10">{s.description}</p>}
                        {s.photo_url && (
                          <div className="ml-10 mt-2">
                            <img src={s.photo_url} alt="Sighting" className="h-24 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-90" onClick={() => window.open(s.photo_url!, '_blank')} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : showForm ? (
          /* New POI form (no selected record yet) */
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">New POI Record</h2>
              <button onClick={() => { setShowForm(false); setSelected(null); }} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={form.first_name || ''} onChange={(e) => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={form.last_name || ''} onChange={(e) => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alias / Nickname</label>
                <input type="text" value={form.alias || ''} onChange={(e) => setForm({...form, alias: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Threat Level</label>
                  <select value={form.threat_level || 'medium'} onChange={(e) => setForm({...form, threat_level: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {THREAT_LEVELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status || 'active'} onChange={(e) => setForm({...form, status: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {POI_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category || 'suspicious'} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {POI_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create POI</button>
                <button onClick={() => { setShowForm(false); setSelected(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Persons of Interest</p>
              <p className="text-sm">Select a record or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* --- LIGHTBOX --- */}
      {lightboxIdx !== null && imagePhotos[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {lightboxIdx < imagePhotos.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}>
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <img src={imagePhotos[lightboxIdx].file_path} alt={imagePhotos[lightboxIdx].caption || ''} className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <p className="text-white text-sm font-medium">{imagePhotos[lightboxIdx].file_name}</p>
            <p className="text-white/50 text-xs">{lightboxIdx + 1} of {imagePhotos.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
