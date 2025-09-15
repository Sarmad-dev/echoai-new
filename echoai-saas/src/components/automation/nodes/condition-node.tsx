'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Settings } from 'lucide-react';

interface ConditionNodeData {
  label: string;
  config: Record<string, unknown>;
}

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  return (
    <div className={`
      px-4 py-3 shadow-lg rounded-lg bg-card border-2 min-w-[200px]
      ${selected ? 'border-primary' : 'border-border'}
    `}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 bg-yellow-500 text-white rounded">
          <GitBranch className="w-3 h-3" />
        </div>
        <div className="font-medium text-sm">Condition</div>
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
      
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-yellow-500 border-2 border-white"
      />
      
      {/* True output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      
      {/* False output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-red-500 border-2 border-white"
      />
      
      {/* Labels for true/false outputs */}
      <div className="absolute -right-8 top-[25%] text-xs text-green-600 font-medium">
        True
      </div>
      <div className="absolute -right-8 top-[65%] text-xs text-red-600 font-medium">
        False
      </div>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';