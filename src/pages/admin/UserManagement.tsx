import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Mail, Shield, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { mockUsers, mockVolunteers, committees } from '@/data/mockData';
import { LevelBadge } from '@/components/ui/level-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

type UserWithDetails = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'volunteer';
  committeeId?: string;
  committeeName?: string;
  totalPoints?: number;
  level?: string;
  joinedAt: string;
};

export default function UserManagement() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Combine all users
  const allUsers: UserWithDetails[] = [
    ...mockUsers.map(u => ({
      ...u,
      committeeName: u.committeeId ? committees.find(c => c.id === u.committeeId)?.name : undefined,
    })),
    ...mockVolunteers.map(v => ({
      ...v,
      committeeName: committees.find(c => c.id === v.committeeId)?.name,
    })),
  ];

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesCommittee = committeeFilter === 'all' || user.committeeId === committeeFilter;
    return matchesSearch && matchesRole && matchesCommittee;
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t('users.addUser'));
    setIsAddDialogOpen(false);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive/10 text-destructive';
      case 'supervisor':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return t('common.admin');
      case 'supervisor': return t('common.supervisor');
      default: return t('common.volunteer');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('users.title')}</h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('users.addUser')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('users.addUser')}</DialogTitle>
              <DialogDescription>{t('users.createUser')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('users.fullName')}</Label>
                  <Input id="name" placeholder={t('users.fullName')} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" placeholder={t('auth.email')} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">{t('users.role')}</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                      <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                      <SelectItem value="admin">{t('common.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="committee">{t('users.committee')}</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder={t('users.committee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {committees.map(committee => (
                        <SelectItem key={committee.id} value={committee.id}>
                          {committee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">{t('common.add')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('users.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
              <Input
                placeholder={t('users.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('users.filterByRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.allRoles')}</SelectItem>
                <SelectItem value="volunteer">{t('common.volunteer')}</SelectItem>
                <SelectItem value="supervisor">{t('common.supervisor')}</SelectItem>
                <SelectItem value="admin">{t('common.admin')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('users.filterByCommittee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('users.allCommittees')}</SelectItem>
                {committees.map(committee => (
                  <SelectItem key={committee.id} value={committee.id}>
                    {committee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.volunteers')} ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.fullName')}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{t('users.committee')}</TableHead>
                <TableHead>{t('users.level')}</TableHead>
                <TableHead>{t('common.points')}</TableHead>
                <TableHead>{t('users.joined')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3 ltr:mr-1 rtl:ml-1" />}
                      {getRoleText(user.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.committeeName || '—'}</span>
                  </TableCell>
                  <TableCell>
                    {user.level ? (
                      <LevelBadge level={user.level as any} size="sm" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{user.totalPoints?.toLocaleString() || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(user.joinedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <User className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                          {t('users.viewProfile')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                          {t('users.sendEmail')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          {t('users.deactivate')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
