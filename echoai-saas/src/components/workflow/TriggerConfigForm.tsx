/**
 * Trigger Configuration Form Components
 *
 * Provides UI components for configuring different trigger types
 * in the workflow automation builder.
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, X } from "lucide-react";
import type { TriggerConfig } from "@/lib/workflow/triggers";

interface TriggerConfigFormProps {
  triggerType: string;
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}

export function TriggerConfigForm({
  triggerType,
  config,
  onChange,
}: TriggerConfigFormProps) {
  const renderTriggerConfig = () => {
    switch (triggerType) {
      case "new_conversation":
        return <NewConversationConfig config={config} onChange={onChange} />;
      case "intent_detected":
        return <IntentDetectedConfig config={config} onChange={onChange} />;
      case "negative_sentiment":
        return <NegativeSentimentConfig config={config} onChange={onChange} />;
      case "image_uploaded":
        return <ImageUploadedConfig config={config} onChange={onChange} />;
      case "high_value_lead":
        return <HighValueLeadConfig config={config} onChange={onChange} />;
      case "escalation_trigger":
        return <EscalationTriggerConfig config={config} onChange={onChange} />;
      case "conversation_triage":
        return <ConversationTriageConfig config={config} onChange={onChange} />;
      default:
        return <div>Unknown trigger type: {triggerType}</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getTriggerTitle(triggerType)}</CardTitle>
        <CardDescription>{getTriggerDescription(triggerType)}</CardDescription>
      </CardHeader>
      <CardContent>{renderTriggerConfig()}</CardContent>
    </Card>
  );
}

function NewConversationConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const conditions = config.conditions || {};

  const updateCondition = (key: string, value: any) => {
    onChange({
      ...config,
      conditions: { ...conditions, [key]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="newUsersOnly"
          checked={conditions.newUsersOnly || false}
          onCheckedChange={(checked) =>
            updateCondition("newUsersOnly", checked)
          }
        />
        <Label htmlFor="newUsersOnly">Trigger only for new users</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="businessHoursOnly"
          checked={conditions.businessHoursOnly || false}
          onCheckedChange={(checked) =>
            updateCondition("businessHoursOnly", checked)
          }
        />
        <Label htmlFor="businessHoursOnly">
          Trigger only during business hours (9 AM - 5 PM)
        </Label>
      </div>

      <div>
        <Label htmlFor="userSegment">User Segment Filter</Label>
        <Select
          value={conditions.userSegment || "all"}
          onValueChange={(value) => updateCondition("userSegment", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="new">New Users Only</SelectItem>
            <SelectItem value="returning">Returning Users Only</SelectItem>
            <SelectItem value="premium">Premium Users Only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function IntentDetectedConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");
  const keywords = config.keywords || [];

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      onChange({
        ...config,
        keywords: [...keywords, newKeyword.trim()],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    onChange({
      ...config,
      keywords: keywords.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="keywords">Intent Keywords</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="keywords"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Enter keyword or phrase"
            onKeyPress={(e) => e.key === "Enter" && addKeyword()}
          />
          <Button type="button" onClick={addKeyword} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Add keywords that indicate specific user intents (e.g., &quot;demo&quot;,
          &quot;pricing&quot;, &quot;cancel&quot;)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {keyword}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 hover:bg-transparent"
              onClick={() => removeKeyword(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <div>
        <Label htmlFor="matchType">Match Type</Label>
        <Select
          value={config.conditions?.matchType || "contains"}
          onValueChange={(value) =>
            onChange({
              ...config,
              conditions: { ...config.conditions, matchType: value },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains keyword</SelectItem>
            <SelectItem value="exact">Exact match</SelectItem>
            <SelectItem value="starts_with">Starts with keyword</SelectItem>
            <SelectItem value="regex">Regular expression</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function NegativeSentimentConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const threshold = config.sentimentThreshold ?? -0.2;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="threshold">Sentiment Threshold</Label>
        <div className="mt-2 space-y-2">
          <Slider
            id="threshold"
            min={-1}
            max={0}
            step={0.1}
            value={[threshold]}
            onValueChange={([value]) =>
              onChange({ ...config, sentimentThreshold: value })
            }
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Very Negative (-1.0)</span>
            <span>Current: {threshold}</span>
            <span>Neutral (0.0)</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Trigger when sentiment score falls below this threshold
        </p>
      </div>

      <div>
        <Label htmlFor="urgencyMapping">Urgency Mapping</Label>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Critical (≤ -0.8)</span>
            <Badge variant="destructive">Critical</Badge>
          </div>
          <div className="flex justify-between">
            <span>High (-0.8 to -0.5)</span>
            <Badge variant="destructive">High</Badge>
          </div>
          <div className="flex justify-between">
            <span>Medium (-0.5 to -0.2)</span>
            <Badge variant="secondary">Medium</Badge>
          </div>
          <div className="flex justify-between">
            <span>Low (-0.2 to 0.0)</span>
            <Badge variant="outline">Low</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="consecutiveMessages"
          checked={config.conditions?.consecutiveMessages || false}
          onCheckedChange={(checked) =>
            onChange({
              ...config,
              conditions: {
                ...config.conditions,
                consecutiveMessages: checked,
              },
            })
          }
        />
        <Label htmlFor="consecutiveMessages">
          Require consecutive negative messages
        </Label>
      </div>
    </div>
  );
}

function ImageUploadedConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const conditions = config.conditions || {};

  const updateCondition = (key: string, value: any) => {
    onChange({
      ...config,
      conditions: { ...conditions, [key]: value },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="allowedTypes">Allowed Image Types</Label>
        <div className="mt-2 space-y-2">
          {["image/jpeg", "image/png", "image/webp", "image/gif"].map(
            (type) => (
              <div key={type} className="flex items-center space-x-2">
                <Switch
                  id={type}
                  checked={conditions.allowedTypes?.includes(type) || false}
                  onCheckedChange={(checked) => {
                    const currentTypes = conditions.allowedTypes || [];
                    const newTypes = checked
                      ? [...currentTypes, type]
                      : currentTypes.filter((t: string) => t !== type);
                    updateCondition("allowedTypes", newTypes);
                  }}
                />
                <Label htmlFor={type}>{type}</Label>
              </div>
            )
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="maxSize">Maximum File Size (MB)</Label>
        <Input
          id="maxSize"
          type="number"
          value={conditions.maxSizeMB || ""}
          onChange={(e) => {
            const sizeMB = Number(e.target.value);
            updateCondition("maxSizeBytes", sizeMB * 1024 * 1024);
            updateCondition("maxSizeMB", sizeMB);
          }}
          placeholder="10"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="requireAnalysis"
          checked={conditions.requireAnalysis || false}
          onCheckedChange={(checked) =>
            updateCondition("requireAnalysis", checked)
          }
        />
        <Label htmlFor="requireAnalysis">
          Require successful image analysis
        </Label>
      </div>
    </div>
  );
}

function HighValueLeadConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const [newIndicator, setNewIndicator] = useState("");
  const threshold = config.leadScoreThreshold ?? 0.7;
  const valueIndicators = config.valueIndicators || [];

  const addIndicator = () => {
    if (newIndicator.trim() && !valueIndicators.includes(newIndicator.trim())) {
      onChange({
        ...config,
        valueIndicators: [...valueIndicators, newIndicator.trim()],
      });
      setNewIndicator("");
    }
  };

  const removeIndicator = (index: number) => {
    onChange({
      ...config,
      valueIndicators: valueIndicators.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="threshold">Lead Score Threshold</Label>
        <div className="mt-2 space-y-2">
          <Slider
            id="threshold"
            min={0}
            max={1}
            step={0.1}
            value={[threshold]}
            onValueChange={([value]) =>
              onChange({ ...config, leadScoreThreshold: value })
            }
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Low (0.0)</span>
            <span>Current: {threshold}</span>
            <span>High (1.0)</span>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="valueIndicators">High-Value Indicators</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="valueIndicators"
            value={newIndicator}
            onChange={(e) => setNewIndicator(e.target.value)}
            placeholder="e.g., enterprise, bulk order, demo"
            onKeyPress={(e) => e.key === "Enter" && addIndicator()}
          />
          <Button type="button" onClick={addIndicator} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Keywords that indicate high-value lead potential
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {valueIndicators.map((indicator, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {indicator}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 hover:bg-transparent"
              onClick={() => removeIndicator(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <div>
        <Label htmlFor="priorityMapping">Priority Mapping</Label>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Urgent (≥ 0.9)</span>
            <Badge variant="destructive">Urgent</Badge>
          </div>
          <div className="flex justify-between">
            <span>High (0.8 - 0.9)</span>
            <Badge variant="destructive">High</Badge>
          </div>
          <div className="flex justify-between">
            <span>Medium (0.7 - 0.8)</span>
            <Badge variant="secondary">Medium</Badge>
          </div>
          <div className="flex justify-between">
            <span>Low (&lt; 0.7)</span>
            <Badge variant="outline">Low</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTriggerTitle(triggerType: string): string {
  const titles: Record<string, string> = {
    new_conversation: "New Conversation",
    intent_detected: "Intent Detection",
    negative_sentiment: "Negative Sentiment",
    image_uploaded: "Image Upload",
    high_value_lead: "High-Value Lead",
    escalation_trigger: "Escalation Trigger",
    conversation_triage: "Conversation Triage",
  };
  return titles[triggerType] || triggerType;
}

function getTriggerDescription(triggerType: string): string {
  const descriptions: Record<string, string> = {
    new_conversation: "Triggers when a new conversation is started",
    intent_detected: "Triggers when specific keywords or intents are detected",
    negative_sentiment:
      "Triggers when negative sentiment is detected in messages",
    image_uploaded: "Triggers when a user uploads an image",
    high_value_lead: "Triggers when high-value lead indicators are detected",
    escalation_trigger: "Triggers when conversations need to be escalated to human agents",
    conversation_triage: "Triggers when conversations need priority-based routing and triage",
  };
  return descriptions[triggerType] || "Configure trigger conditions";
}

function EscalationTriggerConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");
  const sentimentThreshold = config.sentimentThreshold ?? -0.3;
  const keywords = config.keywords || [];
  const conditions = config.conditions || {};

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      onChange({
        ...config,
        keywords: [...keywords, newKeyword.trim()],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    onChange({
      ...config,
      keywords: keywords.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (key: string, value: any) => {
    onChange({
      ...config,
      conditions: { ...conditions, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Sentiment-based Escalation */}
      <div className="space-y-4">
        <h4 className="font-medium">Sentiment-Based Escalation</h4>
        <div>
          <Label htmlFor="sentimentThreshold">Sentiment Threshold</Label>
          <div className="mt-2 space-y-2">
            <Slider
              id="sentimentThreshold"
              min={-1}
              max={0}
              step={0.1}
              value={[sentimentThreshold]}
              onValueChange={([value]) =>
                onChange({ ...config, sentimentThreshold: value })
              }
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Very Negative (-1.0)</span>
              <span>Current: {sentimentThreshold}</span>
              <span>Neutral (0.0)</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Escalate when sentiment score falls below this threshold
          </p>
        </div>

        <div>
          <Label htmlFor="urgencyLevels">Urgency Level Mapping</Label>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Critical (≤ -0.7)</span>
              <Badge variant="destructive">Critical</Badge>
            </div>
            <div className="flex justify-between">
              <span>High (-0.7 to -0.5)</span>
              <Badge variant="destructive">High</Badge>
            </div>
            <div className="flex justify-between">
              <span>Medium (-0.5 to -0.3)</span>
              <Badge variant="secondary">Medium</Badge>
            </div>
            <div className="flex justify-between">
              <span>Low (-0.3 to 0.0)</span>
              <Badge variant="outline">Low</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Keyword-based Escalation */}
      <div className="space-y-4">
        <h4 className="font-medium">Keyword-Based Escalation</h4>
        <div>
          <Label htmlFor="escalationKeywords">Escalation Keywords</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="escalationKeywords"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., urgent, emergency, lawsuit"
              onKeyPress={(e) => e.key === "Enter" && addKeyword()}
            />
            <Button type="button" onClick={addKeyword} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Keywords that trigger immediate escalation (e.g., &quot;urgent&quot;, &quot;emergency&quot;, &quot;lawsuit&quot;, &quot;refund&quot;)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {keyword}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => removeKeyword(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Duration-based Escalation */}
      <div className="space-y-4">
        <h4 className="font-medium">Duration-Based Escalation</h4>
        <div>
          <Label htmlFor="responseTimeMinutes">Response Time Threshold (minutes)</Label>
          <Input
            id="responseTimeMinutes"
            type="number"
            value={conditions.responseTimeMinutes || ""}
            onChange={(e) => {
              const minutes = Number(e.target.value);
              updateCondition("responseTimeMinutes", minutes);
            }}
            placeholder="30"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Escalate if no response within this time (default: 30 minutes)
          </p>
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-4">
        <h4 className="font-medium">Additional Options</h4>
        <div className="flex items-center space-x-2">
          <Switch
            id="autoAssign"
            checked={conditions.autoAssign || false}
            onCheckedChange={(checked) =>
              updateCondition("autoAssign", checked)
            }
          />
          <Label htmlFor="autoAssign">
            Automatically assign to available agent
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="notifyTeam"
            checked={conditions.notifyTeam || false}
            onCheckedChange={(checked) =>
              updateCondition("notifyTeam", checked)
            }
          />
          <Label htmlFor="notifyTeam">
            Send team notification on escalation
          </Label>
        </div>
      </div>
    </div>
  );
}

