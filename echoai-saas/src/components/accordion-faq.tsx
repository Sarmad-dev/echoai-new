"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Search, 
  MessageCircle, 
  HelpCircle, 
  TrendingUp,
  Filter,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  popularity?: number;
  lastUpdated?: Date;
}

export interface AccordionFAQProps {
  faqs: FAQ[];
  chatbotId?: string;
  searchable?: boolean;
  categorized?: boolean;
  allowMultipleOpen?: boolean;
  onFAQSelect?: (faq: FAQ) => void;
  onStartChat?: () => void;
  primaryColor?: string;
  className?: string;
  maxHeight?: string;
  showPopularity?: boolean;
  enableChatIntegration?: boolean;
}

export function AccordionFAQ({
  faqs,
  chatbotId,
  searchable = true,
  categorized = true,
  allowMultipleOpen = true,
  onFAQSelect,
  onStartChat,
  primaryColor = "#3b82f6",
  className,
  maxHeight = "400px",
  showPopularity = true,
  enableChatIntegration = true,
}: AccordionFAQProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);

  // Extract unique categories from FAQs
  const categories = useMemo(() => {
    const cats = faqs
      .map(faq => faq.category)
      .filter((cat): cat is string => Boolean(cat));
    return Array.from(new Set(cats)).sort();
  }, [faqs]);

  // Filter FAQs based on search and category
  const filteredFAQs = useMemo(() => {
    let filtered = faqs;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(faq => 
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    // Sort by popularity if available
    return filtered.sort((a, b) => {
      if (showPopularity && a.popularity && b.popularity) {
        return b.popularity - a.popularity;
      }
      return 0;
    });
  }, [faqs, searchQuery, selectedCategory, showPopularity]);

  // Group FAQs by category if categorized view is enabled
  const groupedFAQs = useMemo(() => {
    if (!categorized) {
      return { "All FAQs": filteredFAQs };
    }

    const grouped: Record<string, FAQ[]> = {};
    
    filteredFAQs.forEach(faq => {
      const category = faq.category || "General";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(faq);
    });

    return grouped;
  }, [filteredFAQs, categorized]);

  const handleFAQClick = async (faq: FAQ) => {
    // Track FAQ analytics
    if (showPopularity) {
      try {
        await fetch("/api/faq/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            faqId: faq.id,
            chatbotId: chatbotId || "",
            action: "click",
            sessionId: typeof window !== "undefined" ? window.sessionStorage.getItem("chat-session-id") : null,
            metadata: {
              question: faq.question,
              category: faq.category,
            },
          }),
        });
      } catch (error) {
        console.error("Failed to track FAQ analytics:", error);
      }
    }
    
    onFAQSelect?.(faq);
  };

  const handleAccordionValueChange = (value: string | string[]) => {
    if (allowMultipleOpen) {
      setOpenItems(Array.isArray(value) ? value : [value]);
    } else {
      setOpenItems(Array.isArray(value) ? value : [value]);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
  };

  const hasActiveFilters = searchQuery.trim() || selectedCategory;

  if (faqs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <HelpCircle className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          No FAQs Available
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          We're working on adding helpful questions and answers.
        </p>
        {enableChatIntegration && onStartChat && (
          <Button 
            onClick={onStartChat}
            style={{ backgroundColor: primaryColor }}
            className="text-white hover:opacity-90"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Start a Chat Instead
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Search and Filter Controls */}
      {(searchable || (categorized && categories.length > 0)) && (
        <div className="space-y-3">
          {/* Search Input */}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          )}

          {/* Category Filter */}
          {categorized && categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                style={selectedCategory === null ? { backgroundColor: primaryColor } : {}}
                className={selectedCategory === null ? "text-white" : ""}
              >
                <Filter className="w-3 h-3 mr-1" />
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  style={selectedCategory === category ? { backgroundColor: primaryColor } : {}}
                  className={selectedCategory === category ? "text-white" : ""}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredFAQs.length} result{filteredFAQs.length !== 1 ? 's' : ''} found
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* FAQ Accordion */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">No FAQs match your search criteria.</p>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="mt-2"
              >
                Clear filters to see all FAQs
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedFAQs).map(([categoryName, categoryFAQs]) => (
              <div key={categoryName}>
                {categorized && Object.keys(groupedFAQs).length > 1 && (
                  <h4 className="font-medium text-sm text-muted-foreground mb-2 px-1">
                    {categoryName}
                  </h4>
                )}
                
                {allowMultipleOpen ? (
                  <Accordion
                    type="multiple"
                    value={openItems as string[]}
                    onValueChange={handleAccordionValueChange}
                    className="space-y-2"
                  >
                    {categoryFAQs.map((faq) => (
                      <AccordionItem
                        key={faq.id}
                        value={faq.id}
                        className="border rounded-lg px-4 hover:shadow-sm transition-shadow"
                        style={{ borderColor: `${primaryColor}20` }}
                      >
                        <AccordionTrigger 
                          className="text-left hover:no-underline py-3"
                          style={{ color: primaryColor }}
                        >
                          <div className="flex items-start justify-between w-full pr-4">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {faq.question}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {faq.category && !categorized && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs"
                                    style={{ 
                                      backgroundColor: `${primaryColor}15`,
                                      color: primaryColor 
                                    }}
                                  >
                                    {faq.category}
                                  </Badge>
                                )}
                                {showPopularity && faq.popularity && faq.popularity > 0 && (
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    {faq.popularity}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="pb-4">
                          <div className="text-sm text-muted-foreground leading-relaxed mb-3">
                            {faq.answer}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {faq.tags && faq.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {faq.tags.slice(0, 3).map((tag) => (
                                    <Badge 
                                      key={tag} 
                                      variant="outline" 
                                      className="text-xs"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                  {faq.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{faq.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {enableChatIntegration && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFAQClick(faq)}
                                className="hover:bg-transparent"
                                style={{ 
                                  borderColor: primaryColor,
                                  color: primaryColor 
                                }}
                              >
                                <MessageCircle className="w-3 h-3 mr-1" />
                                Ask about this
                              </Button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <Accordion
                    type="single"
                    value={openItems[0] || ""}
                    onValueChange={handleAccordionValueChange}
                    className="space-y-2"
                  >
                    {categoryFAQs.map((faq) => (
                      <AccordionItem
                        key={faq.id}
                        value={faq.id}
                        className="border rounded-lg px-4 hover:shadow-sm transition-shadow"
                        style={{ borderColor: `${primaryColor}20` }}
                      >
                        <AccordionTrigger 
                          className="text-left hover:no-underline py-3"
                          style={{ color: primaryColor }}
                        >
                          <div className="flex items-start justify-between w-full pr-4">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {faq.question}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {faq.category && !categorized && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs"
                                    style={{ 
                                      backgroundColor: `${primaryColor}15`,
                                      color: primaryColor 
                                    }}
                                  >
                                    {faq.category}
                                  </Badge>
                                )}
                                {showPopularity && faq.popularity && faq.popularity > 0 && (
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    {faq.popularity}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="pb-4">
                          <div className="text-sm text-muted-foreground leading-relaxed mb-3">
                            {faq.answer}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {faq.tags && faq.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {faq.tags.slice(0, 3).map((tag) => (
                                    <Badge 
                                      key={tag} 
                                      variant="outline" 
                                      className="text-xs"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                  {faq.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{faq.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {enableChatIntegration && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFAQClick(faq)}
                                className="hover:bg-transparent"
                                style={{ 
                                  borderColor: primaryColor,
                                  color: primaryColor 
                                }}
                              >
                                <MessageCircle className="w-3 h-3 mr-1" />
                                Ask about this
                              </Button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Integration Footer */}
      {enableChatIntegration && onStartChat && filteredFAQs.length > 0 && (
        <div className="pt-3 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Can't find what you're looking for?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartChat}
              className="w-full"
              style={{ 
                borderColor: primaryColor,
                color: primaryColor 
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Start a conversation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}