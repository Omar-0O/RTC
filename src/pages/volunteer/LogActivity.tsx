import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VolunteerProfile, ActivityMode } from '@/types';
import { committees, getCommitteeActivities } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Upload, Globe, Building } from 'lucide-react';

export default function LogActivity() {
  const { user } = useAuth();
  const volunteer = user as VolunteerProfile;
  const { toast } = useToast();

  const [committeeId, setCommitteeId] = useState(volunteer?.committeeId || '');
  const [activityId, setActivityId] = useState('');
  const [mode, setMode] = useState<ActivityMode>('offline');
  const [description, setDescription] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const activities = getCommitteeActivities(committeeId);
  const selectedActivity = activities.find(a => a.id === activityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);

    toast({
      title: 'Activity Submitted!',
      description: 'Your activity has been submitted for review.',
    });
  };

  const handleReset = () => {
    setActivityId('');
    setDescription('');
    setProofFile(null);
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
              <h2 className="text-2xl font-bold mb-2">Activity Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Your submission is now pending review by your supervisor.
                You'll be notified once it's approved.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium mb-2">Submission Details</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Activity:</dt>
                    <dd>{selectedActivity?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Points:</dt>
                    <dd className="font-semibold text-primary">+{selectedActivity?.points} pts</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Mode:</dt>
                    <dd className="capitalize">{mode}</dd>
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
        <h1 className="text-2xl font-bold">Log Activity</h1>
        <p className="text-muted-foreground">
          Record your volunteer contributions to earn points
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Details</CardTitle>
          <CardDescription>
            Fill in the details of your completed activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Committee Selection */}
            <div className="space-y-2">
              <Label htmlFor="committee">Committee</Label>
              <Select value={committeeId} onValueChange={(value) => {
                setCommitteeId(value);
                setActivityId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select committee" />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((committee) => (
                    <SelectItem key={committee.id} value={committee.id}>
                      {committee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activity">Activity Type</Label>
              <Select value={activityId} onValueChange={setActivityId} disabled={!committeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={committeeId ? "Select activity" : "Select committee first"} />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{activity.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          +{activity.points} pts
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedActivity && (
                <p className="text-sm text-muted-foreground">
                  {selectedActivity.description}
                </p>
              )}
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label>Activity Mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as ActivityMode)}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="offline"
                  className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                >
                  <RadioGroupItem value="offline" id="offline" />
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Offline</p>
                    <p className="text-xs text-muted-foreground">In-person activity</p>
                  </div>
                </Label>
                <Label
                  htmlFor="online"
                  className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                >
                  <RadioGroupItem value="online" id="online" />
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Online</p>
                    <p className="text-xs text-muted-foreground">Remote activity</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what you did..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Proof Upload */}
            <div className="space-y-2">
              <Label htmlFor="proof">Proof of Work (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Input
                  id="proof"
                  type="file"
                  className="hidden"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  accept="image/*,.pdf"
                />
                <Label
                  htmlFor="proof"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  {proofFile ? (
                    <span className="text-sm font-medium">{proofFile.name}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium">Click to upload</span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG or PDF up to 10MB
                      </span>
                    </>
                  )}
                </Label>
              </div>
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
              {isSubmitting ? 'Submitting...' : 'Submit Activity'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
