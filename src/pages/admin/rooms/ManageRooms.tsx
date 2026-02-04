import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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

  const handleSubmit = async () => {
    if (!formData.id || !formData.name || !formData.name_ar) {
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
        const { error } = await supabase.from("rooms").insert([formData]);
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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isRTL ? "إدارة القاعات" : "Manage Rooms"}</h1>
          <p className="text-muted-foreground">{isRTL ? "إضافة وتعديل القاعات المتاحة للكورسات" : "Add and edit available rooms for courses"}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
              {isRTL ? "إضافة قاعة" : "Add Room"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRoom ? (isRTL ? "تعديل القاعة" : "Edit Room") : (isRTL ? "إضافة قاعة جديدة" : "Add New Room")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isRTL ? "كود القاعة (ID)" : "Room ID (Code)"}</Label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g. hall_1"
                  disabled={!!editingRoom} // ID cannot be changed after creation
                />
                <p className="text-xs text-muted-foreground">{isRTL ? "يجب أن يكون فريداً وباللغة الإنجليزية (بدون مسافات)" : "Must be unique and in English (no spaces)"}</p>
              </div>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleSubmit}>{isRTL ? "حفظ" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? "الكود" : "ID"}</TableHead>
              <TableHead>{isRTL ? "الاسم (English)" : "Name (English)"}</TableHead>
              <TableHead>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
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
                <TableRow key={room.id}>
                  <TableCell className="font-mono text-sm">{room.id}</TableCell>
                  <TableCell>{room.name}</TableCell>
                  <TableCell className="font-arabic">{room.name_ar}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{isRTL ? "هل أنت متأكد؟" : "Are you sure?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isRTL ? "لا يمكن التراجع عن هذا الإجراء." : "This action cannot be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(room.id)} className="bg-destructive hover:bg-destructive/90">
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
    </div>
  );
}
