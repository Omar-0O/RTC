import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Building } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Room {
  id: string;
  name: string;
  name_ar: string;
  created_at: string;
}

export default function ManageRooms() {
  const { isRTL } = useLanguage();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "", name_ar: "" });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("rooms").select("*").order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching rooms:", error);
      toast.error(isRTL ? "فشل تحميل القاعات" : "Failed to fetch rooms");
    } else {
      setRooms(data || []);
    }
    setLoading(false);
  };

  const generateId = (name: string) => {
    let baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!baseId) baseId = 'room';

    let id = baseId;
    let counter = 1;
    while (rooms.some(r => r.id === id)) {
      id = `${baseId}_${counter}`;
      counter++;
    }
    return id;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.name_ar) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }

    try {
      if (editingRoom) {
        // Update
        const { error } = await supabase
          .from("rooms")
          .update({ name: formData.name, name_ar: formData.name_ar })
          .eq("id", editingRoom.id);

        if (error) throw error;
        toast.success(isRTL ? "تم تحديث القاعة" : "Room updated");
      } else {
        // Create
        const newId = generateId(formData.name);
        const newRoom = { ...formData, id: newId };
        const { error } = await supabase.from("rooms").insert([newRoom]);
        if (error) throw error;
        toast.success(isRTL ? "تم إضافة القاعة" : "Room added");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchRooms();
    } catch (error: any) {
      console.error("Error saving room:", error);
      toast.error(error.message || (isRTL ? "حدث خطأ" : "An error occurred"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
      toast.success(isRTL ? "تم حذف القاعة" : "Room deleted");
      fetchRooms();
    } catch (error: any) {
      console.error("Error deleting room:", error);
      toast.error(isRTL ? "فشل حذف القاعة" : "Failed to delete room");
    }
  };

  const resetForm = () => {
    setFormData({ id: "", name: "", name_ar: "" });
    setEditingRoom(null);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({ id: room.id, name: room.name, name_ar: room.name_ar });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building className="w-6 h-6 sm:w-8 sm:h-8" />
            <span>{isRTL ? "إدارة القاعات" : "Manage Rooms"}</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isRTL ? "إضافة وتعديل القاعات المتاحة للكورسات" : "Add and edit available rooms for courses"}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-sm transition-all duration-200 hover:shadow-md">
              <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
              {isRTL ? "إضافة قاعة" : "Add Room"}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[450px] rounded-xl">
            <DialogHeader>
              <DialogTitle>{editingRoom ? (isRTL ? "تعديل القاعة" : "Edit Room") : (isRTL ? "إضافة قاعة جديدة" : "Add New Room")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingRoom && (
                <div className="space-y-2">
                  <Label>{isRTL ? "كود القاعة (ID)" : "Room ID (Code)"}</Label>
                  <Input
                    value={formData.id}
                    disabled
                    className="bg-muted font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{isRTL ? "لا يمكن تعديل الكود بعد الإنشاء" : "ID cannot be changed after creation"}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{isRTL ? "الاسم (English)" : "Name (English)"}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Main Hall"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="مثال: القاعة الرئيسية"
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleSubmit} className="w-full sm:w-auto">{isRTL ? "حفظ" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={`font-semibold ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الكود" : "ID"}</TableHead>
              <TableHead className={`font-semibold ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الاسم (English)" : "Name (English)"}</TableHead>
              <TableHead className={`font-semibold ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : rooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {isRTL ? "لا توجد قاعات" : "No rooms found"}
                </TableCell>
              </TableRow>
            ) : (
              rooms.map((room) => (
                <TableRow key={room.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-sm font-medium text-primary">{room.id}</TableCell>
                  <TableCell>{room.name}</TableCell>
                  <TableCell className="font-arabic">{room.name_ar}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)} className="hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-[400px] rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>{isRTL ? "هل أنت متأكد؟" : "Are you sure?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isRTL ? "لا يمكن التراجع عن هذا الإجراء." : "This action cannot be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
                            <AlertDialogCancel className="w-full sm:w-auto">{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(room.id)} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">
                              {isRTL ? "حذف" : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {loading ? (
          <div className="border rounded-xl bg-card p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="border rounded-xl bg-card p-8 text-center text-muted-foreground">
            {isRTL ? "لا توجد قاعات" : "No rooms found"}
          </div>
        ) : (
          <div className="grid gap-4">
            {rooms.map((room) => (
              <div key={room.id} className="border rounded-xl bg-card p-4 shadow-sm space-y-3 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-secondary text-secondary-foreground border">
                    {room.id}
                  </span>
                </div>
                <div className="space-y-1.5 py-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground text-xs">{isRTL ? "الاسم (English)" : "Name (English)"}</span>
                    <span className="font-medium">{room.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground text-xs">{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</span>
                    <span className="font-medium font-arabic">{room.name_ar}</span>
                  </div>
                </div>
                <div className="border-t pt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(room)} className="h-9 px-3 text-xs flex-1">
                    <Pencil className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                    {isRTL ? "تعديل" : "Edit"}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 px-3 text-xs text-destructive hover:bg-destructive/5 hover:text-destructive flex-1">
                        <Trash2 className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                        {isRTL ? "حذف" : "Delete"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[90vw] max-w-[400px] rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? "هل أنت متأكد؟" : "Are you sure?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isRTL ? "لا يمكن التراجع عن هذا الإجراء." : "This action cannot be undone."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
                        <AlertDialogCancel className="w-full sm:w-auto">{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(room.id)} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">
                          {isRTL ? "حذف" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
