import React from 'react';
import B2BAPIBillHistory from '../shared/B2BAPIBillHistory';

export default function B2BAgentBillHistory() {
  const agentId = localStorage.getItem('b2bAgentId') || undefined;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <B2BAPIBillHistory isAdmin={false} agentId={agentId} />
    </div>
  );
}
