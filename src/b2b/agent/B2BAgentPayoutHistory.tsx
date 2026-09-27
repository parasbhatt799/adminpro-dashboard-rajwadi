import React from 'react';
import B2BAPIPayoutHistory from '../shared/B2BAPIPayoutHistory';

export default function B2BAgentPayoutHistory() {
  const agentId = localStorage.getItem('b2bAgentId') || undefined;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <B2BAPIPayoutHistory isAdmin={false} agentId={agentId} />
    </div>
  );
}
