import { useState, useEffect } from "react";
import { tagsAPI } from "@/lib/api";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { Tag, TagNode } from "@/types/database";

export const useTags = () => {
  const [tags, setTags] = useState<TagNode[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const buildTagTree = (flatTags: Tag[]): TagNode[] => {
    const tagMap = new Map<string, TagNode>();
    const rootTags: TagNode[] = [];

    // Create TagNode objects
    flatTags.forEach((tag) => {
      tagMap.set(tag.id, { ...tag, children: [] });
    });

    // Build the tree structure
    flatTags.forEach((tag) => {
      const tagNode = tagMap.get(tag.id)!;
      if (tag.parent_id) {
        const parent = tagMap.get(tag.parent_id);
        if (parent) {
          parent.children.push(tagNode);
        } else {
          rootTags.push(tagNode);
        }
      } else {
        rootTags.push(tagNode);
      }
    });

    return rootTags;
  };

  const fetchTags = async () => {
    if (!isAuthenticated) {
      setTags([]);
      setLoading(false);
      return;
    }

    try {
      const tagsData = await tagsAPI.getAll();
      const tagTree = buildTagTree(tagsData);
      setTags(tagTree);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast({
        title: "Error",
        description: "Failed to load tags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTag = async (tagData: { name: string; parent_id?: string; color: string }) => {
    if (!isAuthenticated) return null;

    try {
      await tagsAPI.create(tagData);
      // Refetch to rebuild the tree
      await fetchTags();

      toast({
        title: "Success",
        description: "Tag added successfully",
      });
      return true;
    } catch (error) {
      console.error("Error adding tag:", error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTag = async (id: string, updates: Partial<Tag>) => {
    if (!isAuthenticated) return null;

    try {
      await tagsAPI.update(id, updates);
      // Refetch to rebuild the tree
      await fetchTags();

      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
      return true;
    } catch (error) {
      console.error("Error updating tag:", error);
      toast({
        title: "Error",
        description: "Failed to update tag",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteTag = async (id: string) => {
    if (!isAuthenticated) return false;

    try {
      await tagsAPI.delete(id);
      // Refetch to rebuild the tree
      await fetchTags();

      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
      return true;
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast({
        title: "Error",
        description: "Failed to delete tag",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchTags();
  }, [isAuthenticated]);

  return {
    tags,
    loading,
    addTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
};