function ConversationTriageConfig({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  const [newKeyword, setNewKeyword] = useState("");
  const sentimentThreshold = config.sentimentThreshold ?? -0.6;
  const keywords = config.keywords || [];
  const conditions = config.conditions || {};

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      onChange({
        ...config,
        keywords: [...keywords, newKeyword.trim()],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    onChange({
      ...config,
      keywords: keywords.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (key: string, value: any) => {
    onChange({
      ...config,
      conditions: { ...conditions, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* High-Priority Sentiment Triage */}
      <div className="space-y-4">
        <h4 className="font-medium">High-Priority Sentiment Triage</h4>
        <div>
          <Label htmlFor="triageSentimentThreshold">Sentiment Threshold</Label>
          <div className="mt-2 space-y-2">
            <Slider
              id="triageSentimentThreshold"
              min={-1}
              max={0}
              step={0.1}
              value={[sentimentThreshold]}
              onValueChange={([value]) =>
                onChange({ ...config, sentimentThreshold: value })
              }
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Very Negative (-1.0)</span>
              <span>Current: {sentimentThreshold}</span>
              <span>Neutral (0.0)</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Triage conversations with sentiment below this threshold (default: -0.6)
          </p>
        </div>
      </div>

      {/* Critical Keywords Triage */}
      <div className="space-y-4">
        <h4 className="font-medium">Critical Keywords Triage</h4>
        <div>
          <Label htmlFor="triageKeywords">Critical Keywords</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="triageKeywords"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., urgent, critical, important"
              onKeyPress={(e) => e.key === "Enter" && addKeyword()}
            />
            <Button type="button" onClick={addKeyword} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Keywords that indicate high-priority conversations requiring immediate attention
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {keyword}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => removeKeyword(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Message Count Triage */}
      <div className="space-y-4">
        <h4 className="font-medium">Message Count Triage</h4>
        <div>
          <Label htmlFor="messageCount">Message Count Threshold</Label>
          <Input
            id="messageCount"
            type="number"
            value={conditions.messageCount || ""}
            onChange={(e) => {
              const count = Number(e.target.value);
              updateCondition("messageCount", count);
            }}
            placeholder="5"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Triage when customer sends this many messages without resolution (default: 5)
          </p>
        </div>
      </div>

      {/* Response Time Triage */}
      <div className="space-y-4">
        <h4 className="font-medium">Response Time Triage</h4>
        <div>
          <Label htmlFor="triageResponseTime">Response Time Threshold (minutes)</Label>
          <Input
            id="triageResponseTime"
            type="number"
            value={conditions.responseTimeMinutes || ""}
            onChange={(e) => {
              const minutes = Number(e.target.value);
              updateCondition("responseTimeMinutes", minutes);
            }}
            placeholder="30"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Triage conversations with long response times (default: 30 minutes)
          </p>
        </div>
      </div>

      {/* Priority Settings */}
      <div className="space-y-4">
        <h4 className="font-medium">Priority Assignment</h4>
        <div>
          <Label htmlFor="defaultPriority">Default Priority Level</Label>
          <Select
            value={conditions.defaultPriority || "medium"}
            onValueChange={(value) => updateCondition("defaultPriority", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="critical">Critical Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priorityMapping">Priority Mapping Rules</Label>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Critical Keywords</span>
              <Badge variant="destructive">Critical</Badge>
            </div>
            <div className="flex justify-between">
              <span>Very Negative Sentiment (≤ -0.8)</span>
              <Badge variant="destructive">Critical</Badge>
            </div>
            <div className="flex justify-between">
              <span>Negative Sentiment (-0.8 to -0.6)</span>
              <Badge variant="destructive">High</Badge>
            </div>
            <div className="flex justify-between">
              <span>Multiple Messages (≥ 5)</span>
              <Badge variant="secondary">Medium</Badge>
            </div>
            <div className="flex justify-between">
              <span>Long Response Time (≥ 30 min)</span>
              <Badge variant="secondary">Medium</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Actions */}
      <div className="space-y-4">
        <h4 className="font-medium">Triage Actions</h4>
        <div className="flex items-center space-x-2">
          <Switch
            id="addToPriorityQueue"
            checked={conditions.addToPriorityQueue !== false}
            onCheckedChange={(checked) =>
              updateCondition("addToPriorityQueue", checked)
            }
          />
          <Label htmlFor="addToPriorityQueue">
            Add to priority queue
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="notifyAgents"
            checked={conditions.notifyAgents || false}
            onCheckedChange={(checked) =>
              updateCondition("notifyAgents", checked)
            }
          />
          <Label htmlFor="notifyAgents">
            Notify available agents
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="addTags"
            checked={conditions.addTags || false}
            onCheckedChange={(checked) =>
              updateCondition("addTags", checked)
            }
          />
          <Label htmlFor="addTags">
            Add triage tags to conversation
          </Label>
        </div>
      </div>
    </div>
  );
}
