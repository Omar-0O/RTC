import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Globe, Building } from 'lucide-react';

interface Committee {
  id: string;
  name: string;
  name_ar: string;
}

interface ActivityType {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  points: number;
  committee_id: string | null;
}

export default function LogActivity() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [committeeId, setCommitteeId] = useState(profile?.committee_id || '');
  const [activityId, setActivityId] = useState('');
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: committeesData } = await supabase.from('committees').select('*');
      if (committeesData) setCommittees(committeesData);

      const { data: activitiesData } = await supabase.from('activity_types').select('*');
      if (activitiesData) setActivityTypes(activitiesData);
    };
    fetchData();
  }, []);

  const filteredActivities = activityTypes.filter(
    a => !a.committee_id || a.committee_id === committeeId
  );
  const selectedActivity = activityTypes.find(a => a.id === activityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('activity_submissions').insert({
        volunteer_id: user.id,
        activity_type_id: activityId,
        committee_id: committeeId,
        description,
        points_awarded: selectedActivity?.points || 0,
        status: 'pending',
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: t('success'),
        description: t('activityLog.submitActivity'),
      });
    } catch (error) {
      console.error('Error submitting activity:', error);
      toast({
        title: t('error'),
        description: 'Failed to submit activity',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActivityId('');
    setDescription('');
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('success')}!</h2>
              <p className="text-muted-foreground mb-6">
                Your submission is now pending review.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium mb-2">Submission Details</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Activity:</dt>
                    <dd>{language === 'ar' ? selectedActivity?.name_ar : selectedActivity?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Points:</dt>
                    <dd className="font-semibold text-primary">+{selectedActivity?.points} pts</dd>
                  </div>
                </dl>
              </div>
              <Button onClick={handleReset}>Log Another Activity</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('activityLog.title')}</h1>
        <p className="text-muted-foreground">{t('activityLog.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('activityLog.title')}</CardTitle>
          <CardDescription>{t('activityLog.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Committee Selection */}
            <div className="space-y-2">
              <Label htmlFor="committee">{t('activityLog.selectCommittee')}</Label>
              <Select value={committeeId} onValueChange={(value) => {
                setCommitteeId(value);
                setActivityId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('activityLog.selectCommittee')} />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((committee) => (
                    <SelectItem key={committee.id} value={committee.id}>
                      {language === 'ar' ? committee.name_ar : committee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activity">{t('activityLog.selectActivity')}</Label>
              <Select value={activityId} onValueChange={setActivityId} disabled={!committeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={committeeId ? t('activityLog.selectActivity') : t('activityLog.selectCommittee')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredActivities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{language === 'ar' ? activity.name_ar : activity.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          +{activity.points} pts
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label>{t('activityLog.mode')}</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as 'individual' | 'group')}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="individual"
                  className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                >
                  <RadioGroupItem value="individual" id="individual" />
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('activityLog.offline')}</p>
                    <p className="text-xs text-muted-foreground">Individual work</p>
                  </div>
                </Label>
                <Label
                  htmlFor="group"
                  className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                >
                  <RadioGroupItem value="group" id="group" />
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('activityLog.online')}</p>
                    <p className="text-xs text-muted-foreground">Group activity</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('activityLog.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('activityLog.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Points Preview */}
            {selectedActivity && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Points you'll earn:</span>
                  <span className="text-xl font-bold text-primary">
                    +{selectedActivity.points} pts
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!activityId || !description || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : t('activityLog.submitActivity')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
