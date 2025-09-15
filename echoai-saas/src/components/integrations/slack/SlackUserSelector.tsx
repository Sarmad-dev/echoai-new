import React from 'react';
import { SlackUserOption } from '@/types/slack';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Mail, AlertTriangle } from 'lucide-react';

interface SlackUserSelectorProps {
  users: SlackUserOption[];
  loading: boolean;
  value?: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function SlackUserSelector({
  users,
  loading,
  value,
  onChange,
  placeholder = "Select a user...",
  error,
  className
}: SlackUserSelectorProps) {
  const selectedUser = users.find(user => user.id === value);

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
              <span>Loading users...</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {users.length === 0 && !loading ? (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No users available
            </div>
          ) : (
            users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">{user.displayName || user.realName}</div>
                      {user.name !== user.displayName && (
                        <div className="text-xs text-muted-foreground">@{user.name}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {user.email && (
                      <Badge variant="outline" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        {user.email}
                      </Badge>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {selectedUser && (
        <div className="mt-2 p-2 bg-muted/50 rounded-md">
          <div className="text-sm">
            <div className="font-medium">Selected: {selectedUser.displayName || selectedUser.realName}</div>
            {selectedUser.email && (
              <div className="text-muted-foreground">Email: {selectedUser.email}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}