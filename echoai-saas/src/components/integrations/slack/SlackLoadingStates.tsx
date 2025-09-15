"use client";

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Wifi } from 'lucide-react';

/**
 * Loading skeleton for connection status card
 */
export function SlackConnectionStatusSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for channel selector
 */
export function SlackChannelSelectorSkeleton({ 
  label,
  description,
  className 
}: { 
  label?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Skeleton className="h-4 w-24 mb-1" />}
      <Skeleton className="h-9 w-full" />
      {description && <Skeleton className="h-3 w-48 mt-1" />}
    </div>
  );
}

/**
 * Loading skeleton for user selector
 */
export function SlackUserSelectorSkeleton({ 
  label,
  description,
  className 
}: { 
  label?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Skeleton className="h-4 w-20 mb-1" />}
      <Skeleton className="h-9 w-full" />
      {description && <Skeleton className="h-3 w-40 mt-1" />}
    </div>
  );
}

/**
 * Inline loading indicator for data fetching
 */
export function SlackDataLoadingIndicator({ 
  message = "Loading Slack data...",
  size = "default",
  className 
}: { 
  message?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const iconSize = {
    sm: "h-3 w-3",
    default: "h-4 w-4", 
    lg: "h-6 w-6"
  }[size];

  const textSize = {
    sm: "text-xs",
    default: "text-sm",
    lg: "text-base"
  }[size];

  return (
    <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
      <Loader2 className={`${iconSize} animate-spin`} />
      <span className={textSize}>{message}</span>
    </div>
  );
}

/**
 * Connection checking indicator
 */
export function SlackConnectionCheckingIndicator({ 
  message = "Checking Slack connection...",
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-blue-600 ${className}`}>
      <div className="relative">
        <Wifi className="h-4 w-4" />
        <div className="absolute inset-0 animate-ping">
          <Wifi className="h-4 w-4 opacity-75" />
        </div>
      </div>
      <span className="text-sm">{message}</span>
    </div>
  );
}

/**
 * Full page loading state for Slack configuration
 */
export function SlackConfigurationLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Connection Status */}
      <SlackConnectionStatusSkeleton />
      
      {/* Form Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SlackChannelSelectorSkeleton label="Default Channel" />
          <SlackUserSelectorSkeleton label="Default User" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SlackChannelSelectorSkeleton label="General Channel" />
          <SlackChannelSelectorSkeleton label="Error Channel" />
          <SlackChannelSelectorSkeleton label="Urgent Channel" />
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

/**
 * Compact loading state for inline use
 */
export function SlackInlineLoadingState({ 
  message = "Loading...",
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center py-2 ${className}`}>
      <SlackDataLoadingIndicator message={message} size="sm" />
    </div>
  );
}

/**
 * Loading state for dropdown content
 */
export function SlackDropdownLoadingState({ 
  message = "Loading options...",
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={`p-4 text-center ${className}`}>
      <SlackDataLoadingIndicator message={message} size="sm" />
    </div>
  );
}