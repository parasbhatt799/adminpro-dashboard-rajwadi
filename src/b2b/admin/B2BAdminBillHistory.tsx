import React from 'react';
import B2BAPIBillHistory from '../shared/B2BAPIBillHistory';

export default function B2BAdminBillHistory() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <B2BAPIBillHistory isAdmin={true} />
    </div>
  );
}
