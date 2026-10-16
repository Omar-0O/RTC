import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCroppedImg } from '@/utils/imageCrop';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onConfirm: (file: File) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: AvatarCropDialogProps) {
  const { isRTL } = useLanguage();

  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleCropComplete = useCallback((_croppedArea: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 1));
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      if (!croppedFile) {
        throw new Error('Failed to generate cropped avatar image');
      }
      await onConfirm(croppedFile);
    } catch (error) {
      console.error('Error applying avatar crop:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء معالجة أبعاد الصورة' : 'Failed to crop profile picture');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing || isSubmitting) return;
    handleReset();
    onOpenChange(false);
    onCancel?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? handleClose() : onOpenChange(isOpen))}>
      <DialogContent className="max-w-md sm:max-w-lg p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="text-center sm:text-center space-y-1.5">
          <DialogTitle className="text-xl font-bold">
            {isRTL ? 'تعديل أبعاد الصورة الشخصية' : 'Adjust Profile Picture'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {isRTL
              ? 'قم بسحب الصورة وتحريكها وتكبيرها لتناسب الإطار الدائري للصورة الشخصية'
              : 'Drag, zoom, and rotate the image to fit the circular profile avatar requirements.'}
          </DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <div className="space-y-4 pt-2">
            {/* Cropper Viewport with Circular Mask */}
            <div className="relative h-64 sm:h-72 w-full bg-black/95 rounded-xl overflow-hidden border border-border/50 shadow-inner">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
              />
              <div className="absolute top-2.5 ltr:left-2.5 rtl:right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90 border border-white/10 pointer-events-none select-none">
                1:1 PFP
              </div>
            </div>

            {/* Controls Section */}
            <div className="space-y-3 bg-muted/30 p-3.5 rounded-lg border border-border/40">
              {/* Zoom Control */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1 || isProcessing || isSubmitting}
                  title={isRTL ? 'تصغير' : 'Zoom Out'}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium w-10 text-center select-none">
                    {zoom.toFixed(1)}x
                  </span>
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={3}
                    step={0.05}
                    onValueChange={(vals) => setZoom(vals[0])}
                    disabled={isProcessing || isSubmitting}
                    className="flex-1 cursor-pointer"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3 || isProcessing || isSubmitting}
                  title={isRTL ? 'تكبير' : 'Zoom In'}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Auxiliary Tools: Rotate & Reset */}
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleRotate}
                  disabled={isProcessing || isSubmitting}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {isRTL ? 'تدوير 90°' : 'Rotate 90°'}
                  {rotation > 0 && <span className="text-[10px] opacity-80">({rotation}°)</span>}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                  disabled={isProcessing || isSubmitting || (zoom === 1 && rotation === 0 && crop.x === 0 && crop.y === 0)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isRTL ? 'إعادة ضبط' : 'Reset'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row justify-end gap-2 pt-2 sm:pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing || isSubmitting}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || isSubmitting || !imageSrc}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
          >
            {isProcessing || isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRTL ? 'جاري الحفظ...' : 'Saving...'}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {isRTL ? 'تأكيد وحفظ' : 'Apply & Save'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
