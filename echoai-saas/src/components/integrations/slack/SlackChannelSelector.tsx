import React from 'react';
import { SlackChannelOption } from '@/types/slack';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Hash, Lock, AlertTriangle } from 'lucide-react';

interface SlackChannelSelectorProps {
  channels: SlackChannelOption[];
  loading: boolean;
  value?: string;
  onChange: (channelId: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function SlackChannelSelector({
  channels,
  loading,
  value,
  onChange,
  placeholder = "Select a channel...",
  error,
  className
}: SlackChannelSelectorProps) {
  const selectedChannel = channels.find(channel => channel.id === value);

  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={loading}
      >
        <SelectTrigger className="w-full">
          {loading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Loading channels...</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {channels.length === 0 && !loading ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No channels available
            </div>
          ) : (
            channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-2">
                    {channel.isPrivate ? (
                      <Lock className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Hash className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium">{channel.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {channel.isPrivate && (
                      <Badge variant="secondary" className="text-xs">
                        Private
                      </Badge>
                    )}
                    {!channel.isMember && (
                      <Badge variant="outline" className="text-xs">
                        Not a member
                      </Badge>
                    )}
                    {channel.memberCount && (
                      <Badge variant="outline" className="text-xs">
                        {channel.memberCount} members
                      </Badge>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {selectedChannel && !selectedChannel.isMember && (
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You are not a member of this channel. The bot may not be able to post messages here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}