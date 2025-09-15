'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Settings } from 'lucide-react';

interface TriggerNodeData {
  label: string;
  config: Record<string, unknown>;
}

export const TriggerNode = memo(({ data, selected }: NodeProps<TriggerNodeData>) => {
  return (
    <div className={`
      px-4 py-3 shadow-lg rounded-lg bg-card border-2 min-w-[200px]
      ${selected ? 'border-primary' : 'border-border'}
    `}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 bg-green-500 text-white rounded">
          <Zap className="w-3 h-3" />
        </div>
        <div className="font-medium text-sm">Trigger</div>
        <button className="ml-auto p-1 hover:bg-accent rounded">
          <Settings className="w-3 h-3" />
        </button>
      </div>
      
      <div className="text-sm font-medium mb-1">{data.label}</div>
      
      {Object.keys(data.config).length > 0 && (
        <div className="text-xs text-muted-foreground">
          Configured
        </div>
      )}
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';