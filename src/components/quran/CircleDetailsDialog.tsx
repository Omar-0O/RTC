import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CircleDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  circleName: string;
  schedule: string;
  isRTL: boolean;
  canManageOrganizers: boolean;
  children: ReactNode;
}

export function CircleDetailsDialog({ open, onOpenChange, activeTab, onTabChange, circleName, schedule, isRTL, canManageOrganizers, children }: CircleDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:w-[calc(100%-1.5rem)] sm:max-w-5xl sm:max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-none sm:rounded-2xl">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col">
          <div className="flex flex-col h-full bg-background overflow-hidden">
            <div className="border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <DialogHeader className="p-4 sm:p-6 pb-2 text-center flex flex-col items-center justify-center relative"><DialogTitle className="text-xl sm:text-2xl font-bold text-center w-full mt-2 sm:mt-0">{circleName}</DialogTitle><DialogDescription className="text-center w-full text-xs sm:text-sm mt-1">{schedule}</DialogDescription></DialogHeader>
              <div className="px-4 sm:px-6 pb-3"><div className="overflow-x-auto -mx-2 px-2 pb-0.5 scrollbar-none"><TabsList className="flex w-full h-auto p-1 bg-muted/50 rounded-xl gap-0.5 xs:gap-1"><TabsTrigger value="beneficiaries" className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{isRTL ? 'المستفيدين' : 'Beneficiaries'}</TabsTrigger><TabsTrigger value="sessions" className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger><TabsTrigger value="sheet" className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{isRTL ? 'شيت الحضور' : 'Attendance Sheet'}</TabsTrigger>{canManageOrganizers && <TabsTrigger value="organizers" className="flex-1 sm:flex-initial px-1.5 xs:px-2.5 sm:px-6 py-2 text-[10px] xs:text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{isRTL ? 'المنظمين' : 'Organizers'}</TabsTrigger>}</TabsList></div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-none">{children}</div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
