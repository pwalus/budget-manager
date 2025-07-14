import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTags } from "@/hooks/useTags";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, ArrowLeft, Save, X } from "lucide-react";
import { TagNode } from "@/types/database";

interface TagTreeNodeProps {
  tag: TagNode;
  level: number;
  onEdit: (tag: TagNode) => void;
  onDelete: (tagId: string) => void;
  onAddChild: (parentId: string) => void;
}

const TagTreeNode = ({ tag, level, onEdit, onDelete, onAddChild }: TagTreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = tag.children && tag.children.length > 0;

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
        {!hasChildren && <div className="w-6" />}

        <div className="w-4 h-4 rounded-full border-2 border-gray-300" style={{ backgroundColor: tag.color }} />

        <span className="flex-1 text-sm font-medium">{tag.name}</span>

        <Badge variant="outline" className="text-xs">
          {hasChildren ? `${tag.children.length} children` : "leaf"}
        </Badge>

        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onAddChild(tag.id)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(tag)}>
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{tag.name}"?
                  {hasChildren && " This will also delete all child tags."}
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(tag.id)} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {tag.children.map((child) => (
            <TagTreeNode
              key={child.id}
              tag={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TagFormData {
  name: string;
  color: string;
  parent_id?: string;
}

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

const TagManagementContent = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { tags, loading, addTag, updateTag, deleteTag } = useTags();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<TagNode | null>(null);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TagFormData>({
    name: "",
    color: "#3b82f6",
    parent_id: undefined,
  });

  // Flatten tags for parent selection
  const flattenTags = (tags: TagNode[]): TagNode[] => {
    const result: TagNode[] = [];
    const addTagsRecursively = (tagList: TagNode[]) => {
      tagList.forEach((tag) => {
        result.push(tag);
        if (tag.children) {
          addTagsRecursively(tag.children);
        }
      });
    };
    addTagsRecursively(tags);
    return result;
  };

  const flatTags = flattenTags(tags);

  const handleOpenAddDialog = (parentId?: string) => {
    setParentId(parentId);
    setFormData({
      name: "",
      color: "#3b82f6",
      parent_id: parentId,
    });
    setEditingTag(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (tag: TagNode) => {
    setFormData({
      name: tag.name,
      color: tag.color,
      parent_id: tag.parent_id,
    });
    setEditingTag(tag);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingTag(null);
    setParentId(undefined);
    setFormData({
      name: "",
      color: "#3b82f6",
      parent_id: undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;

    if (editingTag) {
      // Update existing tag
      const success = await updateTag(editingTag.id, {
        name: formData.name.trim(),
        color: formData.color,
        parent_id: formData.parent_id || null,
      });
      if (success) {
        handleCloseDialog();
      }
    } else {
      // Create new tag
      const success = await addTag({
        name: formData.name.trim(),
        color: formData.color,
        parent_id: formData.parent_id,
      });
      if (success) {
        handleCloseDialog();
      }
    }
  };

  const handleDelete = async (tagId: string) => {
    await deleteTag(tagId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/")} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Tag Management</h1>
                <p className="text-gray-600">Organize your transaction categories</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleOpenAddDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Root Tag
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tag Tree */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Tag Hierarchy
                  <Badge variant="outline">{flatTags.length} total tags</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tags.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No tags created yet</p>
                    <Button onClick={() => handleOpenAddDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first tag
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tags.map((tag) => (
                      <TagTreeNode
                        key={tag.id}
                        tag={tag}
                        level={0}
                        onEdit={handleOpenEditDialog}
                        onDelete={handleDelete}
                        onAddChild={handleOpenAddDialog}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tag Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Tags</span>
                  <span className="font-medium">{flatTags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Root Tags</span>
                  <span className="font-medium">{tags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nested Tags</span>
                  <span className="font-medium">{flatTags.length - tags.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Color Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {colorOptions.map((color) => {
                    const count = flatTags.filter((tag) => tag.color === color.value).length;
                    return (
                      <div key={color.value} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.value }} />
                          <span className="text-sm">{color.label}</span>
                        </div>
                        <span className="text-sm text-gray-600">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit Tag" : "Add New Tag"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Tag Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter tag name"
                required
              />
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.value }} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="parent">Parent Tag (Optional)</Label>
              <Select
                value={formData.parent_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    parent_id: value === "none" ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root tag)</SelectItem>
                  {flatTags
                    .filter((tag) => !editingTag || tag.id !== editingTag.id)
                    .map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {editingTag ? "Update Tag" : "Create Tag"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TagManagement = () => {
  return (
    <AuthGuard>
      <TagManagementContent />
    </AuthGuard>
  );
};

export default TagManagement;
