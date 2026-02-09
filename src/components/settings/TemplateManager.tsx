import { useState } from 'react';
import { Plus, Edit2, Trash2, FileText, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTemplates, type MessageTemplate, type CreateTemplateParams } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';

interface EditingTemplate {
  id?: string;
  name: string;
  content: string;
  shortcut: string;
  category: string;
}

const emptyTemplate: EditingTemplate = {
  name: '',
  content: '',
  shortcut: '',
  category: 'general',
};

export function TemplateManager() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTemplate>(emptyTemplate);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleNew = () => {
    setEditing(emptyTemplate);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditing({
      id: template.id,
      name: template.name,
      content: template.content,
      shortcut: template.shortcut || '',
      category: template.category,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing.name.trim() || !editing.content.trim()) return;

    setSaving(true);
    try {
      const params: CreateTemplateParams = {
        name: editing.name.trim(),
        content: editing.content.trim(),
        shortcut: editing.shortcut.trim() || undefined,
        category: editing.category,
      };

      if (editing.id) {
        await updateTemplate(editing.id, params);
      } else {
        await createTemplate(params);
      }

      setIsDialogOpen(false);
      setEditing(emptyTemplate);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteTemplate(id);
    } finally {
      setDeleting(null);
    }
  };

  const categories = [
    { value: 'general', label: 'Chung' },
    { value: 'greeting', label: 'Chào hỏi' },
    { value: 'work', label: 'Công việc' },
    { value: 'personal', label: 'Cá nhân' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Mẫu tin nhắn
        </CardTitle>
        <CardDescription>
          Tạo và quản lý các mẫu tin nhắn để gửi nhanh. Gõ "/" trong chat để sử dụng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={handleNew} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Tạo mẫu mới
          </Button>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Đang tải...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có mẫu tin nhắn nào
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      'p-3 rounded-lg border bg-card',
                      'hover:border-primary/50 transition-colors'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {template.name}
                          </span>
                          {template.shortcut && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                              /{template.shortcut}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {template.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>
                            {categories.find((c) => c.value === template.category)?.label || 'Chung'}
                          </span>
                          <span>•</span>
                          <span>Đã dùng {template.use_count} lần</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(template.id)}
                          disabled={deleting === template.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing.id ? 'Chỉnh sửa mẫu' : 'Tạo mẫu mới'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Tên mẫu *</Label>
              <Input
                id="template-name"
                placeholder="VD: Chào buổi sáng"
                value={editing.name}
                onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">Nội dung *</Label>
              <Textarea
                id="template-content"
                placeholder="Nội dung tin nhắn..."
                rows={4}
                value={editing.content}
                onChange={(e) => setEditing((prev) => ({ ...prev, content: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-shortcut">Phím tắt</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    /
                  </span>
                  <Input
                    id="template-shortcut"
                    placeholder="hi"
                    className="pl-6"
                    value={editing.shortcut}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        shortcut: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-category">Danh mục</Label>
                <select
                  id="template-category"
                  value={editing.category}
                  onChange={(e) => setEditing((prev) => ({ ...prev, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !editing.name.trim() || !editing.content.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default TemplateManager;
