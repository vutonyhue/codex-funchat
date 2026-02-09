import { useState, useEffect } from 'react';
import { Conversation } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Settings, Users, Link2, Loader2, Camera } from 'lucide-react';
import {
  updateConversation,
  getGroupDetails,
  isConversationAdmin,
  GroupSettings,
} from '@/lib/groupAdmin';
import MemberManagement from './MemberManagement';
import InviteLinkCard from './InviteLinkCard';

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  onConversationUpdated?: () => void;
}

export default function GroupSettingsDialog({
  open,
  onOpenChange,
  conversation,
  onConversationUpdated,
}: GroupSettingsDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState('');
  const [settings, setSettings] = useState<GroupSettings>({
    only_admin_can_send: false,
    only_admin_can_add_members: false,
    allow_member_to_invite: true,
  });

  const isAdmin = user ? isConversationAdmin(conversation, user.id) : false;

  // Fetch group details on open
  useEffect(() => {
    if (!open) return;

    const fetchDetails = async () => {
      setLoading(true);
      const { data, error } = await getGroupDetails(conversation.id);
      if (!error && data) {
        setDescription(data.description || '');
        setSettings(data.settings);
      }
      setLoading(false);
    };

    setName(conversation.name || '');
    fetchDetails();
  }, [open, conversation.id, conversation.name]);

  const handleSaveInfo = async () => {
    if (!isAdmin) return;

    setSaving(true);
    const { error } = await updateConversation(conversation.id, {
      name: name.trim() || undefined,
      description: description.trim() || undefined,
    });

    if (error) {
      toast.error('Không thể cập nhật thông tin nhóm');
    } else {
      toast.success('Đã cập nhật thông tin nhóm');
      onConversationUpdated?.();
    }
    setSaving(false);
  };

  const handleSettingsChange = async (key: keyof GroupSettings, value: boolean) => {
    if (!isAdmin) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    const { error } = await updateConversation(conversation.id, {
      settings: newSettings,
    });

    if (error) {
      // Revert on error
      setSettings(settings);
      toast.error('Không thể cập nhật cài đặt');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Cài đặt nhóm
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="flex items-center gap-1">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Thông tin</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Thành viên</span>
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-1">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Link mời</span>
            </TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="flex-1 overflow-y-auto space-y-6 p-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Avatar */}
                <div className="flex flex-col items-center gap-3">
                  <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                    <AvatarImage src={conversation.avatar_url || undefined} />
                    <AvatarFallback className="gradient-primary text-white text-2xl font-bold">
                      {(conversation.name || 'G').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isAdmin && (
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      <Camera className="w-4 h-4" />
                      Đổi ảnh nhóm
                    </Button>
                  )}
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="group-name">Tên nhóm</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập tên nhóm"
                    disabled={!isAdmin}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="group-desc">Mô tả</Label>
                  <Textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả về nhóm..."
                    rows={3}
                    disabled={!isAdmin}
                  />
                </div>

                {isAdmin && (
                  <Button 
                    onClick={handleSaveInfo} 
                    disabled={saving}
                    className="w-full"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Lưu thay đổi
                  </Button>
                )}

                {/* Settings */}
                {isAdmin && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-sm text-muted-foreground">Quyền hạn</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Chỉ admin gửi tin nhắn</Label>
                        <p className="text-xs text-muted-foreground">
                          Thành viên không thể gửi tin
                        </p>
                      </div>
                      <Switch
                        checked={settings.only_admin_can_send}
                        onCheckedChange={(v) => handleSettingsChange('only_admin_can_send', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Chỉ admin thêm thành viên</Label>
                        <p className="text-xs text-muted-foreground">
                          Thành viên không thể thêm người khác
                        </p>
                      </div>
                      <Switch
                        checked={settings.only_admin_can_add_members}
                        onCheckedChange={(v) => handleSettingsChange('only_admin_can_add_members', v)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="flex-1 overflow-y-auto p-1">
            <MemberManagement
              conversation={conversation}
              isAdmin={isAdmin}
              onMemberUpdated={onConversationUpdated}
            />
          </TabsContent>

          {/* Invite Link Tab */}
          <TabsContent value="invite" className="flex-1 overflow-y-auto p-1">
            <InviteLinkCard
              conversationId={conversation.id}
              isAdmin={isAdmin}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
