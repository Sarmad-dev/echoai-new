"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Filter,
  X,
  Users,
  MessageSquare,
  Clock,
  Smile,
  Frown,
  Meh,
} from "lucide-react";
import { ConversationStatus } from "@/types/database";
import { ConversationWithMetadata } from "./conversation-table";

export interface ConversationFilters {
  search: string;
  status: ConversationStatus | "all";
  sentiment: "positive" | "negative" | "neutral" | "all";
  assignee: string | "all" | "unassigned";
}

interface ConversationFiltersProps {
  conversations: ConversationWithMetadata[];
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
  onFilteredConversationsChange: (conversations: ConversationWithMetadata[]) => void;
}

export function ConversationFiltersComponent({
  conversations,
  filters,
  onFiltersChange,
  onFilteredConversationsChange,
}: ConversationFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get unique assignees from conversations
  const uniqueAssignees = Array.from(
    new Set(
      conversations
        .map((c) => c.assignedTo)
        .filter((assignee): assignee is string => Boolean(assignee))
    )
  );

  // Filter conversations based on current filters
  const filterConversations = useCallback(
    (currentFilters: ConversationFilters) => {
      let filtered = [...conversations];

      // Search filter
      if (currentFilters.search.trim()) {
        const searchTerm = currentFilters.search.toLowerCase().trim();
        filtered = filtered.filter(
          (conv) =>
            conv.customerEmail?.toLowerCase().includes(searchTerm) ||
            conv.source?.toLowerCase().includes(searchTerm) ||
            conv.lastMessage.toLowerCase().includes(searchTerm) ||
            conv.id.toLowerCase().includes(searchTerm) ||
            conv.assignedTo?.toLowerCase().includes(searchTerm)
        );
      }

      // Status filter
      if (currentFilters.status !== "all") {
        filtered = filtered.filter((conv) => conv.status === currentFilters.status);
      }

      // Sentiment filter
      if (currentFilters.sentiment !== "all") {
        filtered = filtered.filter((conv) => {
          if (!conv.sentimentScore) return currentFilters.sentiment === "neutral";
          
          switch (currentFilters.sentiment) {
            case "positive":
              return conv.sentimentScore > 0.1;
            case "negative":
              return conv.sentimentScore < -0.1;
            case "neutral":
              return conv.sentimentScore >= -0.1 && conv.sentimentScore <= 0.1;
            default:
              return true;
          }
        });
      }

      // Assignee filter
      if (currentFilters.assignee !== "all") {
        if (currentFilters.assignee === "unassigned") {
          filtered = filtered.filter((conv) => !conv.assignedTo);
        } else {
          filtered = filtered.filter((conv) => conv.assignedTo === currentFilters.assignee);
        }
      }

      onFilteredConversationsChange(filtered);
      return filtered;
    },
    [conversations, onFilteredConversationsChange]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (key: keyof ConversationFilters, value: string) => {
      const newFilters = { ...filters, [key]: value };
      onFiltersChange(newFilters);
      filterConversations(newFilters);
    },
    [filters, onFiltersChange, filterConversations]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    const defaultFilters: ConversationFilters = {
      search: "",
      status: "all",
      sentiment: "all",
      assignee: "all",
    };
    onFiltersChange(defaultFilters);
    filterConversations(defaultFilters);
  }, [onFiltersChange, filterConversations]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search.trim() ||
    filters.status !== "all" ||
    filters.sentiment !== "all" ||
    filters.assignee !== "all";

  // Get active filter count
  const activeFilterCount = [
    filters.search.trim() ? 1 : 0,
    filters.status !== "all" ? 1 : 0,
    filters.sentiment !== "all" ? 1 : 0,
    filters.assignee !== "all" ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  // Apply filters when conversations change
  React.useEffect(() => {
    filterConversations(filters);
  }, [conversations, filters, filterConversations]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input - Always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations, emails, messages..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.status === ConversationStatus.AWAITING_HUMAN_RESPONSE ? "default" : "outline"}
            size="sm"
            onClick={() =>
              handleFilterChange(
                "status",
                filters.status === ConversationStatus.AWAITING_HUMAN_RESPONSE
                  ? "all"
                  : ConversationStatus.AWAITING_HUMAN_RESPONSE
              )
            }
            className="h-8"
          >
            <Clock className="h-4 w-4 mr-1" />
            Needs Response
          </Button>
          <Button
            variant={filters.assignee === "unassigned" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              handleFilterChange("assignee", filters.assignee === "unassigned" ? "all" : "unassigned")
            }
            className="h-8"
          >
            <Users className="h-4 w-4 mr-1" />
            Unassigned
          </Button>
          <Button
            variant={filters.sentiment === "negative" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              handleFilterChange("sentiment", filters.sentiment === "negative" ? "all" : "negative")
            }
            className="h-8"
          >
            <Frown className="h-4 w-4 mr-1" />
            Negative
          </Button>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={ConversationStatus.AI_HANDLING}>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      AI Handling
                    </div>
                  </SelectItem>
                  <SelectItem value={ConversationStatus.AWAITING_HUMAN_RESPONSE}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Awaiting Response
                    </div>
                  </SelectItem>
                  <SelectItem value={ConversationStatus.RESOLVED}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-4 w-4" />
                      Resolved
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sentiment Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <Select
                value={filters.sentiment}
                onValueChange={(value) => handleFilterChange("sentiment", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sentiments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">
                    <div className="flex items-center gap-2">
                      <Smile className="h-4 w-4 text-green-500" />
                      Positive
                    </div>
                  </SelectItem>
                  <SelectItem value="neutral">
                    <div className="flex items-center gap-2">
                      <Meh className="h-4 w-4 text-gray-500" />
                      Neutral
                    </div>
                  </SelectItem>
                  <SelectItem value="negative">
                    <div className="flex items-center gap-2">
                      <Frown className="h-4 w-4 text-red-500" />
                      Negative
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Select
                value={filters.assignee}
                onValueChange={(value) => handleFilterChange("assignee", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Unassigned
                    </div>
                  </SelectItem>
                  {uniqueAssignees.map((assignee) => (
                    <SelectItem key={assignee} value={assignee}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {assignee}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {filters.search.trim() && (
              <Badge variant="secondary" className="gap-1">
                Search: "{filters.search}"
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange("search", "")}
                />
              </Badge>
            )}
            {filters.status !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.status.replace("_", " ")}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange("status", "all")}
                />
              </Badge>
            )}
            {filters.sentiment !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Sentiment: {filters.sentiment}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange("sentiment", "all")}
                />
              </Badge>
            )}
            {filters.assignee !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Assignee: {filters.assignee === "unassigned" ? "Unassigned" : filters.assignee}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange("assignee", "all")}
                />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing conversation filters
export function useConversationFilters(initialConversations: ConversationWithMetadata[]) {
  const [filters, setFilters] = useState<ConversationFilters>({
    search: "",
    status: "all",
    sentiment: "all",
    assignee: "all",
  });
  
  const [filteredConversations, setFilteredConversations] = useState<ConversationWithMetadata[]>(
    initialConversations
  );

  return {
    filters,
    filteredConversations,
    setFilters,
    setFilteredConversations,
  };
}