import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AvatarCropPanelProps {
  image: string | null;
  crop: { x: number; y: number };
  zoom: number;
  isRTL: boolean;
  onCropChange: (crop: { x: number; y: number }) => void;
  onCropComplete: (_area: Area, pixels: Area) => void;
  onZoomChange: (zoom: number) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AvatarCropPanel({ image, crop, zoom, isRTL, onCropChange, onCropComplete, onZoomChange, onCancel, onSave }: AvatarCropPanelProps) {
  if (!image) return null;
  return <div className="mt-4 border rounded-lg p-4 space-y-4"><div className="relative h-64 w-full bg-black rounded-lg overflow-hidden"><Cropper image={image} crop={crop} zoom={zoom} aspect={1} onCropChange={onCropChange} onCropComplete={onCropComplete} onZoomChange={onZoomChange} /></div><div className="flex items-center gap-4"><span className="text-sm min-w-[3rem]">{isRTL ? 'تكبير' : 'Zoom'}</span><Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(values) => onZoomChange(values[0])} className="flex-1" /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{isRTL ? 'إلغاء' : 'Cancel'}</Button><Button type="button" onClick={onSave}>{isRTL ? 'قص وحفظ' : 'Crop & Save'}</Button></div></div>;
}
