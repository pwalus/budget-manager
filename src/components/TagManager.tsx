import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTags, type TagNode } from "@/hooks/useTags";

import { Plus, Trash2, Edit, Tag, Save, X } from "lucide-react";

interface TagManagerProps {
  tags: TagNode[];
  onTagsChange: (tags: TagNode[]) => void;
  onClose: () => void;
}

export const TagManager = ({ tags, onTagsChange, onClose }: TagManagerProps) => {
  const { addTag, updateTag, deleteTag } = useTags();
  const [newTagName, setNewTagName] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>("none");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    parent_id: string;
    color: string;
  }>({
    name: "",
    parent_id: "none",
    color: "blue",
  });

  const colors = [
    { name: "blue", class: "bg-primary" },
    { name: "green", class: "bg-success" },
    { name: "red", class: "bg-expense" },
    { name: "orange", class: "bg-warning" },
    { name: "purple", class: "bg-primary" },
    { name: "teal", class: "bg-success" },
  ];

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    const tagData = {
      name: newTagName.trim(),
      parent_id: selectedParent && selectedParent !== "none" ? selectedParent : undefined,
      color: selectedColor,
    };

    await addTag(tagData);
    setNewTagName("");
    setSelectedParent("none");
    setSelectedColor("blue");
  };

  const handleDeleteTag = async (tagId: string) => {
    await deleteTag(tagId);
  };

  const handleEditTag = (tag: TagNode) => {
    setEditingTag(tag.id);
    setEditFormData({
      name: tag.name,
      parent_id: tag.parent_id || "none",
      color: tag.color,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTag || !editFormData.name.trim()) return;

    const updates = {
      name: editFormData.name.trim(),
      parent_id: editFormData.parent_id !== "none" ? editFormData.parent_id : null,
      color: editFormData.color,
    };

    await updateTag(editingTag, updates);
    setEditingTag(null);
    setEditFormData({
      name: "",
      parent_id: "none",
      color: "blue",
    });
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditFormData({
      name: "",
      parent_id: "none",
      color: "blue",
    });
  };

  const findTagById = (tagList: TagNode[], id: string): TagNode | null => {
    for (const tag of tagList) {
      if (tag.id === id) return tag;
      const found = findTagById(tag.children, id);
      if (found) return found;
    }
    return null;
  };

  const removeTagById = (tagList: TagNode[], id: string): TagNode[] => {
    return tagList.filter((tag) => {
      if (tag.id === id) return false;
      tag.children = removeTagById(tag.children, id);
      return true;
    });
  };

  const getAllTags = (tagList: TagNode[]): TagNode[] => {
    const result: TagNode[] = [];
    for (const tag of tagList) {
      result.push(tag);
      result.push(...getAllTags(tag.children));
    }
    return result;
  };

  const renderTagTree = (tagList: TagNode[], level = 0) => {
    return tagList.map((tag) => (
      <div key={tag.id} className={`ml-${level * 4} mb-2`}>
        {editingTag === tag.id ? (
          <div className="p-2 border rounded-lg bg-muted/30">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`edit-name-${tag.id}`}>Name</Label>
                  <Input
                    id={`edit-name-${tag.id}`}
                    value={editFormData.name}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`edit-parent-${tag.id}`}>Parent</Label>
                  <Select
                    value={editFormData.parent_id}
                    onValueChange={(value) => setEditFormData((prev) => ({ ...prev, parent_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Parent</SelectItem>
                      {getAllTags(tags)
                        .filter((t) => t.id !== tag.id) // Prevent self-reference
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      className={`w-6 h-6 rounded-full ${color.class} ${
                        editFormData.color === color.name ? "ring-2 ring-foreground ring-offset-1" : ""
                      }`}
                      onClick={() => setEditFormData((prev) => ({ ...prev, color: color.name }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${colors.find((c) => c.name === tag.color)?.class || "bg-primary"}`}
              />
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{tag.name}</span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => handleEditTag(tag)}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteTag(tag.id)}
                className="text-expense hover:text-expense"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        {tag.children.length > 0 && <div className="mt-2">{renderTagTree(tag.children, level + 1)}</div>}
      </div>
    ));
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Tag Management
        </CardTitle>
        <CardDescription>Create and organize your transaction tags in a hierarchy</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Tag */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <h3 className="font-semibold">Add New Tag</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag Name</Label>
              <Input
                id="tagName"
                placeholder="Enter tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentTag">Parent Tag (Optional)</Label>
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Parent (Root Level)</SelectItem>
                  {getAllTags(tags).map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={`w-8 h-8 rounded-full ${color.class} ${
                    selectedColor === color.name ? "ring-2 ring-foreground ring-offset-2" : ""
                  }`}
                  onClick={() => setSelectedColor(color.name)}
                />
              ))}
            </div>
          </div>
          <Button onClick={handleAddTag} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Tag
          </Button>
        </div>

        {/* Tag Tree */}
        <div className="space-y-4">
          <h3 className="font-semibold">Current Tags</h3>
          {tags.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">{renderTagTree(tags)}</div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No tags created yet. Add your first tag above.</div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
